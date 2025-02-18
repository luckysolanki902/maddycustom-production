export const statusMapping = {
  // Order Created Group
  "new": "orderCreated", // 1: New

  // Processing Group (Pre-shipping / preparation & some cancellation requests)
  "invoiced": "processing",                   // 2: Invoiced
  "ready to ship": "processing",                // 3: Ready To Ship
  "pickup scheduled": "processing",             // 4: Pickup Scheduled
  "unmapped": "processing",                     // 10: Unmapped
  "pickup queue": "processing",                 // 12: Pickup Queue
  "pickup rescheduled": "processing",           // 13: Pickup Rescheduled
  "cancellation requested": "processing",       // 18: Cancellation Requested
  "return cancellation requested": "processing",// 29: Return Cancellation Requested
  "out for pickup": "processing",               // 34: Out For Pickup
  "pickup exception": "processing",             // 35: Pickup Exception
  "box packing": "processing",                  // 69: Box Packing
  "pickup booked": "processing",                // 70: Pickup Booked
  "darkstore scheduled": "processing",          // 71: DARKSTORE SCHEDULED
  "allocation in progress": "processing",       // 72: Allocation in Progress
  "fc allocated": "processing",                 // 73: FC Allocated
  "picklist generated": "processing",           // 74: Picklist Generated
  "ready to pack": "processing",                // 75: Ready to Pack
  "packed": "processing",                       // 76: Packed
  "fc manifest generated": "processing",        // 80: FC MANIFEST GENERATED
  "processed at warehouse": "processing",       // 81: PROCESSED AT WAREHOUSE
  "reached warehouse": "processing",            // 58: Reached Warehouse

  // Shipped Group (Initial shipping event)
  "shipped": "shipped",                         // 6: Shipped

  // On The Way Group (After pickup – actively in transit toward delivery)
  "out for delivery": "onTheWay",               // 19: Out for Delivery
  "in transit": "onTheWay",                     // 20: In Transit
  "reached destination hub": "onTheWay",        // 43: Reached Destination Hub
  "picked up": "onTheWay",                      // 51: Picked Up
  "delayed": "onTheWay",               // 37: Delivery Delayed
  "delivery delayed": "onTheWay",               // 37: Delivery Delayed
  "custom cleared": "onTheWay",                 // 59: Custom Cleared
  "in flight": "onTheWay",                      // 60: In Flight
  "handover to courier": "onTheWay",            // 61: Handover to Courier
  "booked": "onTheWay",                         // 62: Booked
  "shipment booked": "onTheWay",                // 62: Booked
  "in transit overseas": "onTheWay",            // 64: In Transit Overseas
  "in transit en route": "onTheWay",            // xx: In Transit En Route
  "in transit at destination hub": "onTheWay",  // xx: In Transit At Destination Hub
  "connection aligned": "onTheWay",             // 65: Connection Aligned
  "reached overseas warehouse": "onTheWay",     // 66: Reached Overseas Warehouse
  "custom cleared overseas": "onTheWay",        // 67: Custom Cleared Overseas

  // Partially Delivered Group
  "partial delivered": "partiallyDelivered",    // 38: Partial Delivered

  // Delivered Group
  "delivered": "delivered",                     // 7: Delivered
  "fulfilled": "delivered",                     // 41: Fulfilled
  "self fulfilled": "delivered",                // 52: Self Fulfilled

  // Return Initiated Group (Return process is underway)
  "rto initiated": "returnInitiated",           // 15: RTO Initiated
  "return pending": "returnInitiated",          // 21: Return Pending
  "return initiated": "returnInitiated",        // 22: Return Initiated
  "return pickup queued": "returnInitiated",    // 23: Return Pickup Queued
  "return pickup error": "returnInitiated",     // 24: Return Pickup Error
  "return in transit": "returnInitiated",       // 25: Return In Transit
  "return pickup generated": "returnInitiated", // 28: Return Pickup Generated
  "return pickup rescheduled": "returnInitiated",// 31: Return Pickup Rescheduled
  "return picked up": "returnInitiated",        // 32: Return Picked Up
  "rto ofd": "returnInitiated",                 // 45: RTO_OFD
  "rto ndr": "returnInitiated",                 // 46: RTO_NDR
  "return out for pickup": "returnInitiated",   // 47: Return Out For Pickup
  "return out for delivery": "returnInitiated", // 48: Return Out For Delivery
  "return pickup exception": "returnInitiated", // 49: Return Pickup Exception
  "return undelivered": "returnInitiated",       // 50: Return Undelivered
  "rto in transit": "returnInitiated",          // 55: RTO In Transit

  // Returned Group (Return process completed)
  "returned": "returned",                       // 9: Returned
  "rto delivered": "returned",                  // 16: RTO Delivered
  "rto acknowledged": "returned",               // 17: RTO Acknowledged
  "return delivered": "returned",               // 26: Return Delivered
  "return acknowleged": "returned",             // 68: RETURN ACKNOWLEGED
  "reached back at seller city": "returned",    // 90: REACHED_BACK_AT_SELLER_CITY

  // Lost Group
  "lost": "lost",                               // 33: Lost
  "destroyed": "lost",                          // 39: Destroyed
  "damaged": "lost",                            // 40: Damaged
  "disposed off": "lost",                       // 53: Disposed Off
  "untraceable": "lost",                        // 88: UNTRACEABLE

  // Cancelled Group
  "canceled": "cancelled",                      // 5: Canceled
  "cancelled": "cancelled",                      // 5: Canceled

  // Unknown Group
  "epayment failed": "unknown",                 // 8: ePayment Failed
  "pickup error": "unknown",                    // 14: Pickup Error
  "return cancelled": "unknown",                // 27: Return Cancelled
  "return pickup cancelled": "unknown",         // 30: Return Pickup Cancelled
  "archived": "unknown",                        // 42: Archived
  "misrouted": "unknown",                       // 44: Misrouted
  "canceled before dispatched": "unknown",      // 54: Canceled before Dispatched
  "cancelled before dispatched": "unknown",     // 54: Canceled before Dispatched
  "qc failed": "unknown",                       // 57: QC Failed
  "packed exception": "unknown",                // 82: PACKED EXCEPTION
  "handover exception": "unknown",              // 83: HANDOVER EXCEPTION
  "rto lock": "unknown",                        // 87: RTO_LOCK
  "issue related to the recipient": "unknown",  // 89: ISSUE_RELATED_TO_THE_RECIPIENT
  
// Undelivered Group
"unfulfillable": "undelivered",                 // 11: Unfulfillable
"undelivered": "undelivered",                   // 36: Undelivered

};

