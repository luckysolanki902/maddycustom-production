import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import FunnelEvent from '@/models/analytics/FunnelEvent';
import FunnelSession from '@/models/analytics/FunnelSession';

// Simple classification logic
function classifyPath(path) {
  if (!path || typeof path !== 'string') {
    return { pageCategory: 'other', pageName: 'other' };
  }

  const normalizedPath = path.trim();
  
  // Home page
  if (normalizedPath === '/' || normalizedPath === '') {
    return { pageCategory: 'home', pageName: 'home' };
  }

  // Split path and filter empty segments
  const segments = normalizedPath
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  // Not a shop path
  if (!segments[0] || segments[0] !== 'shop') {
    return { pageCategory: 'other', pageName: 'other' };
  }

  // Shop paths - count segments after 'shop'
  const segmentsAfterShop = segments.length - 1;
  
  // 0-3 segments after 'shop' = product-list-page
  // 4+ segments after 'shop' = product-id-page
  if (segmentsAfterShop <= 3) {
    return { pageCategory: 'product-list-page', pageName: 'product-list-page' };
  }
  
  return { pageCategory: 'product-id-page', pageName: 'product-id-page' };
}

export async function POST(request) {
  try {
    await dbConnect();

    const { action, limit = 1000 } = await request.json();

    if (action === 'analyze') {
      // Analyze how many documents need fixing
      const [eventsToFix, sessionsToFix, eventsSample, sessionsSample] = await Promise.all([
        FunnelEvent.countDocuments({
          'page.path': { $exists: true },
          $or: [
            { 'page.pageCategory': { $exists: false } },
            { 'page.pageCategory': null },
            { 'page.name': { $exists: false } },
            { 'page.name': null }
          ]
        }),
        FunnelSession.countDocuments({
          'landingPage.path': { $exists: true },
          $or: [
            { 'landingPage.pageCategory': { $exists: false } },
            { 'landingPage.pageCategory': null },
            { 'landingPage.name': { $exists: false } },
            { 'landingPage.name': null }
          ]
        }),
        FunnelEvent.find({ 'page.path': { $exists: true } })
          .select('page')
          .limit(5)
          .lean(),
        FunnelSession.find({ 'landingPage.path': { $exists: true } })
          .select('landingPage')
          .limit(5)
          .lean()
      ]);

      return NextResponse.json({
        analysis: {
          eventsNeedingFix: eventsToFix,
          sessionsNeedingFix: sessionsToFix,
          eventsSample: eventsSample.map(e => ({
            _id: e._id,
            path: e.page?.path,
            currentCategory: e.page?.pageCategory,
            currentName: e.page?.name,
            shouldBe: classifyPath(e.page?.path)
          })),
          sessionsSample: sessionsSample.map(s => ({
            _id: s._id,
            path: s.landingPage?.path,
            currentCategory: s.landingPage?.pageCategory,
            currentName: s.landingPage?.name,
            shouldBe: classifyPath(s.landingPage?.path)
          }))
        }
      });
    }

    if (action === 'fix') {
      const stats = {
        events: { processed: 0, updated: 0, errors: 0 },
        sessions: { processed: 0, updated: 0, errors: 0 }
      };

      // Fix FunnelEvents
      console.log('Starting FunnelEvent classification fix...');
      const events = await FunnelEvent.find({ 'page.path': { $exists: true } })
        .select('_id page')
        .limit(limit)
        .lean();

      for (const event of events) {
        stats.events.processed++;
        
        try {
          const path = event.page?.path;
          if (!path) continue;

          const { pageCategory, pageName } = classifyPath(path);
          
          // Only update if classification is different or missing
          const needsUpdate = 
            event.page?.pageCategory !== pageCategory ||
            event.page?.name !== pageName ||
            !event.page?.pageCategory ||
            !event.page?.name;

          if (needsUpdate) {
            await FunnelEvent.updateOne(
              { _id: event._id },
              {
                $set: {
                  'page.pageCategory': pageCategory,
                  'page.name': pageName
                }
              }
            );
            stats.events.updated++;
          }
        } catch (error) {
          console.error(`Error updating event ${event._id}:`, error);
          stats.events.errors++;
        }
      }

      // Fix FunnelSessions
      console.log('Starting FunnelSession classification fix...');
      const sessions = await FunnelSession.find({ 'landingPage.path': { $exists: true } })
        .select('_id landingPage')
        .limit(limit)
        .lean();

      for (const session of sessions) {
        stats.sessions.processed++;
        
        try {
          const path = session.landingPage?.path;
          if (!path) continue;

          const { pageCategory, pageName } = classifyPath(path);
          
          // Only update if classification is different or missing
          const needsUpdate = 
            session.landingPage?.pageCategory !== pageCategory ||
            session.landingPage?.name !== pageName ||
            !session.landingPage?.pageCategory ||
            !session.landingPage?.name;

          if (needsUpdate) {
            await FunnelSession.updateOne(
              { _id: session._id },
              {
                $set: {
                  'landingPage.pageCategory': pageCategory,
                  'landingPage.name': pageName
                }
              }
            );
            stats.sessions.updated++;
          }
        } catch (error) {
          console.error(`Error updating session ${session._id}:`, error);
          stats.sessions.errors++;
        }
      }

      console.log('Classification fix complete:', stats);

      return NextResponse.json({
        success: true,
        message: 'Page classification fixed',
        stats
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "analyze" or "fix"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in fix-page-classification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
