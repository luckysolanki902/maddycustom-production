// scripts/test-notification-creation.js
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Notification = require('../src/models/Notification');
const NotificationTemplate = require('../src/models/NotificationTemplate');

async function testNotificationCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create a basic template for testing
    const templateData = {
      name: 'restocking_alert',
      description: 'Notification sent when a product is back in stock',
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
    };

    // Try to create or find template
    let template = await NotificationTemplate.findOne({ name: 'restocking_alert' });
    if (!template) {
      template = await NotificationTemplate.create(templateData);
      console.log('✅ Created template:', template.name);
    } else {
      console.log('✅ Found existing template:', template.name);
    }

    // Create a test notification
    const notificationData = {
      phoneNumber: '9876543210',
      name: `test_restock_${Date.now()}`,
      template: template._id,
      notificationType: 'restocking',
      variables: new Map([
        ['productName', 'Test Product - Custom T-Shirt'],
        ['productUrl', 'https://maddycustom.com/test-product'],
        ['userName', 'Test User']
      ]),
      channels: ['sms', 'whatsapp'],
      channelStatus: [
        { channel: 'sms', status: 'pending', retryCount: 0 },
        { channel: 'whatsapp', status: 'pending', retryCount: 0 }
      ],
      info: [
        { key: 'test', value: 'true' },
        { key: 'source', value: 'script_test' }
      ]
    };

    const notification = new Notification(notificationData);
    await notification.save();

    console.log('✅ Notification created successfully!');
    console.log('   ID:', notification._id);
    console.log('   Name:', notification.name);
    console.log('   Phone:', notification.phoneNumber);
    console.log('   Channels:', notification.channels);
    console.log('   Status:', notification.status);

    // Test duplicate prevention
    console.log('\n📋 Testing duplicate prevention...');
    try {
      const duplicateNotification = new Notification(notificationData);
      await duplicateNotification.save();
      console.log('❌ Duplicate notification was created (should not happen)');
    } catch (error) {
      if (error.code === 11000) {
        console.log('✅ Duplicate notification prevented by unique constraint');
      } else {
        console.log('⚠️ Different error occurred:', error.message);
      }
    }

    // Fetch all notifications to verify
    const allNotifications = await Notification.find({})
      .populate('template', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('\n📋 Recent notifications:');
    allNotifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.name} - ${notif.phoneNumber} - ${notif.status}`);
    });

    console.log('\n🎉 Notification system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing notifications:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testNotificationCreation();
