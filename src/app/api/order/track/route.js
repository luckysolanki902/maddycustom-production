import connectToDatabase from '@/lib/middleware/connectToDb';
import { trackShiprocketOrder } from '@/lib/utils/shiprocket';
import Order from '@/models/Order';
import { NextResponse } from 'next/server';
import User from '@/models/User';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    // Verify if the order exists and check the delivery status
    let order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: 'Order not found. Please check your Order ID and try again.' }, { status: 404 });
    }

    // If belongs to a group, gather sibling summary (non-blocking for downstream tracking merge)
    let groupSummary = null;
    if (order.groupId) {
      const siblings = await Order.find({ groupId: order.groupId }).select('_id partitionKey paymentStatus deliveryStatus shiprocketOrderId totalAmount paymentDetails.amountDueCod paymentDetails.amountDueOnline isGroupPrimary').lean();
      const aggregate = siblings.reduce((acc, s) => {
        acc.total += s.totalAmount; acc.dueCod += s.paymentDetails.amountDueCod; acc.dueOnline += s.paymentDetails.amountDueOnline; return acc;
      }, { total: 0, dueCod: 0, dueOnline: 0 });
      groupSummary = { groupId: order.groupId, orders: siblings, aggregate };
      // prefer primary order for tracking if shiprocket missing here
    }
    
    if (order.deliveryStatus === 'pending') {
      // Return a more informative response for pending orders
      // Format the address from the order object
      const formattedAddress = order.address ? 
        `${order.address.addressLine1}${order.address.addressLine2 ? ', ' + order.address.addressLine2 : ''}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}` : 
        'Address pending';

      // Get user information for email
      let userEmail = null;
      try {
        await order.populate('user');
        userEmail = order.user?.email || null;      } catch (err) {
        console.log('Error fetching user email:', err);
      }
      
  return NextResponse.json({
        message: 'Your order is still being processed. We\'ll update the tracking once it ships!',
        trackingData: {
          orderId: orderId,
          status: 'Processing',
          name: order.address?.receiverName || 'Customer',
          address: formattedAddress,
          phoneNumber: order.address?.receiverPhoneNumber || 'Not provided',
          email: userEmail,
          shipmentDate: 'Processing',
          expectedDelivery: 'Estimated 5-7 business days from shipping',
          phoneNumber: order.address?.receiverPhoneNumber || 'Not provided',
          email: userEmail,
          shipmentDate: 'Processing',
          expectedDelivery: 'Estimated 5-7 business days from shipping',
          trackingSteps: [
            {
              label: 'Order Received',
              date: new Date(order.createdAt).toLocaleDateString(),
              time: new Date(order.createdAt).toLocaleTimeString(),
              completed: true,
              description: 'Your order has been received and is being processed'
            },
            {
              label: 'Processing',
              date: 'In progress',
              completed: true,
              description: 'Your order is currently being prepared'
            },
            {
              label: 'Shipped',
              completed: false
            },
            {
              label: 'Out for Delivery',
              completed: false
            },
            {
              label: 'Delivered',
              completed: false
            }
          ]
  },
  group: groupSummary
      }, { status: 200 });
    }

    // If delivery status is not pending, proceed to track the order
    const trackingData = await trackShiprocketOrder(orderId);

    // Process and enhance the tracking data
    if (trackingData && trackingData.length > 0) {
      const shipmentData = trackingData[0];
      const trackUrl = shipmentData?.tracking_data?.track_url;
      const currentStatus = shipmentData?.tracking_data?.shipment_track?.[0]?.current_status;      // Extract and structure tracking information for the front-end      // Format the address from the order object
      const formattedAddress = order.address ? 
        `${order.address.addressLine1}${order.address.addressLine2 ? ', ' + order.address.addressLine2 : ''}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}` : 
        'Address information not available';
        
      // Get user information for email
      let userEmail = null;
      try {
        await order.populate('user');
        userEmail = order.user?.email || null;
      } catch (err) {
        console.log('Error fetching user email:', err);
      }
        
      const enhancedTrackingData = {
        orderId: orderId,
        trackUrl: trackUrl,
        status: currentStatus || 'In Transit',
        shipmentDate: shipmentData?.tracking_data?.shipment_track?.[0]?.shipped_date || 'Processing',
        expectedDelivery: shipmentData?.tracking_data?.shipment_track?.[0]?.expected_delivery_date || 'Calculating...',
        name: order.address?.receiverName || 'Customer',
        address: formattedAddress,
        phoneNumber: order.address?.receiverPhoneNumber || 'Not provided',
        email: userEmail,
      };

      // Create tracking steps based on available data
      const activities = shipmentData?.tracking_data?.shipment_track_activities || [];
      if (activities.length > 0) {
        enhancedTrackingData.trackingSteps = activities.map(activity => ({
          label: activity.activity,
          date: activity.date,
          time: activity.time,
          location: activity.location,
          completed: true,
          description: activity.description || activity.activity
        })).reverse(); // Most recent first
      } else {
        // Provide default steps when no activities are available
        enhancedTrackingData.trackingSteps = [
          {
            label: 'Order Received',
            date: new Date(order.createdAt).toLocaleDateString(),
            time: new Date(order.createdAt).toLocaleTimeString(),
            completed: true,
            description: 'Your order has been received and is being processed'
          },
          {
            label: 'Processing',
            date: 'Complete',
            completed: true,
            description: 'Your order has been processed'
          },
          {
            label: 'Shipped',
            date: enhancedTrackingData.shipmentDate,
            completed: true,
            description: 'Your order has been shipped'
          },
          {
            label: 'Out for Delivery',
            completed: currentStatus === 'Out for Delivery' || currentStatus === 'Delivered',
          },
          {
            label: 'Delivered',
            completed: currentStatus === 'Delivered',
          }
        ];
      }

      return NextResponse.json({ 
        message: 'Tracking information found!',
        trackUrl: trackUrl,
        trackingData: enhancedTrackingData,
        group: groupSummary
      }, { status: 200 });
    } else {      // Get user information for email
      let userEmail = null;
      try {
        await order.populate('user');
        userEmail = order.user?.email || null;
      } catch (err) {
        console.log('Error fetching user email:', err);
      }

      // Format the address properly
      const formattedAddress = order.address ? 
        `${order.address.addressLine1}${order.address.addressLine2 ? ', ' + order.address.addressLine2 : ''}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}` : 
        'Address pending';

  return NextResponse.json({ 
        message: 'Your order will be shipped soon! Check back for tracking updates.',
        trackingData: {
          orderId: orderId,
          status: 'Processing',
          name: order.address?.receiverName || 'Customer',
          address: formattedAddress,
          phoneNumber: order.address?.receiverPhoneNumber || 'Not provided',
          email: userEmail,
          shipmentDate: 'Processing',
          expectedDelivery: 'Estimated 5-7 business days from shipping',
          trackingSteps: [
            {
              label: 'Order Received',
              date: new Date(order.createdAt).toLocaleDateString(),
              time: new Date(order.createdAt).toLocaleTimeString(),
              completed: true,
              description: 'Your order has been received and is being processed'
            },
            {
              label: 'Processing',
              date: 'In progress',
              completed: true,
              description: 'Your order is currently being prepared'
            },
            {
              label: 'Shipped',
              completed: false
            }
          ]
  },
  group: groupSummary
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ message: 'Error tracking order. Please try again later.' }, { status: 502 });
  }
}

