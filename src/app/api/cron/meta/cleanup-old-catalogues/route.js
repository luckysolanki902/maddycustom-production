// app/api/cron/meta/cleanup-old-catalogues/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import { NextResponse } from 'next/server';

// Set maximum timeout
export const maxDuration = 300; // 5 minutes in seconds

/**
 * Cleanup old catalogue cycles and their entries
 * Keeps only the latest N completed cycles and deletes older ones
 * This prevents the database from growing indefinitely with old catalogue data
 */
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    // Verify authorization (optional - add your auth check here)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Configuration: Keep the latest N completed cycles
    const CYCLES_TO_KEEP = 3; // Keep last 3 completed cycles
    const DAYS_TO_KEEP = 7; // Alternative: Keep cycles from last 7 days

    // Get all completed cycles sorted by most recent first
    const completedCycles = await CatalogueCycle.find({ 
      status: 'completed' 
    })
    .sort({ startedAt: -1 })
    .lean();

    if (completedCycles.length <= CYCLES_TO_KEEP) {
      return NextResponse.json({
        success: true,
        message: 'No cleanup needed',
        totalCycles: completedCycles.length,
        cyclesToKeep: CYCLES_TO_KEEP,
        deletedCycles: 0,
        deletedCatalogueEntries: 0,
        processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
        timestamp: new Date().toISOString(),
      });
    }

    // Get cycles to delete (keep the latest N, delete the rest)
    const cyclesToKeep = completedCycles.slice(0, CYCLES_TO_KEEP);
    const cyclesToDelete = completedCycles.slice(CYCLES_TO_KEEP);

    // Also check for old in_progress cycles (stuck/abandoned cycles older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stuckCycles = await CatalogueCycle.find({
      status: 'in_progress',
      startedAt: { $lt: oneDayAgo }
    }).lean();

    const allCyclesToDelete = [...cyclesToDelete, ...stuckCycles];
    const cycleIdsToDelete = allCyclesToDelete.map(cycle => cycle._id);

    if (cycleIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No old cycles to cleanup',
        totalCycles: completedCycles.length,
        cyclesToKeep: CYCLES_TO_KEEP,
        deletedCycles: 0,
        deletedCatalogueEntries: 0,
        processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
        timestamp: new Date().toISOString(),
      });
    }

    // Delete catalogue entries associated with old cycles
    const catalogueDeleteResult = await Catalogue.deleteMany({
      cycleId: { $in: cycleIdsToDelete }
    });

    // Delete the old cycles themselves
    const cycleDeleteResult = await CatalogueCycle.deleteMany({
      _id: { $in: cycleIdsToDelete }
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      success: true,
      message: 'Old catalogues cleaned up successfully',
      totalCyclesFound: completedCycles.length,
      cyclesToKeep: CYCLES_TO_KEEP,
      keptCycles: cyclesToKeep.map(c => ({
        cycleId: c._id.toString(),
        startedAt: c.startedAt,
        processedCount: c.processedCount,
      })),
      deletedCycles: cycleDeleteResult.deletedCount,
      deletedStuckCycles: stuckCycles.length,
      deletedCatalogueEntries: catalogueDeleteResult.deletedCount,
      cyclesDeleted: allCyclesToDelete.map(c => ({
        cycleId: c._id.toString(),
        startedAt: c.startedAt,
        status: c.status,
        processedCount: c.processedCount,
      })),
      processingTimeSeconds: processingTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in catalogue cleanup cron:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error',
        message: error.message,
        processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}
