# Packaging, Weight, and Dimensions — Updated Logic and Debugging Guide

This document explains the end-to-end logic for selecting packaging boxes, grouping/merging compatible items, packing items into boxes, and computing overall dimensions and weights used for shipping. It also highlights common pitfalls, how to debug them, and recommended updates to ensure correctness and lower shipping costs.

## 1) Key Entities

- PackagingBox
  - dimensions: { length, breadth, height } in cm
  - weight: tare weight of one empty box in kg (aka boxWeight)
  - capacity: number of units it can carry for its intended item type
  - compatibleTags: [string] — logical tags used for grouping compatibility across items/boxes
  - priority: integer — historically used for ordering; see Section 5 for updated usage

- Product / SpecificCategoryVariant
  - packagingDetails:
    - boxId: reference to a PackagingBox
    - productWeight: unit weight (kg) of the product when packed in its assigned box type (without box tare)
  - freebies: { available, weight } — optional extra weight added once per order for that variant, unless you have a different policy

## 2) Selection Flow (Item -> Packaging)

1. Resolve product and variant for each order item.
2. Packaging resolution precedence:
   - If variant.packagingDetails.boxId exists, use it (Variant-level packaging).
   - Else if product.packagingDetails.boxId exists, use it (Product-level packaging).
   - Else: throw error (no packaging)
3. Debug trace collected per item:
   - selectionSource: "variant" | "product"
   - selectionTrace: [ { step, reason, boxId? }, ... ]
   - ids: { productId, variantId, specCategoryId }
   - selectionWarnings: e.g., if compatibleTags appear mismatched to the inferred item type

Note: A common misconfiguration is assigning a box intended for a different item family. Example: Variant “Seatbelt Covers” points to a “roof” box (tag: wraps). This inflates tare/volumetric and total weight.

## 3) Compatibility Tags — Intent and Scope

- Tags are NOT a strict determinant for which box an item must use initially (that’s driven by the explicit variant/product packaging mapping).
- Tags are used for merging/grouping after initial packaging has been resolved, to decide whether items can be co-packed or merged under a larger box type.
- Policy: A larger box can contain items originally assigned to a smaller box type if and only if:
  - Their compatibleTags are equal (or share a strict matching rule), and
  - The larger box’s capacity can accommodate the total quantity being merged.

Recommended: Use strict equality of a single canonical tag per item family (e.g., "seatbeltcovers", "wraps", "keychains"). Avoid mixed or overly generic tags.

## 4) Packing Within a Single Box Type (Greedy)

Given a box type and a list of items already assigned to this box type (after any merging), pack items into as few boxes as possible:

- Inputs per box type:
  - capacity (units per box)
  - box tare (weight)
  - items: [ { itemName, quantity, productWeight, hasFreebie, freebieWeight? } ]
- Algorithm:
  1. Maintain a list of open boxes, each with leftoverCapacity.
  2. Iterate items; for each, greedily place as many units as you can into the first open box with leftover capacity; open a new box when necessary.
  3. Freebie: if policy is “one freebie per order for that variant,” add it to the first box encountered that contains the item. If policy differs, adjust accordingly.
- Per-box outputs:
  - productWeight (sum of placed items’ unitWeight*qty)
  - freebieWeight (sum of freebies applied to that box)
  - tareWeight (box tare)
  - grossWeight = productWeight + freebieWeight + tareWeight
  - volumetricWeight = (L*B*H)/divisor (divisor typically 5000 or 6000)

## 5) Grouping and Merging Across Box Types (Updated)

Problem we observed: Priority numbers didn’t reliably indicate actual physical size. For correctness and lower costs, use SIZE first, not priority.

- Define boxSize = length * breadth * height (cm³).
- Sort candidate box groups in DESCENDING boxSize (largest first).
- For each larger box group, try to absorb (merge) items from smaller box groups if both:
  - compatibleTags match strictly (e.g., "seatbeltcovers" == "seatbeltcovers")
  - capacity allows (i.e., total units to place fit within available boxes when repacked)

Priority usage (optional): If two boxes have the same size (rare), use lower priority value as tie-breaker. Otherwise, priority should not supersede physical size.

Rationale: Larger boxes can physically contain items initially mapped to smaller boxes (same family tag) while minimizing total box count when capacity is respected. This also affects dimension aggregation if you ship as a single consignment.

## 6) Dimension Aggregation for Final Parcel

If your shipping provider supports per-parcel shipments (preferred), submit per-box parcels instead of one combined parcel.

If you must submit a single parcel:
- Combine dimensions by stacking along height:
  - finalLength = max(all box lengths)
  - finalBreadth = max(all box breadths)
  - finalHeight = sum(boxHeight for each physical box used across all box groups)
- This is a simplification; use per-parcel submission when possible to avoid over/under-estimation.

## 7) Weight Calculations and Chargeable Weight

Per box:
- productWeight = sum(unitWeight * qty)
- freebieWeight = sum of freebies assigned to box
- tareWeight = box.weight
- grossWeight = productWeight + freebieWeight + tareWeight
- volumetricWeight = (L*B*H)/divisor

