import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import FunnelSession from '@/models/analytics/FunnelSession';
import FunnelEvent from '@/models/analytics/FunnelEvent';
import classifyPage from '@/lib/analytics/pageClassifier';

const BATCH_SIZE = 250;

async function backfillSessions() {
  let processed = 0;
  let updated = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sessions = await FunnelSession.find({
      'landingPage.path': { $exists: true, $ne: null, $ne: '' },
      $or: [
        { 'landingPage.pageCategory': { $exists: false } },
        { 'landingPage.pageCategory': null },
        { 'landingPage.pageCategory': '' },
      ],
    })
      .select({ _id: 1, 'landingPage.path': 1, 'landingPage.name': 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!sessions.length) {
      break;
    }

    const bulkOps = sessions.map((session) => {
      const landingPath = session.landingPage?.path || '/';
      const classification = classifyPage(landingPath);

      const update = {
        'landingPage.pageCategory': classification.pageCategory,
      };

      if (!session.landingPage?.name) {
        update['landingPage.name'] = classification.pageName;
      }

      processed += 1;

      return {
        updateOne: {
          filter: { _id: session._id },
          update: { $set: update },
        },
      };
    });

    if (bulkOps.length) {
      const result = await FunnelSession.bulkWrite(bulkOps, { ordered: false });
      updated += result.modifiedCount || 0;
    }

    if (sessions.length < BATCH_SIZE) {
      break;
    }
  }

  return { processed, updated };
}

async function backfillEvents() {
  let processed = 0;
  let updated = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const events = await FunnelEvent.find({
      'page.path': { $exists: true, $ne: null, $ne: '' },
      $or: [
        { 'page.pageCategory': { $exists: false } },
        { 'page.pageCategory': null },
        { 'page.pageCategory': '' },
      ],
    })
      .select({ _id: 1, 'page.path': 1, 'page.name': 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!events.length) {
      break;
    }

    const bulkOps = events.map((event) => {
      const pagePath = event.page?.path || '/';
      const classification = classifyPage(pagePath);

      const update = {
        'page.pageCategory': classification.pageCategory,
      };

      if (!event.page?.name) {
        update['page.name'] = classification.pageName;
      }

      processed += 1;

      return {
        updateOne: {
          filter: { _id: event._id },
          update: { $set: update },
        },
      };
    });

    if (bulkOps.length) {
      const result = await FunnelEvent.bulkWrite(bulkOps, { ordered: false });
      updated += result.modifiedCount || 0;
    }

    if (events.length < BATCH_SIZE) {
      break;
    }
  }

  return { processed, updated };
}

function isAuthorised(request) {
  const token = process.env.BACKFILL_ADMIN_TOKEN;
  if (!token) {
    return process.env.NODE_ENV !== 'production';
  }
  const headerToken = request.headers.get('x-backfill-token');
  return headerToken && headerToken === token;
}

export async function POST(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  await connectToDatabase();

  const [sessionResult, eventResult] = await Promise.all([
    backfillSessions(),
    backfillEvents(),
  ]);

  return NextResponse.json({
    ok: true,
    sessions: sessionResult,
    events: eventResult,
  });
}
