// @/app/api/analytics/search-track/route.js
import { NextResponse } from 'next/server';

import connectToDb from '@/lib/middleware/connectToDb';
import SearchQuery from '@/models/data-tracking/SearchQuery';

// POST-only route: No caching needed (writes data)

export async function POST(request) {
  try {
    // Don't await database connection to make it non-blocking
    const dbConnection = connectToDb();
    
    const body = await request.json();
    const { query, clickedPageSlug, resultType, sessionId, userId } = body;

    // Validate required field
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Run tracking in background - don't await to avoid blocking response
    setImmediate(async () => {
      try {
        await dbConnection; // Now await the connection
        await SearchQuery.logSearch({
          query: query.trim(),
          clickedPageSlug,
          resultType,
          sessionId,
          userId,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Background search tracking failed:', error);
        // Silently fail - don't affect user experience
      }
    });

    // Return immediately without waiting for database operation
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Search tracking error:', error);
    // Return success even on error to not affect user experience
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

export async function GET(request) {
  try {
    await connectToDb();
    
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit')) || 100;
    const skip = parseInt(searchParams.get('skip')) || 0;
    const query = searchParams.get('query');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build match criteria
    const matchCriteria = {};
    
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      matchCriteria.createdAt = dateFilter;
    }

    // Aggregation pipeline to get search queries
    const pipeline = [
      { $match: matchCriteria },
      { $unwind: '$queries' },
      { $sort: { 'queries.timestamp': -1 } },
    ];

    // Add query filter if provided
    if (query) {
      pipeline.push({
        $match: {
          'queries.query': { $regex: query, $options: 'i' }
        }
      });
    }

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Project the data
    pipeline.push({
      $project: {
        _id: 0,
        query: '$queries.query',
        timestamp: '$queries.timestamp',
        clickedPageSlug: '$queries.clickedPageSlug',
        resultType: '$queries.resultType',
        userId: '$queries.userId',
        sessionId: '$queries.sessionId',
      }
    });

    const searchQueries = await SearchQuery.aggregate(pipeline);

    // Get total count for pagination
    const countPipeline = [
      { $match: matchCriteria },
      { $unwind: '$queries' },
    ];
    
    if (query) {
      countPipeline.push({
        $match: {
          'queries.query': { $regex: query, $options: 'i' }
        }
      });
    }
    
    countPipeline.push({ $count: 'total' });
    
    const countResult = await SearchQuery.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: searchQueries,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });

  } catch (error) {
    console.error('Error fetching search queries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
