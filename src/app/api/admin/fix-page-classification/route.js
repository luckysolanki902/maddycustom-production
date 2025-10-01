import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import FunnelEvent from '@/models/analytics/FunnelEvent';
import FunnelSession from '@/models/analytics/FunnelSession';

function classifyPath(path) {
  if (!path || typeof path !== 'string') {
    return { pageCategory: 'other', pageName: 'other' };
  }

  const trimmedPath = path.trim();
  const pathWithoutQuery = trimmedPath.split('?')[0]?.split('#')[0] ?? '';
  const normalizedPath = pathWithoutQuery.length ? pathWithoutQuery : '/';

  // Home page
  if (normalizedPath === '/' || normalizedPath === '') {
    return { pageCategory: 'home', pageName: 'home' };
  }

  // Split path and filter empty segments
  const segments = normalizedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return { pageCategory: 'home', pageName: 'home' };
  }

  // Not a shop path
  if (segments[0] !== 'shop') {
    return { pageCategory: 'other', pageName: 'other' };
  }

  // Count segments after 'shop'
  const segmentsAfterShop = segments.length - 1;

  if (segmentsAfterShop === 4) {
    return { pageCategory: 'product-list-page', pageName: 'product-list-page' };
  }

  if (segmentsAfterShop === 5) {
    return { pageCategory: 'product-id-page', pageName: 'product-id-page' };
  }

  // Anything else defaults to other
  return { pageCategory: 'other', pageName: 'other' };
}

export async function GET(request) {
  try {
    console.log('Starting fix for ALL documents...');
    
    await connectToDatabase();

    const stats = {
      events: { total: 0, updated: 0, errors: 0 },
      sessions: { total: 0, updated: 0, errors: 0 }
    };

    // Fix ALL FunnelEvents (uses page.path and page.pageCategory)
    console.log('\n=== Processing FunnelEvents ===');
    const allEvents = await FunnelEvent.find({}).lean();
    stats.events.total = allEvents.length;
    console.log(`Total FunnelEvents found: ${allEvents.length}\n`);
    
    let eventIndex = 0;
    for (const event of allEvents) {
      eventIndex++;
      try {
        const pagePath = event.page?.path;
        const pageSlug = event.page?.slug;
        const currentCategory = event.page?.pageCategory;
        const correctClassification = classifyPath(pagePath);
        
        // Log EVERY event with its classification
        console.log(`[${eventIndex}/${allEvents.length}] EVENT | Path: "${pagePath}" | Slug: "${pageSlug || 'N/A'}" | Current: "${currentCategory || 'MISSING'}" | Classified: "${correctClassification.pageCategory}"`);
        
        // Update if pageCategory doesn't exist or is incorrect
        if (!currentCategory || currentCategory !== correctClassification.pageCategory) {
          console.log(`  ↳ UPDATING: ${currentCategory || 'MISSING'} → ${correctClassification.pageCategory}`);
          
          await FunnelEvent.findByIdAndUpdate(
            event._id,
            {
              $set: {
                'page.pageCategory': correctClassification.pageCategory,
                'page.name': correctClassification.pageName
              }
            }
          );
          stats.events.updated++;
        } else {
          console.log(`  ↳ SKIPPED (already correct)`);
        }
      } catch (error) {
        console.error(`Error updating event ${event._id}:`, error);
        stats.events.errors++;
      }
    }

    // Fix ALL FunnelSessions (uses landingPage.path and landingPage.pageCategory)
    console.log('\n=== Processing FunnelSessions ===');
    const allSessions = await FunnelSession.find({}).lean();
    stats.sessions.total = allSessions.length;
    console.log(`Total FunnelSessions found: ${allSessions.length}\n`);
    
    let sessionIndex = 0;
    for (const session of allSessions) {
      sessionIndex++;
      try {
        const landingPath = session.landingPage?.path;
        const landingSlug = session.landingPage?.slug;
        const currentCategory = session.landingPage?.pageCategory;
        const correctClassification = classifyPath(landingPath);
        
        // Log EVERY session with its classification
        console.log(`[${sessionIndex}/${allSessions.length}] SESSION | Path: "${landingPath}" | Slug: "${landingSlug || 'N/A'}" | Current: "${currentCategory || 'MISSING'}" | Classified: "${correctClassification.pageCategory}"`);
        
        // Update if landingPage.pageCategory doesn't exist or is incorrect
        if (!currentCategory || currentCategory !== correctClassification.pageCategory) {
          console.log(`  ↳ UPDATING: ${currentCategory || 'MISSING'} → ${correctClassification.pageCategory}`);
          
          await FunnelSession.findByIdAndUpdate(
            session._id,
            {
              $set: {
                'landingPage.pageCategory': correctClassification.pageCategory,
                'landingPage.name': correctClassification.pageName
              }
            }
          );
          stats.sessions.updated++;
        } else {
          console.log(`  ↳ SKIPPED (already correct)`);
        }
      } catch (error) {
        console.error(`Error updating session ${session._id}:`, error);
        stats.sessions.errors++;
      }
    }

    console.log('\n=== Fix completed ===');
    console.log('Stats:', stats);
    console.log(`Events: ${stats.events.updated}/${stats.events.total} updated`);
    console.log(`Sessions: ${stats.sessions.updated}/${stats.sessions.total} updated`);

    return NextResponse.json({
      success: true,
      message: 'All documents processed successfully',
      stats
    });

  } catch (error) {
    console.error('Error in fix route:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
