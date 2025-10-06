import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import { saveFunnelEvents, validateEventsPayload } from '@/lib/analytics/funnelService';

const MAX_EVENTS_PER_REQUEST = 50;

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('[Funnel] Invalid JSON payload', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid payload',
      },
      { status: 200 }
    );
  }

  const validationResult = validateEventsPayload(payload);
  if (!validationResult.success) {
    const flattened = validationResult.error?.flatten?.();
    console.error('[Funnel] Validation failed', flattened);
    if (process.env.NODE_ENV !== 'production') {
      const sample = Array.isArray(payload?.events) ? payload.events.slice(0, 3) : payload;
      console.error('[Funnel] Validation payload sample', sample);
    }
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        issues: validationResult.error?.issues ?? [],
      },
      { status: 200 }
    );
  }

  const { events } = validationResult.data;
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    console.warn('[Funnel] Payload exceeded max events', events.length);
    events.length = MAX_EVENTS_PER_REQUEST;
  }


  try {
    await connectToDatabase();
  } catch (error) {
    console.error('[Funnel] Database connection failed', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Database connection failed',
      },
      { status: 200 }
    );
  }

  const outcome = await saveFunnelEvents(events);


  return NextResponse.json(
    {
      success: outcome.errors.length === 0,
      accepted: outcome.accepted,
      duplicates: outcome.duplicates,
      errors: outcome.errors,
    },
    { status: 200 }
  );
}
