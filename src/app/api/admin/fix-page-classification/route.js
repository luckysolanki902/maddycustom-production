import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import FunnelEvent from '@/models/analytics/FunnelEvent';
import FunnelSession from '@/models/analytics/FunnelSession';

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
  const segments = normalizedPath.split('/').map(s => s.trim()).filter(Boolean);

  // Not a shop path
  if (!segments[0] || segments[0] !== 'shop') {
    return { pageCategory: 'other', pageName: 'other' };
  }

  // Count total segments (including 'shop')
  const totalSegments = segments.length;
  
  // 4 parts total (shop + 3 more) = product-list-page
  // 5 parts total (shop + 4 more) = product-id-page
  if (totalSegments === 4) {
    return { pageCategory: 'product-list-page', pageName: 'product-list-page' };
  } else if (totalSegments === 5) {
    return { pageCategory: 'product-id-page', pageName: 'product-id-page' };
  }
  
  // Anything else with shop
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
    console.log('Processing FunnelEvents...');
    const allEvents = await FunnelEvent.find({}).lean();
    stats.events.total = allEvents.length;
    
    for (const event of allEvents) {
      try {
        const pagePath = event.page?.path;
        const currentCategory = event.page?.pageCategory;
        const correctClassification = classifyPath(pagePath);
        
        // Update if pageCategory doesn't exist or is incorrect
        if (!currentCategory || currentCategory !== correctClassification.pageCategory) {
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
        }
      } catch (error) {
        console.error(`Error updating event ${event._id}:`, error);
        stats.events.errors++;
      }
    }

    // Fix ALL FunnelSessions (uses landingPage.path and landingPage.pageCategory)
    console.log('Processing FunnelSessions...');
    const allSessions = await FunnelSession.find({}).lean();
    stats.sessions.total = allSessions.length;
    
    for (const session of allSessions) {
      try {
        const landingPath = session.landingPage?.path;
        const currentCategory = session.landingPage?.pageCategory;
        const correctClassification = classifyPath(landingPath);
        
        // Update if landingPage.pageCategory doesn't exist or is incorrect
        if (!currentCategory || currentCategory !== correctClassification.pageCategory) {
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
        }
      } catch (error) {
        console.error(`Error updating session ${session._id}:`, error);
        stats.sessions.errors++;
      }
    }

    console.log('Fix completed:', stats);

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
