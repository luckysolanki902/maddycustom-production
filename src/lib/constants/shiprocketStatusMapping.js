// src/lib/constants/shiprocketStatusMapping.js
export const statusMapping = {
  // Order Created Group
  "New": "orderCreated", // 1: New

  // Processing Group (Pre-shipping / preparation & some cancellation requests)
  "Invoiced": "processing",            // 2: Invoiced
  "Ready To Ship": "processing",         // 3: Ready To Ship
  "Pickup Scheduled": "processing",      // 4: Pickup Scheduled
  "Unmapped": "processing",              // 10: Unmapped
  "Pickup Queue": "processing",          // 12: Pickup Queue
  "Pickup Rescheduled": "processing",    // 13: Pickup Rescheduled
  "Cancellation Requested": "processing",// 18: Cancellation Requested
  "Return Cancellation Requested": "processing", // 29: Return Cancellation Requested
  "Out For Pickup": "processing",        // 34: Out For Pickup
  "Box Packing": "processing",           // 69: Box Packing
  "Pickup Booked": "processing",         // 70: Pickup Booked
  "DARKSTORE SCHEDULED": "processing",   // 71: DARKSTORE SCHEDULED
  "Allocation in Progress": "processing",// 72: Allocation in Progress
  "FC Allocated": "processing",          // 73: FC Allocated
  "Picklist Generated": "processing",    // 74: Picklist Generated
  "Ready to Pack": "processing",         // 75: Ready to Pack
  "Packed": "processing",                // 76: Packed
  "FC MANIFEST GENERATED": "processing", // 80: FC MANIFEST GENERATED
  "PROCESSED AT WAREHOUSE": "processing",// 81: PROCESSED AT WAREHOUSE
  "Reached Warehouse": "processing",     // 58: Reached Warehouse

  // Shipped Group (Initial shipping event)
  "Shipped": "shipped",                  // 6: Shipped

  // On The Way Group (After pickup – actively in transit toward delivery)
  "Out for Delivery": "onTheWay",        // 19: Out for Delivery
  "In Transit": "onTheWay",              // 20: In Transit
  "Reached Destination Hub": "onTheWay", // 43: Reached Destination Hub
  "Picked Up": "onTheWay",               // 51: Picked Up
  "Delivery Delayed": "onTheWay",        // 37: Delivery Delayed
  "Custom Cleared": "onTheWay",          // 59: Custom Cleared
  "In Flight": "onTheWay",               // 60: In Flight
  "Handover to Courier": "onTheWay",     // 61: Handover to Courier
  "Booked": "onTheWay",                  // 62: Booked
  "In Transit Overseas": "onTheWay",     // 64: In Transit Overseas
  "Connection Aligned": "onTheWay",      // 65: Connection Aligned
  "Reached Overseas Warehouse": "onTheWay", // 66: Reached Overseas Warehouse
  "Custom Cleared Overseas": "onTheWay", // 67: Custom Cleared Overseas

  // Partially Delivered Group
  "Partial Delivered": "partiallyDelivered", // 38: Partial Delivered

  // Delivered Group
  "Delivered": "delivered",             // 7: Delivered
  "Fulfilled": "delivered",             // 41: Fulfilled
  "Self Fulfilled": "delivered",        // 52: Self Fulfilled

  // Return Initiated Group (Return process is underway)
  "RTO Initiated": "returnInitiated",       // 15: RTO Initiated
  "Return Pending": "returnInitiated",      // 21: Return Pending
  "Return Initiated": "returnInitiated",      // 22: Return Initiated
  "Return Pickup Queued": "returnInitiated",  // 23: Return Pickup Queued
  "Return Pickup Error": "returnInitiated",   // 24: Return Pickup Error
  "Return In Transit": "returnInitiated",     // 25: Return In Transit
  "Return Pickup Generated": "returnInitiated",// 28: Return Pickup Generated
  "Return Pickup Rescheduled": "returnInitiated",// 31: Return Pickup Rescheduled
  "Return Picked Up": "returnInitiated",      // 32: Return Picked Up
  "RTO_OFD": "returnInitiated",             // 45: RTO_OFD
  "RTO_NDR": "returnInitiated",             // 46: RTO_NDR
  "Return Out For Pickup": "returnInitiated", // 47: Return Out For Pickup
  "Return Out For Delivery": "returnInitiated",// 48: Return Out For Delivery
  "Return Pickup Exception": "returnInitiated",// 49: Return Pickup Exception
  "Return Undelivered": "returnInitiated",    // 50: Return Undelivered
  "RTO In-Transit": "returnInitiated",        // 55: RTO In-Transit

  // Returned Group (Return process completed)
  "Returned": "returned",               // 9: Returned
  "RTO Delivered": "returned",          // 16: RTO Delivered
  "RTO Acknowledged": "returned",       // 17: RTO Acknowledged
  "Return Delivered": "returned",       // 26: Return Delivered
  "RETURN ACKNOWLEGED": "returned",     // 68: RETURN ACKNOWLEGED
  "REACHED_BACK_AT_SELLER_CITY": "returned", // 90: REACHED_BACK_AT_SELLER_CITY

  // Lost Group
  "Lost": "lost",                       // 33: Lost
  "Destroyed": "lost",                  // 39: Destroyed
  "Damaged": "lost",                    // 40: Damaged
  "Disposed Off": "lost",               // 53: Disposed Off
  "UNTRACEABLE": "lost",                // 88: UNTRACEABLE

  // Cancelled Group
  "Canceled": "cancelled",              // 5: Canceled
  "ePayment Failed": "cancelled",       // 8: ePayment Failed
  "Unfulfillable": "cancelled",         // 11: Unfulfillable
  "Pickup Error": "cancelled",          // 14: Pickup Error
  "Return Cancelled": "cancelled",      // 27: Return Cancelled
  "Return Pickup Cancelled": "cancelled", // 30: Return Pickup Cancelled
  "Archived": "cancelled",              // 42: Archived
  "Misrouted": "cancelled",             // 44: Misrouted
  "Pickup Exception": "cancelled",      // 35: Pickup Exception
  "Undelivered": "cancelled",           // 36: Undelivered
  "Canceled before Dispatched": "cancelled", // 54: Canceled before Dispatched
  "QC Failed": "cancelled",             // 57: QC Failed
  "PACKED EXCEPTION": "cancelled",      // 82: PACKED EXCEPTION
  "HANDOVER EXCEPTION": "cancelled",    // 83: HANDOVER EXCEPTION
  "RTO_LOCK": "cancelled",              // 87: RTO_LOCK
  "ISSUE_RELATED_TO_THE_RECIPIENT": "cancelled" // 89: ISSUE_RELATED_TO_THE_RECIPIENT
};
