// scripts/create-default-notification-templates.js
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const NotificationTemplate = require('../src/models/NotificationTemplate');

async function createDefaultTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Default templates
    const templates = [
      {
        name: 'restocking_alert',
        description: 'Notification sent when a product is back in stock',
        sms: {
          enabled: true,
          template: 'Hey! Good news - {{productName}} is back in stock! Order now: {{productUrl}}',
          templateId: process.env.MSG91_RESTOCK_TEMPLATE_ID || '',
          dltTemplateId: process.env.MSG91_RESTOCK_DLT_TEMPLATE_ID || '',
        },
        whatsapp: {
          enabled: true,
          template: 'Hey {{userName}}! 🎉 Great news - {{productName}} is back in stock! {{optionDetails}} Get yours now: {{productUrl}}',
          campaignName: 'product_restocking_alert',
          templateParams: ['userName', 'productName', 'optionDetails', 'productUrl'],
        },
        email: {
          enabled: false,
          subject: '{{productName}} is Back in Stock!',
          template: 'Hi {{userName}},\n\nGreat news! The product you were waiting for is now available.\n\nProduct: {{productName}}\n{{optionDetails}}\n\nOrder now: {{productUrl}}\n\nThanks,\nMaddy Custom Team',
          htmlTemplate: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">{{productName}} is Back in Stock!</h2>
              <p>Hi {{userName}},</p>
              <p>Great news! The product you were waiting for is now available.</p>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Product:</strong> {{productName}}<br>
                {{optionDetails}}
              </div>
              <a href="{{productUrl}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Order Now</a>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Thanks,<br>
                Maddy Custom Team
              </p>
            </div>
          `,
        },
        variables: [
          { name: 'userName', description: 'User name', required: false },
          { name: 'productName', description: 'Product name', required: true },
          { name: 'productUrl', description: 'Product URL', required: true },
          { name: 'optionDetails', description: 'Product option details', required: false },
        ],
        active: true,
      },
      {
        name: 'order_confirmation',
        description: 'Notification sent when an order is confirmed',
        sms: {
          enabled: true,
          template: 'Order confirmed! Order ID: {{orderId}}. Total: ₹{{orderTotal}}. Track: {{trackingUrl}}',
          templateId: process.env.MSG91_ORDER_CONFIRM_TEMPLATE_ID || '',
          dltTemplateId: process.env.MSG91_ORDER_CONFIRM_DLT_TEMPLATE_ID || '',
        },
        whatsapp: {
          enabled: true,
          template: 'Hi {{userName}}! 🎉 Your order has been confirmed!\n\nOrder ID: {{orderId}}\nTotal: ₹{{orderTotal}}\n\nTrack your order: {{trackingUrl}}',
          campaignName: 'order_confirmation',
          templateParams: ['userName', 'orderId', 'orderTotal', 'trackingUrl'],
        },
        email: {
          enabled: false,
          subject: 'Order Confirmed - {{orderId}}',
          template: 'Hi {{userName}},\n\nYour order has been confirmed!\n\nOrder ID: {{orderId}}\nTotal: ₹{{orderTotal}}\n\nTrack your order: {{trackingUrl}}\n\nThanks for shopping with us!\nMaddy Custom Team',
        },
        variables: [
          { name: 'userName', description: 'User name', required: false },
          { name: 'orderId', description: 'Order ID', required: true },
          { name: 'orderTotal', description: 'Order total amount', required: true },
          { name: 'trackingUrl', description: 'Order tracking URL', required: false },
        ],
        active: true,
      },
      {
        name: 'order_shipped',
        description: 'Notification sent when an order is shipped',
        sms: {
          enabled: true,
          template: 'Your order {{orderId}} has been shipped! Track: {{trackingUrl}}. Delivery by {{expectedDelivery}}',
          templateId: process.env.MSG91_ORDER_SHIPPED_TEMPLATE_ID || '',
          dltTemplateId: process.env.MSG91_ORDER_SHIPPED_DLT_TEMPLATE_ID || '',
        },
        whatsapp: {
          enabled: true,
          template: 'Hi {{userName}}! 📦 Your order {{orderId}} is on its way!\n\nExpected delivery: {{expectedDelivery}}\nTrack: {{trackingUrl}}',
          campaignName: 'order_shipped',
          templateParams: ['userName', 'orderId', 'expectedDelivery', 'trackingUrl'],
        },
        variables: [
          { name: 'userName', description: 'User name', required: false },
          { name: 'orderId', description: 'Order ID', required: true },
          { name: 'trackingUrl', description: 'Tracking URL', required: true },
          { name: 'expectedDelivery', description: 'Expected delivery date', required: false },
        ],
        active: true,
      },
    ];

    // Create or update templates
    for (const templateData of templates) {
      const existingTemplate = await NotificationTemplate.findOne({ name: templateData.name });
      
      if (existingTemplate) {
        await NotificationTemplate.findByIdAndUpdate(existingTemplate._id, templateData);
        console.log(`✅ Updated template: ${templateData.name}`);
      } else {
        await NotificationTemplate.create(templateData);
        console.log(`✅ Created template: ${templateData.name}`);
      }
    }

    console.log('\n🎉 All notification templates have been created/updated successfully!');
    
  } catch (error) {
    console.error('❌ Error creating templates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createDefaultTemplates();
