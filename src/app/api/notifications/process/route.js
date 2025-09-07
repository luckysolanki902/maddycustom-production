// @/app/api/notifications/process/route.js
// endpoint: https://maddycustom.com/api/notifications/process
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Notification from '@/models/Notification';
import NotificationTemplate from '@/models/NotificationTemplate';
import { sendSMS } from '@/lib/utils/msg91Sender';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { notificationId, channel } = body;

    if (!notificationId || !channel) {
      return NextResponse.json(
        { error: 'Notification ID and channel are required' },
        { status: 400 }
      );
    }

    // Find the notification
    const notification = await Notification.findById(notificationId)
      .populate('template');

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Check if channel is enabled for this notification
    if (!notification.channels.includes(channel)) {
      return NextResponse.json(
        { error: `Channel ${channel} not enabled for this notification` },
        { status: 400 }
      );
    }

    // Find channel status
    const channelStatusIndex = notification.channelStatus.findIndex(
      cs => cs.channel === channel
    );

    if (channelStatusIndex === -1) {
      return NextResponse.json(
        { error: `Channel status not found for ${channel}` },
        { status: 400 }
      );
    }

    const channelStatus = notification.channelStatus[channelStatusIndex];

    // Check if already sent
    if (channelStatus.status === 'sent') {
      return NextResponse.json(
        { error: 'Notification already sent for this channel' },
        { status: 409 }
      );
    }

    // Check retry limit
    if (channelStatus.retryCount >= notification.totalRetryCount) {
      return NextResponse.json(
        { error: 'Maximum retry attempts reached' },
        { status: 429 }
      );
    }

    // Prepare variables for template replacement
    const variables = Object.fromEntries(notification.variables);
    variables.userName = notification.userName || variables.userName || '';
    variables.phoneNumber = notification.phoneNumber;
    
    // Ensure we have required variables with fallbacks
    variables.productTitle = variables.productTitle || variables.productName || 'Product';
    variables.thumbnail = variables.thumbnail || `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/just-helmet.png`;

    let result = { success: false, message: 'Unknown error' };

    try {
      // Update channel status to processing
      await Notification.findByIdAndUpdate(
        notificationId,
        {
          $set: {
            [`channelStatus.${channelStatusIndex}.status`]: 'processing',
            [`channelStatus.${channelStatusIndex}.lastAttempt`]: new Date(),
            [`channelStatus.${channelStatusIndex}.retryCount`]: channelStatus.retryCount + 1,
          }
        }
      );

      // Process based on channel
      switch (channel) {
        case 'sms':
          if (notification.template.sms?.enabled) {
            let message = notification.template.sms.template;
            
            // Replace variables in message
            for (const [key, value] of Object.entries(variables)) {
              message = message.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
            }

            result = await sendSMS({
              phoneNumber: notification.phoneNumber,
              message,
              templateId: notification.template.sms.templateId,
              dltTemplateId: notification.template.sms.dltTemplateId,
              variables,
            });
          } else {
            result = { success: false, message: 'SMS not enabled for this template' };
          }
          break;

        case 'whatsapp':
          if (notification.template.whatsapp?.enabled) {
            // Prepare template parameters
            const templateParams = notification.template.whatsapp.templateParams?.map(
              param => variables[param] || ''
            ) || [];

            // Prepare media with thumbnail
            let media = notification.template.whatsapp.media;
            if (media && media.url && media.url.includes('{{thumbnail}}')) {
              media = {
                ...media,
                url: variables.thumbnail
              };
            }

            result = await sendWhatsAppMessage({
              user: {
                _id: notification.user,
                name: notification.userName,
                phoneNumber: notification.phoneNumber,
              },
              campaignName: notification.template.whatsapp.campaignName,
              templateParams,
              media,
              buttons: notification.template.whatsapp.buttons,
            });
          } else {
            result = { success: false, message: 'WhatsApp not enabled for this template' };
          }
          break;

        case 'email':
          // TODO: Implement email sending logic
          result = { success: false, message: 'Email channel not implemented yet' };
          break;

        default:
          result = { success: false, message: `Unsupported channel: ${channel}` };
      }

      // Update channel status based on result
      const updateData = {
        [`channelStatus.${channelStatusIndex}.lastAttempt`]: new Date(),
        [`channelStatus.${channelStatusIndex}.response`]: result.data,
      };

      if (result.success) {
        updateData[`channelStatus.${channelStatusIndex}.status`] = 'sent';
        updateData[`channelStatus.${channelStatusIndex}.sentAt`] = new Date();
        delete updateData[`channelStatus.${channelStatusIndex}.error`];
      } else {
        updateData[`channelStatus.${channelStatusIndex}.status`] = 'failed';
        updateData[`channelStatus.${channelStatusIndex}.error`] = {
          message: result.message,
          details: result.data,
        };
      }

      await Notification.findByIdAndUpdate(notificationId, { $set: updateData });

      // Check if all channels are complete
      const updatedNotification = await Notification.findById(notificationId);
      const allChannelsComplete = updatedNotification.channelStatus.every(
        cs => cs.status === 'sent' || cs.status === 'failed'
      );

      if (allChannelsComplete) {
        const hasSuccessfulChannel = updatedNotification.channelStatus.some(
          cs => cs.status === 'sent'
        );
        
        await Notification.findByIdAndUpdate(notificationId, {
          $set: {
            status: hasSuccessfulChannel ? 'completed' : 'failed',
            completedAt: new Date(),
          }
        });
      }

      return NextResponse.json({
        success: result.success,
        message: result.message,
        channelStatus: result.success ? 'sent' : 'failed',
        data: result.data,
      });

    } catch (processingError) {
      // Update channel status to failed
      await Notification.findByIdAndUpdate(
        notificationId,
        {
          $set: {
            [`channelStatus.${channelStatusIndex}.status`]: 'failed',
            [`channelStatus.${channelStatusIndex}.lastAttempt`]: new Date(),
            [`channelStatus.${channelStatusIndex}.error`]: {
              message: processingError.message,
              details: processingError,
            },
          }
        }
      );

      throw processingError;
    }

  } catch (error) {
    console.error('Error processing notification:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch notifications ready for processing
export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10;
    const channel = searchParams.get('channel');

    // Build query for pending notifications
    const query = {
      status: { $in: ['pending', 'queued'] },
      $or: [
        { scheduleTime: null },
        { scheduleTime: { $lte: new Date() } }
      ]
    };

    // Add channel filter if specified
    if (channel) {
      query.channels = channel;
      query['channelStatus.channel'] = channel;
      query['channelStatus.status'] = { $in: ['pending', 'queued'] };
    }

    const notifications = await Notification.find(query)
      .populate('template', 'name sms whatsapp email')
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
    });

  } catch (error) {
    console.error('Error fetching pending notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
