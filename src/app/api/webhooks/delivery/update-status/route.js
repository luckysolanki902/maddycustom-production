// app/api/webhooks/delivery/update-status/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';
import { statusMapping } from '@/lib/constants/shiprocketStatusMapping';
import Inventory from '@/models/Inventory';
import Option from '@/models/Option';
import Product from '@/models/Product';

// Helper function to implement retry logic for critical operations
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Operation failed on attempt ${attempt}/${maxRetries}:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

// Helper: Restore inventory for cancelled orders.
// This adds back the sold quantity: availableQuantity increases by qty and reservedQuantity decreases by qty.
async function restoreInventory(inventoryId, qty, session) {
  try {
    // First verify the inventory document exists
    const inventoryDoc = await mongoose.model('Inventory').findById(inventoryId).session(session);
    if (!inventoryDoc) {
      console.error(`Inventory document not found for ID: ${inventoryId}`);
      return { success: false, error: 'Inventory document not found' };
    }

    // Check if we have enough reserved quantity to restore
    if (inventoryDoc.reservedQuantity < qty) {
      console.warn(`Insufficient reserved quantity for inventory ${inventoryId}. Reserved: ${inventoryDoc.reservedQuantity}, Requested to restore: ${qty}`);
      // Continue with available reserved quantity
      qty = inventoryDoc.reservedQuantity;
    }

    const result = await mongoose.model('Inventory').updateOne(
      { _id: inventoryId },
      {
        $inc: {
          availableQuantity: qty,
          reservedQuantity: -qty,
        },
      },
      { session }
    );

    if (result.modifiedCount > 0) {
      console.log(`Successfully restored inventory for ${inventoryId}: +${qty} available, -${qty} reserved`);
      return { success: true, result, quantityProcessed: qty };
    } else {
      console.error(`Failed to update inventory for ${inventoryId}`);
      return { success: false, error: 'No documents modified', result };
    }
  } catch (error) {
    console.error(`Error restoring inventory for ${inventoryId}:`, error);
    return { success: false, error: error.message };
  }
}

