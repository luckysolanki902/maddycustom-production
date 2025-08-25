// scripts/fix-inventory-references.js
// Migration script to fix common inventory reference issues
// Run this carefully in your staging environment first!

const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const Option = require('../src/models/Option');
const Inventory = require('../src/models/Inventory');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Fix 1: Create inventory documents for products/options that don't have them
async function createMissingInventoryReferences(dryRun = true) {
  console.log('\n🔧 Creating missing inventory references...');
  
  const session = await mongoose.startSession();
  
  try {
    if (!dryRun) {
      session.startTransaction();
    }

    // Check products without inventory references
    const productsWithoutInventory = await Product.find({
      inventoryData: { $exists: false }
    }).session(session);

    console.log(`Found ${productsWithoutInventory.length} products without inventory references`);

    let createdInventoryCount = 0;

    for (const product of productsWithoutInventory) {
      if (dryRun) {
        console.log(`DRY RUN: Would create inventory for product ${product._id} (${product.name})`);
      } else {
        // Create default inventory document
        const newInventory = new Inventory({
          availableQuantity: 100, // Default quantity - adjust as needed
          reservedQuantity: 0,
          reorderLevel: 50
        });
        
        await newInventory.save({ session });
        
        // Update product to reference new inventory
        await Product.updateOne(
          { _id: product._id },
          { inventoryData: newInventory._id },
          { session }
        );
        
        console.log(`✅ Created inventory ${newInventory._id} for product ${product._id}`);
        createdInventoryCount++;
      }
    }

    // Check options without inventory references
    const optionsWithoutInventory = await Option.find({
      inventoryData: { $exists: false }
    }).session(session);

    console.log(`Found ${optionsWithoutInventory.length} options without inventory references`);

    for (const option of optionsWithoutInventory) {
      if (dryRun) {
        console.log(`DRY RUN: Would create inventory for option ${option._id} (SKU: ${option.sku})`);
      } else {
        // Create default inventory document
        const newInventory = new Inventory({
          availableQuantity: 50, // Default quantity for options - adjust as needed
          reservedQuantity: 0,
          reorderLevel: 25
        });
        
        await newInventory.save({ session });
        
        // Update option to reference new inventory
        await Option.updateOne(
          { _id: option._id },
          { inventoryData: newInventory._id },
          { session }
        );
        
        console.log(`✅ Created inventory ${newInventory._id} for option ${option._id}`);
        createdInventoryCount++;
      }
    }

    if (!dryRun) {
      await session.commitTransaction();
      console.log(`\n✅ Successfully created ${createdInventoryCount} inventory references`);
    } else {
      console.log(`\n💡 DRY RUN: Would create ${productsWithoutInventory.length + optionsWithoutInventory.length} inventory references`);
    }

  } catch (error) {
    if (!dryRun) {
      await session.abortTransaction();
    }
    console.error('❌ Error creating inventory references:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Fix 2: Clean up orphaned inventory documents
async function cleanupOrphanedInventory(dryRun = true) {
  console.log('\n🧹 Cleaning up orphaned inventory documents...');
  
  const session = await mongoose.startSession();
  
  try {
    if (!dryRun) {
      session.startTransaction();
    }

    // Get all inventory IDs
    const allInventoryIds = await Inventory.find({}, { _id: 1 }).session(session);
    const inventoryIdSet = new Set(allInventoryIds.map(inv => inv._id.toString()));

    // Get inventory IDs referenced by products
    const productInventoryRefs = await Product.find(
      { inventoryData: { $exists: true } }, 
      { inventoryData: 1 }
    ).session(session);

    // Get inventory IDs referenced by options
    const optionInventoryRefs = await Option.find(
      { inventoryData: { $exists: true } }, 
      { inventoryData: 1 }
    ).session(session);

    const referencedInventoryIds = new Set([
      ...productInventoryRefs.map(p => p.inventoryData.toString()),
      ...optionInventoryRefs.map(o => o.inventoryData.toString())
    ]);

    // Find orphaned inventory documents
    const orphanedInventoryIds = [...inventoryIdSet].filter(id => !referencedInventoryIds.has(id));

    console.log(`Found ${orphanedInventoryIds.length} orphaned inventory documents`);

    if (orphanedInventoryIds.length > 0) {
      if (dryRun) {
        console.log('DRY RUN: Would delete orphaned inventory documents:', orphanedInventoryIds.slice(0, 5));
        if (orphanedInventoryIds.length > 5) {
          console.log(`... and ${orphanedInventoryIds.length - 5} more`);
        }
      } else {
        const deleteResult = await Inventory.deleteMany(
          { _id: { $in: orphanedInventoryIds } },
          { session }
        );
        console.log(`✅ Deleted ${deleteResult.deletedCount} orphaned inventory documents`);
      }
    }

    if (!dryRun) {
      await session.commitTransaction();
    }

  } catch (error) {
    if (!dryRun) {
      await session.abortTransaction();
    }
    console.error('❌ Error cleaning up orphaned inventory:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Fix 3: Normalize inventory quantities (fix negatives)
async function normalizeInventoryQuantities(dryRun = true) {
  console.log('\n📊 Normalizing inventory quantities...');
  
  const session = await mongoose.startSession();
  
  try {
    if (!dryRun) {
      session.startTransaction();
    }

    // Find inventory documents with negative quantities
    const inventoryWithIssues = await Inventory.find({
      $or: [
        { availableQuantity: { $lt: 0 } },
        { reservedQuantity: { $lt: 0 } }
      ]
    }).session(session);

    console.log(`Found ${inventoryWithIssues.length} inventory documents with negative quantities`);

    let fixedCount = 0;

    for (const inventory of inventoryWithIssues) {
      const updates = {};
      
      if (inventory.availableQuantity < 0) {
        updates.availableQuantity = 0;
        console.log(`Fixing negative available quantity for inventory ${inventory._id}: ${inventory.availableQuantity} -> 0`);
      }
      
      if (inventory.reservedQuantity < 0) {
        updates.reservedQuantity = 0;
        console.log(`Fixing negative reserved quantity for inventory ${inventory._id}: ${inventory.reservedQuantity} -> 0`);
      }

      if (Object.keys(updates).length > 0) {
        if (dryRun) {
          console.log(`DRY RUN: Would update inventory ${inventory._id} with:`, updates);
        } else {
          await Inventory.updateOne(
            { _id: inventory._id },
            { $set: updates },
            { session }
          );
          fixedCount++;
        }
      }
    }

    if (!dryRun) {
      await session.commitTransaction();
      console.log(`✅ Fixed ${fixedCount} inventory documents`);
    } else {
      console.log(`💡 DRY RUN: Would fix ${inventoryWithIssues.length} inventory documents`);
    }

  } catch (error) {
    if (!dryRun) {
      await session.abortTransaction();
    }
    console.error('❌ Error normalizing inventory quantities:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  if (dryRun) {
    console.log('🚨 DRY RUN MODE - No changes will be made');
    console.log('Add --execute flag to actually perform the fixes\n');
  } else {
    console.log('⚡ EXECUTION MODE - Changes will be made to the database\n');
  }

  try {
    await connectToDatabase();
    
    console.log('Starting inventory fixes...\n');
    
    // Run all fixes
    await createMissingInventoryReferences(dryRun);
    await cleanupOrphanedInventory(dryRun);
    await normalizeInventoryQuantities(dryRun);
    
    console.log('\n✅ All inventory fixes completed successfully');
    
    if (dryRun) {
      console.log('\n💡 To actually execute these fixes, run:');
      console.log('node scripts/fix-inventory-references.js --execute');
    }
    
  } catch (error) {
    console.error('\n❌ Fix process failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the fixes if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  createMissingInventoryReferences,
  cleanupOrphanedInventory,
  normalizeInventoryQuantities,
  connectToDatabase
};
