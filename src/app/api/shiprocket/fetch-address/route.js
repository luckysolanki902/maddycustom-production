import { ObjectId } from 'mongodb';
import crypto from 'crypto';

// Constants - get these from your environment variables
const API_KEY = process.env.SHIPROCKET_API_KEY;
const SECRET_KEY = process.env.SHIPROCKET_SECRET_KEY;

// Generate a random MongoDB ObjectId
export function generateMongoId() {
  return new ObjectId().toString();
}

// Fix the HMAC generation to match exactly what Shiprocket expects
export function generateShiprocketHMAC(body) {
  if (!SECRET_KEY) {
    console.error('Missing SECRET_KEY for Shiprocket HMAC');
    throw new Error('Shiprocket secret key not configured');
  }
  
  // IMPORTANT - Format body EXACTLY as Shiprocket expects (no sorting)
  const stringifiedBody = JSON.stringify(body);
  console.log('HMAC input string:', stringifiedBody);
  
  // Create HMAC with correct encoding
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringifiedBody);
  
  // Return base64 encoded signature
  return hmac.digest('base64');
}

export async function POST(request) {
  try {
    // Generate a random order ID
    const orderId = generateMongoId();
    
    // CRITICAL: Format the body exactly as Shiprocket expects
    // Note: Field order matters for some HMAC implementations
    const body = {
      order_id: orderId,
      timestamp: new Date().toISOString()
    };
    
    console.log('API Key:', API_KEY?.substring(0, 3) + '...');
    console.log('Secret Key Length:', SECRET_KEY?.length || 0);
    console.log('Request body:', body);

    // Generate HMAC signature
    const hmacSignature = generateShiprocketHMAC(body);
    console.log('Generated HMAC:', hmacSignature);
    // const token= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjY5MjIwOTcsInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzUxMDMyODM5LCJqdGkiOiJTOHR2Qk1aZ3pCelZ4MUZwIiwiaWF0IjoxNzUwMTY4ODM5LCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc1MDE2ODgzOSwiY2lkIjo2NTE5MjE0LCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6IiJ9.2XQbz8AxGo233ENHrSoqscJPDkI-Uw3RiyQ4RJsR0Ko";
    // Make API call to Shiprocket
    const response = await fetch('https://fastrr-api-dev.pickrr.com/api/v1/custom-platform-order/details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': `Bearer ${API_KEY.trim()}`,
        'X-Api-HMAC-SHA256': hmacSignature
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    // Return a success response with the generated order ID for testing
    return Response.json({
      success: true,
      message: 'Operation completed',
      orderId: orderId,
      response: responseText
    });
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      message: error.message || 'Internal server error'
    }, { status: 500 });
  }
}