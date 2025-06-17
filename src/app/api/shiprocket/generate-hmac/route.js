import crypto from 'crypto';

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    const SECRET_KEY = process.env.SHIPROCKET_SECRET_KEY;
    
    if (!SECRET_KEY) {
      return Response.json({ 
        error: 'Secret key not configured' 
      }, { status: 500 });
    }
    
    // Generate HMAC
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(JSON.stringify(body));
    const signature = hmac.digest('base64');
    
    // Return successful response
    return Response.json({ hmac: signature });
    
  } catch (error) {
    console.error('Error generating HMAC:', error);
    return Response.json({ 
      error: 'Failed to generate HMAC',
      message: error.message 
    }, { status: 500 });
  }
}