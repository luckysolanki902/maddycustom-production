import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import { saveFunnelEvents, validateEventsPayload } from '@/lib/analytics/funnelService';

const MAX_EVENTS_PER_REQUEST = 50;

// POST-only route: No caching needed (writes data)

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
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
    events.length = MAX_EVENTS_PER_REQUEST;
  }


  try {
    await connectToDatabase();
  } catch (error) {
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
