import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import mongoose from 'mongoose';
const Offer = require('@/models/Offer');

/**
 * Deactivates the End-of-Month offer (EOM50)
 * Scheduled to run on days 28-31 at 23:59 (Washington time)
 * Only actually deactivates if today is the last day of the month
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    // Specific offer ID to update
    const offerId = '680bc736194c066a5df1f948';
    
    // Validate the offer ID
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return NextResponse.json(
        { message: "Invalid offer ID format" },
        { status: 400 }
      );
    }
    
    // Check if today is actually the last day of the month
    const now = new Date();
    const today = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Only deactivate if this is the last day of the month
    // This ensures the cron job only takes effect on the actual last day
    // regardless of whether it's the 28th, 29th, 30th, or 31st
    if (today !== lastDayOfMonth) {
      return NextResponse.json({
        message: `Not deactivating - today (${today}) is not the last day of the month (${lastDayOfMonth})`,
        deactivated: false
      });
    }
    
    
    // Get the current offer to check if it's already deactivated
    const currentOffer = await Offer.findById(offerId);
    if (!currentOffer) {
      return NextResponse.json(
        { message: `Offer with ID ${offerId} not found` },
        { status: 404 }
      );
    }
    
    if (!currentOffer.isActive) {
      return NextResponse.json({
        message: "Offer is already deactivated",
        deactivated: false
      });
    }
    
    // Update the offer in the database
    const result = await Offer.findByIdAndUpdate(
      offerId,
      { 
        isActive: false,
        // Add a note about deactivation time to the description
        $set: { 
          description: `End of Month Special (Expired). Was valid until: ${currentOffer.validUntil.toISOString()}.`
        }
      },
      { new: true, runValidators: true }
    );

    // Log deactivation for monitoring

    // Return success response
    return NextResponse.json({
      message: "End of Month offer deactivated successfully",
      deactivated: true,
      deactivatedAt: now.toISOString(),
      wasValidUntil: currentOffer.validUntil.toISOString()
    });
    
  } catch (error) {
    console.error("Error deactivating EOM offer:", error);
    return NextResponse.json(
      { message: error.message || "Failed to deactivate offer" },
      { status: 500 }
    );
  }
}