Totals:
- Sum per box grossWeight, per box volumetricWeight across all boxes
- chargeableWeight per box is typically max(grossWeight - tareWeight? or productWeight? vs volumetric). Providers vary:
  - Some use: chargeable = max(deadWeight, volumetricWeight). Here, deadWeight is the actual scale weight of the packed parcel (includes tare).
  - Our debug surfaces both gross and volumetric. Choose based on your courier’s policy. Shiprocket generally uses the higher of actual vs volumetric.

Recommendation: When creating orders via API, provide accurate per-parcel dimensions and actual total weight (gross). Expect courier-side to compute volumetric and bill accordingly.

## 8) Common Pitfall and Example — Seatbelt Covers

Observed data:
- Order: 2 units of “Split Verse Seatbelt Cover”
- Variant packaging details point to box "roof" (ID 6887ccf6..., dims 25x3x100, tare 1.487 kg, tag wraps)
- This yields:
  - productWeight = 2 x 0.23 = 0.46 kg
  - tare = 1.487 kg
  - volumetric = 25x3x100/5000 = 1.5 kg
  - grossWeight = 0.46 + 1.487 = 1.947 kg (too heavy for seatbelt covers)

Correct packaging for seatbelt covers:
- Box: "seatbeltcovers" (ID 68a60d59..., dims 15x5x1, tare 0.05 kg, capacity 4, tag seatbeltcovers)
- Recompute:
  - productWeight = 0.46 kg
  - tare = 0.05 kg
  - volumetric = 15x5x1/5000 = 0.015 kg
  - grossWeight = 0.51 kg
  - BoxesUsed = 1

Conclusion: The variant was misconfigured to use a "wraps" box (roof) instead of the intended "seatbeltcovers" box. Fixing the variant’s box points the packing and totals to the expected, much lower values.

## 9) Debug Fields (Returned by API when debug=true)

- packagingByItem: [
  {
    itemName, quantity, productWeight, hasFreebie, freebieWeight,
    selectionSource, selectionTrace, selectionWarnings,
    ids: { productId, variantId, specCategoryId },
    box: { id, name, capacity, tareWeight, dimensions, priority, compatibleTags }
  }
]
- groupMergeDecisions: [{ action: 'merged'|'standalone', source?, target?, reason? }]
- packingDetailsByBoxId: {
  [boxId]: {
    boxSpec: { name, capacity, tareWeight, dimensions, perBoxVolumetricKg },
    boxes: [
      {
        index, leftoverCapacityEnd,
        productWeight, freebieWeight, tareWeight, grossWeight, volumetricWeightKg,
        itemsPlaced: [{ itemName, placedQty, unitWeight, subtotalWeight }]
      }
    ]
  }
}
- finalDimensionAggregation: { length, breadth, height, rule }
- totals: { tareWeight, productWeight, freebieWeight, volumetricWeightKg, grossWeight }

## 10) Recommended Hard Checks (to prevent mis-picks)

To avoid the “roof for seatbelt covers” scenario:

- Strict compatibility gate at selection:
  - When using variant.packagingDetails.boxId, verify that the box.compatibleTags contains the required canonical tag for the variant (e.g., derived from a stored field `variant.requiredTag` or a mapping), not a name slug heuristic.
  - If mismatch: either error out (safer) or fallback to a default box for that tag family, and log a warning.

- Canonical tag per item family:
  - Keep one canonical tag string (ex: "seatbeltcovers") on the variant or product metadata. Do not infer from names.

- Size-based merging:
  - Use physical size (volume) for deciding “bigger can contain smaller” merges; treat `priority` only as a tie-breaker.

## 11) Pseudocode for Updated Grouping/Merging

```
itemsWithPkg = resolvePackaging(items) // Section 2

// Group by their initially assigned boxId
groups = groupBy(itemsWithPkg, item => item.box.id)

// Sort groups by box size desc (largest first)
sortedGroups = sort(groups, (g) => -volume(g.box.dimensions))

finalGroups = []
for each G in sortedGroups:
  placed = false
  for each T in finalGroups: // T is a larger group (since sorted desc)
    if tagsEqual(T.box.compatibleTags, G.box.compatibleTags):
       // Try to repack G's items into T.box considering T.box.capacity
       if canRepackInto(G.items + T.items, T.box.capacity):
          T.items.push(...G.items)
          placed = true
          break
  if !placed:
     finalGroups.push(G)

// Pack each final group with Greedy single-box packer (Section 4)
perGroupResult = finalGroups.map(packGreedy)

// Aggregate dimensions (Section 6) and weights (Section 7)
return aggregate(perGroupResult)
```

`tagsEqual` should compare canonical tags (single string), not sets.

`canRepackInto` attempts packing virtually and checks boxesUsed * capacity >= total quantity.

## 12) Action Items

- Fix the variant `689b8967...` to use the "seatbeltcovers" box `68a60d59...`.
- Add a canonical tag per variant/product family (e.g., `packagingTag: 'seatbeltcovers'`).
- Add a hard compatibility check during selection; reject or fallback when mismatch.
- (Optional) Switch to per-parcel submission to couriers for accurate rates.
- (Optional) Implement size-based merging logic in the code; keep `priority` only as tie-breaker.

---

This logic matches the intended policy: larger boxes (by physical size) may absorb smaller-box items when tags match and capacity allows, and weights/dimensions are computed per box, with clear, actionable debug to spot misconfigurations quickly.
