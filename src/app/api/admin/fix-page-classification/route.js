import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import FunnelEvent from '@/models/analytics/FunnelEvent';
import FunnelSession from '@/models/analytics/FunnelSession';

function normalizePath(path) {
  if (!path || typeof path !== 'string') {
    return '/';
  }

  const trimmed = path.trim();
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? '';
  let normalized = withoutQuery.length ? withoutQuery : '/';

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  // Collapse multiple slashes and remove trailing slash (except root)
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/u, '');
  }

  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return '/';
  }

  if (segments[0] === 'shop') {
    return normalized.length ? normalized : '/';
  }

  // If the path looks like a catalog/product path (≥4 segments) but is missing /shop, prefix it
  if (segments.length >= 4) {
    return `/shop/${segments.join('/')}`;
  }

  return normalized.length ? normalized : '/';
}

function classifyPath(path) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath === '/' || normalizedPath === '') {
    return { normalizedPath: '/', pageCategory: 'home', pageName: 'home' };
  }

  const segments = normalizedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return { normalizedPath: '/', pageCategory: 'home', pageName: 'home' };
  }

  if (segments[0] !== 'shop') {
    return { normalizedPath, pageCategory: 'other', pageName: 'other' };
  }

  const segmentsAfterShop = segments.length - 1;

  if (segmentsAfterShop === 4) {
    return { normalizedPath, pageCategory: 'product-list-page', pageName: 'product-list-page' };
  }

  if (segmentsAfterShop === 5) {
    return { normalizedPath, pageCategory: 'product-id-page', pageName: 'product-id-page' };
  }

  return { normalizedPath, pageCategory: 'other', pageName: 'other' };
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
        const { normalizedPath, pageCategory, pageName } = classifyPath(pagePath);

        // Log EVERY event with its classification
        console.log(`[${eventIndex}/${allEvents.length}] EVENT | Path: "${pagePath}" | Normalized: "${normalizedPath}" | Slug: "${pageSlug || 'N/A'}" | Current: "${currentCategory || 'MISSING'}" | Classified: "${pageCategory}"`);

        const updateFields = {};
        if (!currentCategory || currentCategory !== pageCategory) {
          updateFields['page.pageCategory'] = pageCategory;
          updateFields['page.name'] = pageName;
        }
        if (normalizedPath && normalizedPath !== pagePath) {
          updateFields['page.path'] = normalizedPath;
        }

        if (Object.keys(updateFields).length > 0) {
          console.log(`  ↳ UPDATING: ${JSON.stringify(updateFields)}`);
          await FunnelEvent.findByIdAndUpdate(event._id, { $set: updateFields });
          stats.events.updated++;
        } else {
          console.log('  ↳ SKIPPED (already correct)');
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
        const { normalizedPath, pageCategory, pageName } = classifyPath(landingPath);

        // Log EVERY session with its classification
        console.log(`[${sessionIndex}/${allSessions.length}] SESSION | Path: "${landingPath}" | Normalized: "${normalizedPath}" | Slug: "${landingSlug || 'N/A'}" | Current: "${currentCategory || 'MISSING'}" | Classified: "${pageCategory}"`);

        const updateFields = {};
        if (!currentCategory || currentCategory !== pageCategory) {
          updateFields['landingPage.pageCategory'] = pageCategory;
          updateFields['landingPage.name'] = pageName;
        }
        if (normalizedPath && normalizedPath !== landingPath) {
          updateFields['landingPage.path'] = normalizedPath;
        }

        if (Object.keys(updateFields).length > 0) {
          console.log(`  ↳ UPDATING: ${JSON.stringify(updateFields)}`);
          await FunnelSession.findByIdAndUpdate(session._id, { $set: updateFields });
          stats.sessions.updated++;
        } else {
          console.log('  ↳ SKIPPED (already correct)');
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
