// app/api/meta/catalogue-status/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import Catalogue from '@/models/meta/Catalogue';
import { NextResponse } from 'next/server';

export const revalidate = 0; // Don't cache this endpoint

export async function GET() {
  try {
    await connectToDatabase();

    // Get current active cycle
    const activeCycle = await CatalogueCycle.findOne({ 
      status: 'in_progress' 
    }).sort({ startedAt: -1 });

    // Get latest completed cycle
    const latestCompletedCycle = await CatalogueCycle.findOne({ 
      status: 'completed' 
    }).sort({ startedAt: -1 });

    // Get all cycles for history
    const allCycles = await CatalogueCycle.find()
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();

    // If there's an active cycle, get its catalogue count
    let activeCycleStats = null;
    if (activeCycle) {
      const catalogueCount = await Catalogue.countDocuments({ 
        cycleId: activeCycle._id 
      });
      
      activeCycleStats = {
        cycleId: activeCycle._id,
        startedAt: activeCycle.startedAt,
        lastProcessedIndex: activeCycle.lastProcessedIndex,
        processedCount: activeCycle.processedCount,
        catalogueEntriesCount: catalogueCount,
        processingErrors: activeCycle.processingErrors || [],
        status: activeCycle.status,
      };
    }

    // If there's a latest completed cycle, get its stats
    let latestCompletedStats = null;
    if (latestCompletedCycle) {
      const catalogueCount = await Catalogue.countDocuments({ 
        cycleId: latestCompletedCycle._id 
      });
      
      latestCompletedStats = {
        cycleId: latestCompletedCycle._id,
        startedAt: latestCompletedCycle.startedAt,
        completedAt: latestCompletedCycle.updatedAt,
        processedCount: latestCompletedCycle.processedCount,
        catalogueEntriesCount: catalogueCount,
        processingErrors: latestCompletedCycle.processingErrors || [],
        status: latestCompletedCycle.status,
      };
    }

    // Get total catalogue entries
    const totalCatalogueEntries = await Catalogue.countDocuments();

    return NextResponse.json({
      success: true,
      activeCycle: activeCycleStats,
      latestCompletedCycle: latestCompletedStats,
      totalCatalogueEntries,
      cycleHistory: allCycles.map(cycle => ({
        cycleId: cycle._id,
        startedAt: cycle.startedAt,
        status: cycle.status,
        processedCount: cycle.processedCount,
        errorCount: cycle.processingErrors ? cycle.processingErrors.length : 0,
        completedAt: cycle.status === 'completed' ? cycle.updatedAt : null,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting catalogue status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}
