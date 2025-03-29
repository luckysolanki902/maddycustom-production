import OpenAI from "openai";
import connectToDb from '@/lib/middleware/connectToDb';
import SupportRequest from '@/models/SupportRequest';
import helpingData from '@/lib/faq/helpingdata';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});
console.log('openai api key: ', process.env.OPENAI_API_KEY)

export async function POST(req) {
    try {
        // Connect to your database
        await connectToDb();

        // Get data from the request
        const { userMessage, mobile, email, category, subcategory } = await req.json();

        // Create a new support request
        const newRequest = new SupportRequest({
            mobile,
            email,
            category,
            subcategory,
            issue: userMessage,
            status: 'pending',
        });
        await newRequest.save();

        // Build your prompt using helpingData
        const prompt = `
Business & FAQ info:
${helpingData}

User Message:
${userMessage}

User Issue Category:
${category}

User Issue Subcategory:
${subcategory}

Instructions:
Please answer the user's query in a friendly tone.
If you need to include any links (only those included in business and faq data), provide them in the format:
{link: <URL or /relativePath>, linkText: <Descriptive text>}
Example: {link: https://www.example.com, linkText: Example Site}, always provide tracking link if the query category is 'Order Related'
    `;

        // Make a chat completion request (non-streaming)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // or "gpt-4"
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
            ],
            // store: true // you could set 'store' if your library requires it
        });

        // Get the final response text
        const finalResponse = completion.choices[0].message.content;

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
