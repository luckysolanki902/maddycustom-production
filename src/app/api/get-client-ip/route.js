import { NextResponse } from 'next/server';

/**
 * GET /api/get-client-ip
 * 
 * Fallback endpoint to get client IP from server headers
 * This is a fallback when client-side IP detection fails
 */
export async function GET(request) {
  try {
    // Try various headers to get the real client IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
    const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for'); // Vercel
    
    let clientIp = '';
    
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp;
    } else if (cfConnectingIp) {
      clientIp = cfConnectingIp;
    } else if (vercelForwardedFor) {
      clientIp = vercelForwardedFor;
    }
    
    // Basic validation
    if (clientIp && (clientIp.includes('.') || clientIp.includes(':'))) {
      return NextResponse.json({ ip: clientIp });
    }
    
    return NextResponse.json({ ip: '' });
  } catch (error) {
    console.error('Error getting client IP:', error);
    return NextResponse.json({ ip: '' });
  }
}
