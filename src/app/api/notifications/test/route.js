// @/app/api/notifications/test/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Notification from '@/models/Notification';
import NotificationTemplate from '@/models/NotificationTemplate';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const {
      phoneNumber = '9876543210',
      productId = '6683b2b0b31f8e41fb1bc123', // Default test product ID
      templateName = 'restocking_alert'
    } = body;

    console.log('Creating test notification with:', { phoneNumber, productId, templateName });

    // Try to find the template first
    let template = await NotificationTemplate.findOne({ name: templateName });
    
    if (!template) {
      // Create a basic template for testing
      template = await NotificationTemplate.create({
        name: templateName,
        description: 'Test restocking alert template',
        sms: {
          enabled: true,
          template: 'Hey! Good news - {{productName}} is back in stock! Order now: {{productUrl}}',
        },
        whatsapp: {
          enabled: true,
          template: 'Hey {{userName}}! 🎉 Great news - {{productName}} is back in stock! Get yours now: {{productUrl}}',
          campaignName: 'product_restocking_alert',
          templateParams: ['userName', 'productName', 'productUrl'],
        },
        variables: [
          { name: 'userName', description: 'User name', required: false },
          { name: 'productName', description: 'Product name', required: true },
          { name: 'productUrl', description: 'Product URL', required: true },
        ],
        active: true,
      });
      console.log('Created template:', template._id);
    }

    // Create notification
    const notificationData = {
      phoneNumber,
      name: `test_restock_${productId}_${phoneNumber}_${Date.now()}`,
      template: template._id,
      notificationType: 'restocking',
      variables: new Map([
        ['productName', 'Test Product'],
        ['productUrl', 'https://example.com/product'],
        ['userName', 'Test User']
      ]),
      channels: ['sms', 'whatsapp'],
      channelStatus: [
        { channel: 'sms', status: 'pending', retryCount: 0 },
        { channel: 'whatsapp', status: 'pending', retryCount: 0 }
      ],
      info: [
        { key: 'productId', value: productId },
        { key: 'test', value: 'true' },
        { key: 'source', value: 'api_test' }
      ]
    };

    const notification = new Notification(notificationData);
    await notification.save();

    console.log('Notification created:', notification._id);

    return NextResponse.json({
      success: true,
      message: 'Test notification created successfully',
      notificationId: notification._id,
      templateId: template._id,
    });

  } catch (error) {
    console.error('Error creating test notification:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    await connectToDatabase();
    
    const notifications = await Notification.find({})
      .populate('template', 'name description')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
