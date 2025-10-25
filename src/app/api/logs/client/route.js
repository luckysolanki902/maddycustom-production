import { NextResponse } from 'next/server';

/**
 * POST /api/logs/client
 * Receives logs from client-side code and logs them server-side
 * This makes client-side logs visible in Vercel dashboard
 */
export async function POST(request) {
  try {
    const logs = await request.json();
    
    // Validate request
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
    }

    // Log each entry server-side with appropriate level
    logs.forEach(log => {
      const { level, message, data, timestamp, context } = log;
      
      // Get request metadata
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';
      
      // Extract browser info from user agent
      const browserMatch = userAgent.match(/(Chrome|Safari|Firefox|Edge)\/[\d.]+/);
      const browser = browserMatch ? browserMatch[1] : 'Unknown';
      
      // Format timestamp nicely
      const time = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        fractionalSecondDigits: 3 
      }) : new Date().toLocaleTimeString();

      // Create emoji based on level
      const emoji = {
        error: '❌',
        warn: '⚠️',
        debug: '🔍',
        payment: '💳',
        webhook: '🔔',
        info: 'ℹ️'
      }[level] || 'ℹ️';

      // Format data for display
      const dataStr = data && Object.keys(data).length > 0 
        ? ` | ${Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        : '';

      // Create beautiful one-line log
      const beautifulLog = `${emoji} [${context}] ${message}${dataStr} • ${browser} • ${time}`;

      // Log with appropriate console method based on level
      switch (level) {
        case 'error':
          console.error(beautifulLog);
          break;
        case 'warn':
          console.warn(beautifulLog);
          break;
        case 'debug':
          console.debug(beautifulLog);
          break;
        case 'payment':
        case 'info':
        default:
          console.info(beautifulLog);
      }
    });

    return NextResponse.json({ success: true, logged: logs.length });
  } catch (error) {
    console.error('[Client Log API] Error processing logs:', error);
    return NextResponse.json({ error: 'Failed to process logs' }, { status: 500 });
  }
}
