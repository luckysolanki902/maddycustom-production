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

    // Verify if the order exists and get linked orders
    const order = await Order.findById(orderId)
      .populate({
        path: 'linkedOrderIds',
        model: 'Order',
        select: 'deliveryStatus shiprocketOrderId'
      });
      
    if (!order) {
      return NextResponse.json({ message: 'Order not found. Please check your Order ID and try again.' }, { status: 404 });
    }

    // Get all orders for tracking (main order + linked orders)
    const allOrders = [order, ...(order.linkedOrderIds || [])];
    const trackingResults = [];
    
    // Check if any order has been shipped (not pending)
    const hasShippedOrder = allOrders.some(ord => ord.deliveryStatus !== 'pending');
    
    if (!hasShippedOrder) {
      // All orders are still pending - return consolidated pending response
      const formattedAddress = order.address ? 
        `${order.address.addressLine1}${order.address.addressLine2 ? ', ' + order.address.addressLine2 : ''}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}` : 
        'Address pending';

      // Get user information for email
      let userEmail = null;
      try {
        await order.populate('user');
        userEmail = order.user?.email || null;
      } catch (err) {
        console.log('Error fetching user email:', err);
      }
      
      return NextResponse.json({
        message: allOrders.length > 1 
          ? 'Your orders are still being processed. We\'ll update the tracking once they ship!'
          : 'Your order is still being processed. We\'ll update the tracking once it ships!',
        trackingData: {
          orderId: orderId,
          status: 'Processing',
          name: order.address?.receiverName || 'Customer',
          address: formattedAddress,
          phoneNumber: order.address?.receiverPhoneNumber || 'Not provided',
          email: userEmail,
          shipmentDate: 'Processing',
          expectedDelivery: 'Estimated 5-7 business days from shipping',
          isMultiOrder: allOrders.length > 1,
          orderCount: allOrders.length,
          trackingSteps: [
            {
              label: 'Order Received',
              date: new Date(order.createdAt).toLocaleDateString(),
              time: new Date(order.createdAt).toLocaleTimeString(),
              completed: true,
              description: allOrders.length > 1 
                ? `Your ${allOrders.length} orders have been received and are being processed`
                : 'Your order has been received and is being processed'
            },
            {
              label: 'Processing',
              date: 'In progress',
              completed: true,
              description: allOrders.length > 1 
                ? 'Your orders are currently being prepared'
                : 'Your order is currently being prepared'
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
        }
      }, { status: 200 });
    }

    // If orders have been shipped, track each one
    for (const ord of allOrders) {
      if (ord.deliveryStatus !== 'pending' && ord.shiprocketOrderId) {
        try {
          const trackingData = await trackShiprocketOrder(ord._id);
          if (trackingData && trackingData.length > 0) {
            trackingResults.push({
              orderId: ord._id,
              shiprocketOrderId: ord.shiprocketOrderId,
              trackingData: trackingData[0]
            });
          }
        } catch (trackError) {
          console.error(`Error tracking order ${ord._id}:`, trackError);
          trackingResults.push({
            orderId: ord._id,
            shiprocketOrderId: ord.shiprocketOrderId,
            error: 'Unable to fetch tracking data'
          });
        }
      }
    }

    // Process and enhance the tracking data
    if (trackingResults.length > 0) {
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
        isMultiOrder: trackingResults.length > 1,
        orderCount: allOrders.length,
        orders: trackingResults.map(result => {
          if (result.error) {
            return {
              orderId: result.orderId,
              shiprocketOrderId: result.shiprocketOrderId,
              error: result.error,
              status: 'Error fetching tracking data'
            };
          }
          
          const shipmentData = result.trackingData;
          const trackUrl = shipmentData?.tracking_data?.track_url;
          const currentStatus = shipmentData?.tracking_data?.shipment_track?.[0]?.current_status;
          
          return {
            orderId: result.orderId,
            shiprocketOrderId: result.shiprocketOrderId,
            trackUrl: trackUrl,
            status: currentStatus || 'In Transit',
            shipmentDate: shipmentData?.tracking_data?.shipment_track?.[0]?.shipped_date || 'Processing',
            expectedDelivery: shipmentData?.tracking_data?.shipment_track?.[0]?.expected_delivery_date || 'Calculating...',
          };
        }),
        name: order.address?.receiverName || 'Customer',
        address: formattedAddress,
        phoneNumber: order.address?.receiverPhoneNumber || 'Not provided',
        email: userEmail,
        // Use the first available tracking URL
        mainTrackUrl: trackingResults.find(r => r.trackingData?.tracking_data?.track_url)?.trackingData?.tracking_data?.track_url || null
      };
      
      return NextResponse.json({
        message: trackingResults.length > 1 
          ? `Tracking information for your ${trackingResults.length} orders`
          : 'Tracking information for your order',
        trackingData: enhancedTrackingData
      }, { status: 200 });
    } else {
      return NextResponse.json({
        message: 'Unable to fetch tracking information. Please try again later.',
        trackingData: {
          orderId: orderId,
          status: 'Tracking Unavailable',
          error: 'No tracking data available'
        }
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
        trackingData: enhancedTrackingData
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
        }
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ message: 'Error tracking order. Please try again later.' }, { status: 502 });
  }
}

