import OpenAI from "openai";
import connectToDb from '@/lib/middleware/connectToDb';
import SupportRequest from '@/models/SupportRequest';
import Order from '@/models/Order';
import helpingData from '@/lib/faq/helpingdata';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Helper to format date as "11 Feb, 2025 04:34pm (en-IN)"
function getCustomDateString(date) {
  const d = new Date(date);

  const day = d.getDate();
  const shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthStr = shortMonths[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  let minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const mm = minutes < 10 ? `0${minutes}` : minutes;

  return `${day} ${monthStr}, ${year} ${hours}:${mm}${ampm}`;
}

export async function POST(req) {
  try {
    // Connect to DB
    await connectToDb();

    // Parse request body
    const { userMessage, mobile, email, category, subcategory } = await req.json();

    // Create support request in DB
    const newRequest = new SupportRequest({
      mobile,
      email,
      category,
      subcategory,
      issue: userMessage,
      status: 'pending',
    });
    await newRequest.save();

    let orderDetailsText = '';
    const lowerCategory = category.toLowerCase();

    if (lowerCategory === 'order related' || lowerCategory === "can't track order") {
      // Find the latest order for this mobile
      const order = await Order.findOne({
        "address.receiverPhoneNumber": mobile,
        paymentStatus: { $in: ['paidPartially', 'allPaid'] },
        deliveryStatus: { $ne: "delivered" },
      }).sort({ createdAt: -1 });

      if (order) {
        const formattedDate = getCustomDateString(order.createdAt);

        // Insert specialized highlight tags: <HLA>, <HLD>, <HLP>, <HLDS>
        orderDetailsText = `
Here is your latest order {copyToClipboardLink: ${order._id}, linkText: ${order._id}}, it has a total of <HLA>₹${order.totalAmount}</HLA>, placed on <HLD>${formattedDate}</HLD>, its payment status is <HLP>${order.paymentStatus}</HLP>, and its delivery status is <HLDS>${order.deliveryStatus}</HLDS>, to track the order visit {link: https://www.maddycustom.com/orders/track?orderId=${order._id}, linkText: Track Your Order}, you can also view payment and product details at {link: /orders/myorder/${order._id}, linkText: More Order Info}.
`;
      }
    }

    // Build the prompt for OpenAI
    const prompt = `
Business & FAQ info:
${helpingData}

User Message:
${userMessage}

User Issue Category:
${category}

User Issue Subcategory:
${subcategory}

${orderDetailsText
        ? `
User fetched order details (if category is 'Order Related'):
${orderDetailsText}
`
        : ''
      }

Instructions:
You are a helpful assistant who should respond in one single paragraph, be polite and adjust your tone based on the user's mood. Avoid line breaks, avoid any markdown formatting like ** or * or _, and avoid italic or bold formatting. If the user is frustrated, respond empathetically. If the user is cheerful, respond in a friendly, upbeat manner. If the user is neutral, keep a calm, helpful tone. Always return the final text as a single paragraph without additional new lines. For links, use {link: <URL>, linkText: <Text>}. In case the category is 'Order Related', always include both the order detail link (/orders/myorder/{orderid}) if the order ID is present and the track order link (/orders/track?orderId). Always explain why the user might not have received their order ID or notification, for example that it can take 1-2 days. For copying a value to the clipboard, use {copyToClipboardLink: <value>, linkText: <label>}. Use the specialized highlight tags for partial phrases: <HLA> for amounts, <HLD> for date/time, <HLP> for payment status, <HLDS> for delivery status. Return only one paragraph as your final answer. This is a one-time response assistant designed to answer a single query per interaction. Please do not invite the user to ask follow-up questions or reach out again unless specifically required. Always end your response with this line as part of the same paragraph (no line breaks): If your query is resolved, please press the yes button below. If not, press no and our customer care executive will get in touch with you within 24 hours.
    `;

    // Chat completion call (non-streaming)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or "gpt-4o" or another available model
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    const finalResponse = completion.choices[0].message.content;

    // Save the AI response to the request doc
    newRequest.aiResponse = finalResponse;
    await newRequest.save();

    // Return the final text with the support request's ID in headers
    return new Response(finalResponse, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Request-ID': newRequest._id.toString(),
      },
    });
  } catch (error) {
    console.error('Error in /api/openai/chat route:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}
