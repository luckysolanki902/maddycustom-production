// Temporary route to create restocking notification template
// @/app/api/temp
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import NotificationTemplate from '@/models/NotificationTemplate';

export async function GET(request) {
  try {
    await connectToDatabase();
    
    // Check if template exists and update it, or create new one
    let restockingTemplate = await NotificationTemplate.findOne({ name: 'restocking_alert' });
    
    const templateData = {
      name: 'restocking_alert',
      description: 'Notification sent when products are back in stock',
      active: true,
      
      // SMS Configuration
      sms: {
        enabled: true,
        template: 'Good news! {{productTitle}} is back in stock. Order now: {{productUrl}}',
        templateId: 'RESTOCK_ALERT', // MSG91 template ID
        dltTemplateId: '1707172199999999999', // DLT template ID for restocking
      },
      
      // WhatsApp Configuration
      whatsapp: {
        enabled: true,
        campaignName: 'restocking_alert',
        templateParams: ['productTitle', 'productUrl'],
        media: {
          type: 'image',
          url: '{{thumbnail}}' // Dynamic thumbnail from product/option
        },
        buttons: [
          {
            type: 'url',
            text: 'Shop Now',
            url: '{{productUrl}}'
          }
        ]
      },
      
      // Email Configuration (disabled for now)
      email: {
        enabled: false,
        subject: '{{productTitle}} is Back in Stock!',
        template: `
          <h2>Great News!</h2>
          <img src="{{thumbnail}}" alt="{{productTitle}}" style="max-width: 300px; height: auto;" />
          <p>{{productTitle}} is back in stock.</p>
          <a href="{{productUrl}}" style="background-color: #2d2d2d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Shop Now</a>
        `,
        templateId: null
      },
      
      // Default variables
      defaultVariables: {
        productTitle: 'Product',
        productUrl: 'https://maddycustom.com',
        optionDetails: '',
        thumbnail: 'https://d26w01jhwuuxpo.cloudfront.net/assets/logos/just-helmet.png'
      },
      
      // Metadata
      category: 'inventory',
      tags: ['restocking', 'inventory', 'back-in-stock'],
      version: '1.1.0'
    };

    if (restockingTemplate) {
      // Update existing template
      Object.assign(restockingTemplate, templateData);
      await restockingTemplate.save();
      
      return NextResponse.json({
        success: true,
        message: 'Restocking notification template updated successfully',
        action: 'updated',
        template: {
          id: restockingTemplate._id,
          name: restockingTemplate.name,
          description: restockingTemplate.description,
          sms: restockingTemplate.sms,
          whatsapp: restockingTemplate.whatsapp,
          email: restockingTemplate.email
        }
      });
    } else {
      // Create new template
      restockingTemplate = new NotificationTemplate(templateData);
      await restockingTemplate.save();

      return NextResponse.json({
        success: true,
        message: 'Restocking notification template created successfully',
        action: 'created',
        template: {
          id: restockingTemplate._id,
          name: restockingTemplate.name,
          description: restockingTemplate.description,
          sms: restockingTemplate.sms,
          whatsapp: restockingTemplate.whatsapp,
          email: restockingTemplate.email
        }
      });
    }

  } catch (error) {
    console.error('Error creating restocking template:', error);
    
    // Check if template already exists
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Restocking template already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create restocking template', details: error.message },
      { status: 500 }
    );
  }
}


// DELETE method to remove the template (for cleanup)
export async function DELETE(request) {
  try {
    await connectToDatabase();
    
    const result = await NotificationTemplate.deleteOne({ 
      name: 'restocking_alert' 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Restocking template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Restocking template deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting restocking template:', error);
    return NextResponse.json(
      { error: 'Failed to delete restocking template' },
      { status: 500 }
    );
  }
}
