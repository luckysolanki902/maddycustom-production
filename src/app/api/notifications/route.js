// @/app/api/notifications/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Notification from '@/models/Notification';
import NotificationTemplate from '@/models/NotificationTemplate';
import User from '@/models/User';
import Product from '@/models/Product';
import Option from '@/models/Option';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const {
      phoneNumber,
      email,
      userName,
      userId,
      templateName,
      notificationType,
      name,
      variables = {},
      productId,
      optionId,
      channels = ['sms'], // Default to SMS
      scheduleDelayMinutes = 0,
      dedupeKey,
      info = [],
    } = body;

    // Validate required fields
    if (!phoneNumber || !templateName || !notificationType || !name) {
      return NextResponse.json(
        { error: 'Phone number, template name, notification type, and name are required' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Find the notification template
    const template = await NotificationTemplate.findOne({ 
      name: templateName, 
      active: true 
    });
    
    if (!template) {
      return NextResponse.json(
        { error: 'Notification template not found or inactive' },
        { status: 404 }
      );
    }

    // Validate channels against template capabilities
    const enabledChannels = [];
    if (channels.includes('sms') && template.sms?.enabled) {
      enabledChannels.push('sms');
    }
    if (channels.includes('whatsapp') && template.whatsapp?.enabled) {
      enabledChannels.push('whatsapp');
    }
    if (channels.includes('email') && template.email?.enabled && email) {
      enabledChannels.push('email');
    }

    if (enabledChannels.length === 0) {
      return NextResponse.json(
        { error: 'No valid channels enabled for this template' },
        { status: 400 }
      );
    }

    // Check for duplicate notifications (same name or similar context)
    const existingQuery = {
      $or: [
        { name: name },
        {
          phoneNumber,
          notificationType,
          status: { $in: ['pending', 'queued', 'processing'] }
        }
      ]
    };
    
    // Add product/option/inventory check through info array if provided
    if (productId || optionId) {
      const infoQuery = { phoneNumber, notificationType, status: { $in: ['pending', 'queued', 'processing'] } };
      
      // Check by inventoryId first (most accurate)
      const inventoryIdInfo = info.find(item => item.key === 'inventoryId');
      if (inventoryIdInfo?.value) {
        infoQuery['info'] = { $elemMatch: { key: 'inventoryId', value: inventoryIdInfo.value } };
      } else {
        // Fallback to product/option matching
        if (productId) {
          infoQuery['info'] = { $elemMatch: { key: 'productId', value: productId } };
        }
        if (optionId) {
          infoQuery['info'] = { $elemMatch: { key: 'optionId', value: optionId } };
        }
      }
      
      existingQuery.$or.push(infoQuery);
    }

    const existingNotification = await Notification.findOne(existingQuery);
    
    if (existingNotification) {
      return NextResponse.json(
        { error: 'You\'re already set to be notified for this item! We\'ll let you know when it\'s back in stock.' },
        { status: 409 }
      );
    }

    // Create notification
    const notificationData = {
      phoneNumber,
      email,
      userName,
      name,
      template: template._id,
      notificationType,
      variables: new Map(Object.entries(variables)),
      channels: enabledChannels,
      scheduleDelayMinutes,
      channelStatus: enabledChannels.map(channel => ({
        channel,
        status: 'pending',
        retryCount: 0,
      })),
      info: [
        ...info.map(item => ({
          key: item.key,
          value: item.value
        })),
        // Add productId and optionId to info array if provided
        ...(productId ? [{ key: 'productId', value: productId }] : []),
        ...(optionId ? [{ key: 'optionId', value: optionId }] : []),
      ],
    };

    // Add optional fields
    if (userId) notificationData.user = userId;
    if (dedupeKey) notificationData.dedupeKey = dedupeKey;

    const notification = new Notification(notificationData);
    await notification.save();

    // Populate the response with template info
    const populatedNotification = await Notification.findById(notification._id)
      .populate('template', 'name description')
      .lean();

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully',
      notification: populatedNotification,
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const userId = searchParams.get('userId');
    const notificationType = searchParams.get('notificationType');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;

    // Build query
    const query = {};
    if (phoneNumber) query.phoneNumber = phoneNumber;
    if (userId) query.user = userId;
    if (notificationType) query.notificationType = notificationType;
    if (status) query.status = status;

    // Execute query with pagination
    const notifications = await Notification.find(query)
      .populate('template', 'name description')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);

    return NextResponse.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
