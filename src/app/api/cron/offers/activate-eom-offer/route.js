// api/cron/offers/activate-eom-offer/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import mongoose from 'mongoose';
const Offer = require('@/models/Offer');

/**
 * Activates the End-of-Month offer (EOM50)
 * Scheduled to run at 11:30 AM in Washington time on days 25-27
 * Sets the offer to active only if we're in the last 5 days of the month
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

    // Calculate current date and end of month
    const now = new Date();
    
    // Get the last day of the current month (end of month at 23:59:59)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Check if we're in the last 5 days of the month
    const lastDayOfMonth = endOfMonth.getDate();
    const currentDay = now.getDate();
    const daysUntilEndOfMonth = lastDayOfMonth - currentDay;
    
    // Verify we're in the last 5 days (0-4 days remaining)
    if (daysUntilEndOfMonth > 4) {
      return NextResponse.json({
        message: `Cannot activate EOM offer yet. Currently ${daysUntilEndOfMonth} days before end of month. Must be within 5 days of month end.`,
        activated: false,
        tooEarly: true,
        currentDay,
        lastDayOfMonth,
        daysUntilEndOfMonth
      });
    }
    
    // Ensure now and endOfMonth dates are valid and endOfMonth is after now
    if (isNaN(now.getTime()) || isNaN(endOfMonth.getTime())) {
      return NextResponse.json(
        { message: "Invalid date calculation" },
        { status: 500 }
      );
    }
    
    if (endOfMonth <= now) {
      return NextResponse.json(
        { message: "End of month date must be after current date" },
        { status: 500 }
      );
    }
    
    // First check if the offer is already active for the current month
    const existingOffer = await Offer.findById(offerId);
    
    if (!existingOffer) {
      return NextResponse.json(
        { message: `Offer with ID ${offerId} not found` },
        { status: 404 }
      );
    }
    
    // Check if offer is already active and valid until the end of this month
    if (existingOffer.isActive) {
      const existingValidUntil = new Date(existingOffer.validUntil);
      
      // Check if the validUntil is already set to the end of current month
      if (
        existingValidUntil.getFullYear() === endOfMonth.getFullYear() &&
        existingValidUntil.getMonth() === endOfMonth.getMonth() &&
        existingValidUntil.getDate() === endOfMonth.getDate()
      ) {
        console.log(`EOM offer is already active for this month. Valid until: ${existingOffer.validUntil.toISOString()}`);
        
        return NextResponse.json({
          message: "End of Month offer is already active for this month",
          activated: false,
          alreadyActive: true,
          validFrom: existingOffer.validFrom.toISOString(),
          validUntil: existingOffer.validUntil.toISOString()
        });
      }
    }
    
    // If we reach here, the offer needs to be activated for this month
    console.log(`Activating EOM offer from ${now.toISOString()} until ${endOfMonth.toISOString()}`);
    
    // Calculate days remaining in month for discount validity
    const daysRemaining = daysUntilEndOfMonth + 1; // +1 because we include the current day
    
    try {
      // Update the offer in the database
      const result = await Offer.findByIdAndUpdate(
        offerId,
        { 
          isActive: true,
          validFrom: now, 
          validUntil: endOfMonth,
          // Ensure EOM50 code is set
          $addToSet: { couponCodes: "EOM50" },
          // Add description with activation details
          description: `End of Month Special: ₹50 off on all products. Valid for ${daysRemaining} days until end of month.`
        },
        { new: true, runValidators: true }
      );

      // Format dates for the log
      console.log(`EOM offer activated successfully. Valid from ${result.validFrom.toISOString()} to ${result.validUntil.toISOString()}`);

      // Return success response
      return NextResponse.json({
        message: "End of Month offer activated successfully",
        activated: true,
        validFrom: result.validFrom.toISOString(),
        validUntil: result.validUntil.toISOString(),
        daysRemaining
      });
    } catch (validationError) {
      console.error("Validation error while activating offer:", validationError);
      return NextResponse.json(
        { 
          message: "Validation error while activating offer", 
          error: validationError.message,
          details: "Please check date format and ensure validUntil is after validFrom"
        },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error("Error activating EOM offer:", error);
    return NextResponse.json(
      { message: error.message || "Failed to activate offer" },
      { status: 500 }
    );
  }
}
