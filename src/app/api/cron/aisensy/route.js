import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function GET() {
  try {
    // Using Lucky's details for testing
    const user = { _id: "673c9599647b7f48270b929b", name: "Lucky Solanki", phoneNumber: "9889616501" };
    const campaignName = "abandoned-cart-first-campaign";
    // For testing, orderId can be null (or a dummy ObjectId if needed)
    const orderId = null;
    const templateParams = ["Lucky"];
    const carouselCards = [
      {
        card_index: 0,
        components: [
          {
            type: "HEADER",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://d26w01jhwuuxpo.cloudfront.net/products/wraps/car-wraps/window-pillar-wraps/win/win13.jpg"
                }
              }
            ]
          },
          {
            type: "BUTTON",
            sub_type: "URL",
            index: 0,
            parameters: [
              { type: "text", text: "#SAMPLE-CLICK-TRACKING#" }
            ]
          }
        ]
      },
      {
        card_index: 1,
        components: [
          {
            type: "HEADER",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://d26w01jhwuuxpo.cloudfront.net/products/wraps/car-wraps/window-pillar-wraps/win/win16.jpg"
                }
              }
            ]
          },
          {
            type: "BUTTON",
            sub_type: "URL",
            index: 0,
            parameters: [
              { type: "text", text: "#SAMPLE-CLICK-TRACKING#" }
            ]
          }
        ]
      },
      {
        card_index: 2,
        components: [
          {
            type: "HEADER",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://d26w01jhwuuxpo.cloudfront.net/products/wraps/car-wraps/window-pillar-wraps/win/win17.jpg"
                }
              }
            ]
          },
          {
            type: "BUTTON",
            sub_type: "URL",
            index: 0,
            parameters: [
              { type: "text", text: "#SAMPLE-CLICK-TRACKING#" }
            ]
          }
        ]
      },
      {
        card_index: 3,
        components: [
          {
            type: "HEADER",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://d26w01jhwuuxpo.cloudfront.net/products/wraps/car-wraps/window-pillar-wraps/win/win19.jpg"
                }
              }
            ]
          },
          {
            type: "BUTTON",
            sub_type: "URL",
            index: 0,
            parameters: [
              { type: "text", text: "#SAMPLE-CLICK-TRACKING#" }
            ]
          }
        ]
      }
    ];

    const result = await sendWhatsAppMessage({ user, campaignName, orderId, templateParams, carouselCards });
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp carousel sent successfully!",
        data: result.data
      });
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 500 });
    }
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}
