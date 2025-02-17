// src/lib/constants/shiprocketStatusMapping.js
export const statusMapping = {
  // Shipped / in-transit statuses
  'shipped': 'shipped',
  'out for delivery': 'shipped',
  'in transit': 'shipped',
  'reached at destination hub': 'shipped',
  'pickup rescheduled': 'shipped',

  // Delivered statuses
  'delivered': 'delivered',
  'fulfilled': 'delivered',
  'self fulfilled': 'delivered',

  // Partially delivered
  'partial delivered': 'partiallyDelivered',

  // Returned (RTO-related statuses and returns)
  'rto initiated': 'returned',
  'rto delivered': 'returned',
  'rto acknowledged': 'returned',
  'rto ndr': 'returned',
  'rto ofd': 'returned',
  'rto in intransit': 'returned',
  'reached back at seller city': 'returned',

  // Lost / destroyed / damaged
  'lost': 'lost',
  'destroyed': 'lost',
  'damaged': 'lost',
  'disposed off': 'lost',
  'untraceable': 'lost',

  // Cancelled / terminal errors
  'canceled': 'cancelled',
  'cancelled': 'cancelled',
  'cancelled before dispatched': 'cancelled',
  'pickup error': 'cancelled',
  'misrouted': 'cancelled',
  'handover exception': 'cancelled',
  'packed exception': 'cancelled',
  'rto lock': 'cancelled',
  'qc failed': 'cancelled',
  'issue related to the recipient': 'cancelled',

  // Still “processing” mid-cycle statuses
  'cancellation requested': 'processing',
  'out for pickup': 'processing',
  'delayed': 'processing',
  'pickup booked': 'processing',
  'shipment booked': 'processing',
  'picked up': 'processing',
  'reached warehouse': 'processing',
  'custom cleared': 'processing',
  'in flight': 'processing',
  'handover to courier': 'processing',
  'in transit overseas': 'processing',
  'connection aligned': 'processing',
  'reached overseas warehouse': 'processing',
  'custom cleared overseas': 'processing',
  'box packing': 'processing',
  'processed at warehouse': 'processing',
  'fc allocated': 'processing',
  'picklist generated': 'processing',
  'ready to pack': 'processing',
  'packed': 'processing',
  'fc manifest generated': 'processing',
};