// Helper: Clear reserved inventory for delivered orders.
// This subtracts the quantity from reservedQuantity only.
async function clearReservedInventory(inventoryId, qty, session) {
  try {
    // First verify the inventory document exists
    const inventoryDoc = await mongoose.model('Inventory').findById(inventoryId).session(session);
    if (!inventoryDoc) {
      console.error(`Inventory document not found for ID: ${inventoryId}`);
      return { success: false, error: 'Inventory document not found' };
    }

    // Check if we have enough reserved quantity to clear
    if (inventoryDoc.reservedQuantity < qty) {
      console.warn(`Insufficient reserved quantity for inventory ${inventoryId}. Reserved: ${inventoryDoc.reservedQuantity}, Requested to clear: ${qty}`);
      // Continue with available reserved quantity
      qty = inventoryDoc.reservedQuantity;
    }

    const result = await mongoose.model('Inventory').updateOne(
      { _id: inventoryId },
      {
        $inc: {
          reservedQuantity: -qty,
        },
      },
      { session }
    );

    if (result.modifiedCount > 0) {
      console.log(`Successfully cleared reserved inventory for ${inventoryId}: -${qty} reserved`);
      return { success: true, result, quantityProcessed: qty };
    } else {
      console.error(`Failed to update inventory for ${inventoryId}`);
      return { success: false, error: 'No documents modified', result };
    }
  } catch (error) {
    console.error(`Error clearing reserved inventory for ${inventoryId}:`, error);
    return { success: false, error: error.message };
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  const webhookStartTime = Date.now();
  
  // Validate security token
  const receivedToken = request.headers.get('x-api-key');
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (receivedToken !== expectedToken) {
    console.error('Invalid security token received in webhook');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Read body exactly once so we can reuse for error logging without re-reading stream
    const rawBody = await request.text();
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error('Invalid JSON payload for delivery webhook:', e.message);
      await session.abortTransaction();
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    console.log(`Webhook received payload:`, { 
      order_id: payload.order_id, 
      current_status: payload.current_status,
      timestamp: new Date().toISOString()
    });

    const { order_id, current_status } = payload;
    if (!order_id || !current_status) {
      console.error('Missing required fields in webhook payload:', payload);
      await session.abortTransaction();
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Look up the order by _id if valid, otherwise by shiprocketOrderId.
    let order;
    if (mongoose.Types.ObjectId.isValid(order_id)) {
      order = await Order.findById(order_id).session(session);
      console.log(`Looking up order by MongoDB _id: ${order_id}`);
    } else {
      order = await Order.findOne({ shiprocketOrderId: order_id }).session(session);
      console.log(`Looking up order by shiprocketOrderId: ${order_id}`);
    }

    if (!order) {
      console.error(`Order not found for identifier: ${order_id}`);
      await session.abortTransaction();
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    console.log(`Found order: ${order._id}, current delivery status: ${order.deliveryStatus}`);

    // Normalize and map the current status
    const normalizedStatus = current_status.toLowerCase().replace(/[-_]/g, ' ').trim();
    const mappedStatus = statusMapping[normalizedStatus] || 'unknown';
    
    console.log(`Status mapping: "${current_status}" -> "${normalizedStatus}" -> "${mappedStatus}"`);

    // Check if the status has actually changed to avoid duplicate processing
    if (order.deliveryStatus === mappedStatus && order.actualDeliveryStatus === current_status) {
      console.log(`Order ${order._id} already has status ${mappedStatus}. Skipping duplicate processing.`);
      await session.commitTransaction();
      return NextResponse.json({ 
        message: 'Order status unchanged, no processing needed.',
        currentStatus: mappedStatus 
      }, { status: 200 });
    }

    //// Determine inventory action based on mapped status
    // let inventoryAction = null;
    // if (mappedStatus === 'cancelled') {
    //   inventoryAction = 'restore';
    //   console.log(`Order cancelled - will restore inventory`);
    // } else if (mappedStatus === 'delivered') {
    //   inventoryAction = 'clearReserved';
    //   console.log(`Order delivered - will clear reserved inventory`);
    // } else {
    //   console.log(`Status "${mappedStatus}" does not require inventory adjustment`);
    // }

    // // Track inventory processing results
    // const inventoryResults = {
    //   processed: [],
    //   failed: [],
    //   skipped: []
    // };

    //// Process inventory adjustments if needed
    // if (inventoryAction && order.items && order.items.length > 0) {
    //   console.log(`Processing inventory for ${order.items.length} items`);
      
    //   for (const [index, item] of order.items.entries()) {
    //     const itemLog = {
    //       index,
    //       sku: item.sku,
    //       quantity: item.quantity,
    //       hasOption: !!(item.Option || item.option),
    //       hasProduct: !!item.product
    //     };

    //     try {
          //// Check for Option reference (both legacy uppercase and new lowercase)
          // if (item.Option || item.option) {
          //   const optionId = item.Option || item.option;
          //   console.log(`Processing item ${index} with option: ${optionId}`);
            
          //   const optionDoc = await Option.findById(optionId).session(session);
          //   if (optionDoc?.inventoryData) {
          //     console.log(`Found option with inventory reference: ${optionDoc.inventoryData}`);
              
          //     let result;
          //     if (inventoryAction === 'restore') {
          //       result = await restoreInventory(optionDoc.inventoryData, item.quantity, session);
          //     } else if (inventoryAction === 'clearReserved') {
          //       result = await clearReservedInventory(optionDoc.inventoryData, item.quantity, session);
          //     }
              
          //     if (result.success) {
          //       inventoryResults.processed.push({
          //         ...itemLog,
          //         inventoryId: optionDoc.inventoryData,
          //         action: inventoryAction,
          //         quantityProcessed: result.quantityProcessed
          //       });
          //     } else {
          //       inventoryResults.failed.push({
          //         ...itemLog,
          //         inventoryId: optionDoc.inventoryData,
          //         error: result.error,
          //         action: inventoryAction
          //       });
          //       console.error(`Failed inventory operation for option ${optionId}:`, result.error);
          //     }
          //   } else {
          //     inventoryResults.skipped.push({
          //       ...itemLog,
          //       reason: `Option ${optionId} has no inventory reference`,
          //       optionExists: !!optionDoc
          //     });
          //     console.warn(`Option ${optionId} ${optionDoc ? 'exists but has no inventory reference' : 'not found'}`);
          //   }
          // } 
          // Check for direct Product reference
      //     else if (item.product) {
      //       const productId = item.product;
      //       console.log(`Processing item ${index} with product: ${productId}`);
            
      //       const productDoc = await Product.findById(productId).session(session);
      //       if (productDoc?.inventoryData) {
      //         console.log(`Found product with inventory reference: ${productDoc.inventoryData}`);
              
      //         let result;
      //         if (inventoryAction === 'restore') {
      //           result = await restoreInventory(productDoc.inventoryData, item.quantity, session);
      //         } else if (inventoryAction === 'clearReserved') {
      //           result = await clearReservedInventory(productDoc.inventoryData, item.quantity, session);
      //         }
              
      //         if (result.success) {
      //           inventoryResults.processed.push({
      //             ...itemLog,
      //             inventoryId: productDoc.inventoryData,
      //             action: inventoryAction,
      //             quantityProcessed: result.quantityProcessed
      //           });
      //         } else {
      //           inventoryResults.failed.push({
      //             ...itemLog,
      //             inventoryId: productDoc.inventoryData,
      //             error: result.error,
      //             action: inventoryAction
      //           });
      //           console.error(`Failed inventory operation for product ${productId}:`, result.error);
      //         }
      //       } else {
      //         inventoryResults.skipped.push({
      //           ...itemLog,
      //           reason: `Product ${productId} has no inventory reference`,
      //           productExists: !!productDoc
      //         });
      //         console.warn(`Product ${productId} ${productDoc ? 'exists but has no inventory reference' : 'not found'}`);
      //       }
      //     } else {
      //       inventoryResults.skipped.push({
      //         ...itemLog,
      //         reason: 'No option or product reference found'
      //       });
      //       console.warn(`Order item ${index} has neither option nor product reference`);
      //     }
      //   } catch (error) {
      //     inventoryResults.failed.push({
      //       ...itemLog,
      //       error: error.message,
      //       action: inventoryAction
      //     });
      //     console.error(`Error processing inventory for item ${index}:`, error);
      //   }
      // }
      
      //// Log summary of inventory processing
    //   console.log(`Inventory processing summary for order ${order._id}:`, {
    //     total: order.items.length,
    //     processed: inventoryResults.processed.length,
    //     failed: inventoryResults.failed.length,
    //     skipped: inventoryResults.skipped.length
    //   });
      
    //   // If there were failures but some successes, continue but log warnings
    //   if (inventoryResults.failed.length > 0) {
    //     console.warn(`${inventoryResults.failed.length} inventory operations failed:`, inventoryResults.failed);
    //   }
    // }

    // Update order delivery status
    const previousStatus = order.deliveryStatus;
    const previousActualStatus = order.actualDeliveryStatus;
    
    order.deliveryStatus = mappedStatus;
    order.actualDeliveryStatus = current_status;
    
    // Retry save in case of transient writeConflict (MongoServerError code 112 or writeConflict message)
    await withRetry(async () => {
      try {
        await order.save({ session });
      } catch (err) {
        if (err?.code === 112 || /write conflict/i.test(err?.message)) {
          console.warn('Write conflict on order.save(), retrying...');
          throw err; // trigger retry
        }
        throw err; // non-retryable propagates immediately
      }
    }, 4, 250);
    
    console.log(`Order ${order._id} status updated: ${previousStatus} -> ${mappedStatus}`);

    await session.commitTransaction();
    
    const processingTime = Date.now() - webhookStartTime;
    console.log(`Webhook processing completed in ${processingTime}ms for order ${order._id}`);

    return NextResponse.json({ 
      message: 'Order updated successfully.',
      orderId: order._id,
      statusChange: {
        from: previousStatus,
        to: mappedStatus,
        actualStatus: current_status
      },
      inventorySummary: {
        processed: inventoryResults.processed.length,
        failed: inventoryResults.failed.length,
        skipped: inventoryResults.skipped.length
      },
      processingTimeMs: processingTime
    }, { status: 200 });

  } catch (error) {
    await session.abortTransaction();
    console.error('Webhook error during processing:', {
      error: error.message,
      stack: error.stack,
      payload: rawBody?.substring(0, 5000) || 'No body captured'
    });
    
    const isWriteConflict = /write conflict/i.test(error.message) || error.code === 112;
    return NextResponse.json({ 
      error: isWriteConflict ? 'Write conflict, please retry (transient)' : 'Internal Server Error.',
      transient: !!isWriteConflict,
      timestamp: new Date().toISOString()
    }, { status: isWriteConflict ? 409 : 500 });
  } finally {
    session.endSession();
  }
}
