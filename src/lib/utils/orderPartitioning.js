// lib/utils/orderPartitioning.js
// Utilities to split a unified cart into multiple order partitions (scalable beyond 2)
// and allocate financial metrics (discounts, charges, payment splits) proportionally
// with deterministic rounding & reconciliation.

import mongoose from 'mongoose';

/**
 * Partition classifiers: ordered; first match wins. Extendable.
 * Each classifier test receives enriched item (must include product + option docs or flags).
 */
export const DEFAULT_CLASSIFIERS = [
  {
    key: 'inventory',
    test: (item) => !!(item.productDoc?.inventoryData || item.optionDoc?.inventoryData),
  },
  {
    key: 'nonInventory',
    test: () => true, // fallback bucket
  },
];

/**
 * Partition cart items using provided classifiers.
 * @param {Array} items - enriched items with serverPrice etc.
 * @param {Array} classifiers - list of { key, test }
 * @returns {Array<{key: string, items: Array}>}
 */
export function partitionCartItems(items, classifiers = DEFAULT_CLASSIFIERS) {
  const buckets = classifiers.map(c => ({ key: c.key, items: [] }));
  for (const it of items) {
    const bucket = buckets.find(b => {
      const classifier = classifiers.find(c => c.key === b.key);
      try { return classifier.test(it); } catch { return false; }
    });
    (bucket || buckets[buckets.length - 1]).items.push(it);
  }
  // Remove empty buckets for cleanliness
  return buckets.filter(b => b.items.length > 0);
}

/**
 * Generic proportional allocator with reconciliation.
 * Returns integer allocations whose sum == total.
 * @param {number} total
 * @param {number[]} weights - positive numbers; if all zero result all zeros.
 * @returns {{allocations:number[], details: Array<{weight:number, raw:number, floor:number, remainder:number}>}}
 */
export function proportionalAllocate(total, weights) {
  if (total <= 0) return { allocations: weights.map(() => 0), details: [] };
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights <= 0) return { allocations: weights.map(() => 0), details: [] };
  const details = weights.map(w => {
    const raw = (total * w) / sumWeights;
    const floorVal = Math.floor(raw);
    return { weight: w, raw, floor: floorVal, remainder: raw - floorVal };
  });
  let allocated = details.reduce((a, d) => a + d.floor, 0);
  let remainder = total - allocated;
  // Distribute leftover to largest remainders
  const sorted = [...details].sort((a, b) => b.remainder - a.remainder);
  let i = 0;
  while (remainder > 0 && i < sorted.length) {
    sorted[i].floor += 1;
    remainder -= 1;
    i += 1;
  }
  // Map back to original order
  const allocations = details.map(d => {
    const updated = sorted.find(s => s === d);
    return updated.floor;
  });
  return { allocations, details };
}

/**
 * Allocate discount & charges proportionally to partition subtotals.
 * @param {Array<{key:string, subtotal:number}>} partitionsMeta
 * @param {number} totalDiscount
 * @param {number} totalCharges
 * @returns {Array<{key, discount, charges}>}
 */
export function allocateDiscountsAndCharges(partitionsMeta, totalDiscount, totalCharges) {
  const weights = partitionsMeta.map(p => p.subtotal);
  const discAlloc = proportionalAllocate(totalDiscount, weights).allocations;
  const chargeAlloc = proportionalAllocate(totalCharges, weights).allocations;
  return partitionsMeta.map((p, idx) => ({
    key: p.key,
    discount: discAlloc[idx],
    charges: chargeAlloc[idx],
  }));
}

/**
 * Allocate payment splits (online vs COD) across finalized totals.
 * @param {Array<{key:string, finalTotal:number}>} partitionsFinal
 * @param {number} onlineTotal
 * @returns {Array<{key, online, cod}>}
 */
export function allocatePayments(partitionsFinal, onlineTotal) {
  const weights = partitionsFinal.map(p => p.finalTotal);
  const onlineAlloc = proportionalAllocate(onlineTotal, weights).allocations;
  return partitionsFinal.map((p, idx) => ({
    key: p.key,
    online: onlineAlloc[idx],
    cod: p.finalTotal - onlineAlloc[idx],
  }));
}

/**
 * Build full allocation pipeline.
 * @param {Array<{key:string, items:Array}>} partitions
 * @param {{totalDiscount:number, totalExtraCharges:number, onlinePercentage:number}} cfg
 */
export function buildPartitionFinancials(partitions, cfg) {
  const meta = partitions.map(p => ({ key: p.key, subtotal: p.items.reduce((s, it) => s + it.serverPrice * it.quantity, 0) }));
  const totalSubtotal = meta.reduce((a, b) => a + b.subtotal, 0);
  const discountAlloc = allocateDiscountsAndCharges(meta, cfg.totalDiscount, cfg.totalExtraCharges);
  const finals = meta.map(m => {
    const alloc = discountAlloc.find(d => d.key === m.key);
    const totalAfterDiscount = m.subtotal - alloc.discount;
    const finalTotal = totalAfterDiscount + alloc.charges;
    return { key: m.key, subtotal: m.subtotal, discount: alloc.discount, charges: alloc.charges, totalAfterDiscount, finalTotal };
  });
  const overallFinal = finals.reduce((a, f) => a + f.finalTotal, 0);
  const onlineTotal = Math.round((overallFinal * (cfg.onlinePercentage || 0)) / 100);
  const paymentAlloc = allocatePayments(finals, onlineTotal);
  return {
    overall: { subtotal: totalSubtotal, discount: cfg.totalDiscount, charges: cfg.totalExtraCharges, final: overallFinal, onlineTotal, codTotal: overallFinal - onlineTotal },
    partitions: finals.map(f => {
      const pay = paymentAlloc.find(p => p.key === f.key) || { online: 0, cod: f.finalTotal };
      return { ...f, online: pay.online, cod: pay.cod };
    })
  };
}

/**
 * Choose primary partition (strategy: largest subtotal or inventory if tie preference).
 */
export function choosePrimaryPartition(financials) {
  const parts = [...financials.partitions];
  parts.sort((a, b) => b.subtotal - a.subtotal);
  return parts[0];
}

export function newGroupId() { return new mongoose.Types.ObjectId(); }

