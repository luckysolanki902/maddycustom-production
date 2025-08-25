// scripts/debug-inventory-issues.js
// Script to identify potential inventory and SKU issues
// Run this in your Node.js environment or MongoDB shell equivalent

const mongoose = require('mongoose');
require('dotenv').config();

// Import your models
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const Option = require('../src/models/Option');
const Inventory = require('../src/models/Inventory');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function analyzeInventoryIssues() {
  console.log('🔍 Analyzing potential inventory and SKU issues...\n');

  // 1. Find orders with delivered/cancelled status that might need inventory updates
  console.log('1. Checking orders with delivery status requiring inventory updates...');
  const ordersNeedingInventoryUpdate = await Order.find({
    deliveryStatus: { $in: ['delivered', 'cancelled'] },
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  }).lean();

  console.log(`Found ${ordersNeedingInventoryUpdate.length} orders with delivered/cancelled status in last 30 days`);

  // 2. Check for orders with missing inventory references
  console.log('\n2. Checking for orders with items missing inventory references...');
  
  let ordersWithMissingInventory = [];
  let itemsWithoutInventory = 0;
  
  for (const order of ordersNeedingInventoryUpdate) {
    const orderIssues = {
      orderId: order._id,
      items: []
    };

    for (const [index, item] of order.items.entries()) {
      let hasInventoryRef = false;
      let itemIssue = {
        index,
        sku: item.sku,
        quantity: item.quantity,
        issues: []
      };

      // Check option-based items
      if (item.option || item.Option) {
        const optionId = item.option || item.Option;
        try {
          const option = await Option.findById(optionId).lean();
          if (option) {
            if (option.inventoryData) {
              hasInventoryRef = true;
              // Verify inventory document exists
              const inventory = await Inventory.findById(option.inventoryData).lean();
              if (!inventory) {
                itemIssue.issues.push('Option references non-existent inventory document');
              }
            } else {
              itemIssue.issues.push('Option has no inventory reference');
            }
          } else {
            itemIssue.issues.push('Option document not found');
          }
        } catch (error) {
          itemIssue.issues.push(`Error checking option: ${error.message}`);
        }
      }
      // Check product-based items
      else if (item.product) {
        try {
          const product = await Product.findById(item.product).lean();
          if (product) {
            if (product.inventoryData) {
              hasInventoryRef = true;
              // Verify inventory document exists
              const inventory = await Inventory.findById(product.inventoryData).lean();
              if (!inventory) {
                itemIssue.issues.push('Product references non-existent inventory document');
              }
            } else {
              itemIssue.issues.push('Product has no inventory reference');
            }
          } else {
            itemIssue.issues.push('Product document not found');
          }
        } catch (error) {
          itemIssue.issues.push(`Error checking product: ${error.message}`);
        }
      } else {
        itemIssue.issues.push('No option or product reference');
      }

      if (!hasInventoryRef || itemIssue.issues.length > 0) {
        itemsWithoutInventory++;
        orderIssues.items.push(itemIssue);
      }
    }

    if (orderIssues.items.length > 0) {
      ordersWithMissingInventory.push(orderIssues);
    }
  }

  console.log(`Found ${itemsWithoutInventory} items without proper inventory references across ${ordersWithMissingInventory.length} orders`);

  // 3. Check for inventory inconsistencies
  console.log('\n3. Checking for inventory inconsistencies...');
  
  const inventoryDocs = await Inventory.find({}).lean();
  const inventoryIssues = [];
  
  for (const inv of inventoryDocs) {
    const issues = [];
    
    if (inv.reservedQuantity < 0) {
      issues.push('Negative reserved quantity');
    }
    
    if (inv.availableQuantity < 0) {
      issues.push('Negative available quantity');
    }
    
    if (inv.reservedQuantity > (inv.availableQuantity + inv.reservedQuantity)) {
      issues.push('Reserved quantity exceeds total inventory');
    }
    
    if (issues.length > 0) {
      inventoryIssues.push({
        inventoryId: inv._id,
        availableQuantity: inv.availableQuantity,
        reservedQuantity: inv.reservedQuantity,
        issues
      });
    }
  }

  console.log(`Found ${inventoryIssues.length} inventory documents with inconsistencies`);

  // 4. Find duplicate SKUs
  console.log('\n4. Checking for duplicate SKUs...');
  
  const productSkus = await Product.find({ sku: { $exists: true, $ne: null } }, { sku: 1 }).lean();
  const optionSkus = await Option.find({ sku: { $exists: true, $ne: null } }, { sku: 1 }).lean();
  
  const allSkus = [
    ...productSkus.map(p => ({ sku: p.sku, type: 'product', id: p._id })),
    ...optionSkus.map(o => ({ sku: o.sku, type: 'option', id: o._id }))
  ];
  
  const skuCounts = {};
  for (const item of allSkus) {
    if (!skuCounts[item.sku]) {
      skuCounts[item.sku] = [];
    }
    skuCounts[item.sku].push(item);
  }
  
  const duplicateSkus = Object.entries(skuCounts).filter(([sku, items]) => items.length > 1);
  
  console.log(`Found ${duplicateSkus.length} duplicate SKUs`);

  // Generate detailed report
  console.log('\n📊 DETAILED REPORT');
  console.log('=================');
  
  if (ordersWithMissingInventory.length > 0) {
    console.log('\n❌ ORDERS WITH MISSING INVENTORY REFERENCES:');
    ordersWithMissingInventory.slice(0, 10).forEach(order => {
      console.log(`  Order ${order.orderId}:`);
      order.items.forEach(item => {
        console.log(`    - Item ${item.index} (SKU: ${item.sku}): ${item.issues.join(', ')}`);
      });
    });
    if (ordersWithMissingInventory.length > 10) {
      console.log(`    ... and ${ordersWithMissingInventory.length - 10} more orders`);
    }
  }
  
  if (inventoryIssues.length > 0) {
    console.log('\n⚠️  INVENTORY INCONSISTENCIES:');
    inventoryIssues.slice(0, 10).forEach(inv => {
      console.log(`  Inventory ${inv.inventoryId}: Available=${inv.availableQuantity}, Reserved=${inv.reservedQuantity}`);
      console.log(`    Issues: ${inv.issues.join(', ')}`);
    });
    if (inventoryIssues.length > 10) {
      console.log(`    ... and ${inventoryIssues.length - 10} more inventory issues`);
    }
  }
  
  if (duplicateSkus.length > 0) {
    console.log('\n🔄 DUPLICATE SKUS:');
    duplicateSkus.slice(0, 10).forEach(([sku, items]) => {
      console.log(`  SKU "${sku}" found in:`);
      items.forEach(item => {
        console.log(`    - ${item.type} ${item.id}`);
      });
    });
    if (duplicateSkus.length > 10) {
      console.log(`    ... and ${duplicateSkus.length - 10} more duplicate SKUs`);
    }
  }

  // Provide recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('==================');
  
  if (ordersWithMissingInventory.length > 0) {
    console.log('1. Review and fix products/options without inventory references');
    console.log('2. Consider running a data migration to ensure all items have inventory tracking');
  }
  
  if (inventoryIssues.length > 0) {
    console.log('3. Fix negative quantities in inventory documents');
    console.log('4. Review inventory logic to prevent overselling');
  }
  
  if (duplicateSkus.length > 0) {
    console.log('5. Resolve duplicate SKUs to ensure unique identification');
  }
  
  console.log('6. Consider implementing stricter validation in product/option creation');
  console.log('7. Add monitoring alerts for inventory inconsistencies');

  return {
    ordersWithMissingInventory,
    inventoryIssues,
    duplicateSkus,
    summary: {
      totalOrdersChecked: ordersNeedingInventoryUpdate.length,
      ordersWithIssues: ordersWithMissingInventory.length,
      itemsWithoutInventory,
      inventoryInconsistencies: inventoryIssues.length,
      duplicateSkuCount: duplicateSkus.length
    }
  };
}

// Main execution function
async function main() {
  try {
    await connectToDatabase();
    const results = await analyzeInventoryIssues();
    
    // Optional: Save results to file
    const fs = require('fs');
    const reportPath = './inventory-analysis-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Analysis failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the analysis if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  analyzeInventoryIssues,
  connectToDatabase
};
