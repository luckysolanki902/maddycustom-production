import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import mongoose from 'mongoose';
const Offer = require('@/models/Offer');


/**
 * TEST ENDPOINT: Force activates the End-of-Month offer (EOM50) regardless of date
 * This is a temporary endpoint for testing purposes only
 */
export async function GET(request) {
  try {
    await connectToDatabase();
    
    // Get optional test parameters from query
  const searchParams = request.nextUrl.searchParams;
    const forceDays = searchParams.get('days') ? parseInt(searchParams.get('days')) : null;
    const forceReset = searchParams.get('reset') === 'true';
    
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
    
    // For testing: if forceDays is provided, set endOfMonth to that many days from now
    if (forceDays !== null) {
      endOfMonth.setTime(now.getTime() + (forceDays * 24 * 60 * 60 * 1000));
    }
    
    
    // If reset flag is true, deactivate before activating
    if (forceReset) {
      await Offer.findByIdAndUpdate(
        offerId,
        { isActive: false },
        { new: false }
      );
    }
    
    // First check if the offer already exists
    const existingOffer = await Offer.findById(offerId);
    
    if (!existingOffer) {
      return NextResponse.json(
        { message: `Offer with ID ${offerId} not found` },
        { status: 404 }
      );
    }
    
    // Calculate days remaining for display purposes
    const daysRemaining = Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24));
    
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
          description: `[TEST] End of Month Special: ₹50 off on all products. Valid for ${daysRemaining} days until ${endOfMonth.toISOString()}. Activated: ${now.toISOString()}`
        },
        { new: true, runValidators: true }
      );

      // Format dates for the log

      // Return success response
      return NextResponse.json({
        message: "TEST API: End of Month offer activated successfully",
        activated: true,
        validFrom: result.validFrom.toISOString(),
        validUntil: result.validUntil.toISOString(),
        daysRemaining,
        note: "This is a test activation and may not follow the normal date restrictions"
      });
    } catch (validationError) {
      console.error("TEST API: Validation error while activating offer:", validationError);
      
      // Try with a workaround for the validation issue
      if (validationError.message.includes("validUntil must be after validFrom")) {
        
        // First update with validFrom null
        await Offer.findByIdAndUpdate(
          offerId,
          { 
            validFrom: null,
            validUntil: null,
            isActive: false
          },
          { runValidators: false }
        );
        
        // Then update with the correct values
        const fixedResult = await Offer.findByIdAndUpdate(
          offerId,
          { 
            isActive: true,
            validFrom: now, 
            validUntil: new Date(now.getTime() + (24 * 60 * 60 * 1000)), // Always at least 1 day later
            $addToSet: { couponCodes: "EOM50" },
            description: `[TEST-FIXED] End of Month Special: ₹50 off on all products. Valid for at least 1 day. Activated: ${now.toISOString()}`
          },
          { new: true }
        );
        
        return NextResponse.json({
          message: "TEST API: End of Month offer activated with workaround",
          activated: true,
          validFrom: fixedResult.validFrom.toISOString(),
          validUntil: fixedResult.validUntil.toISOString(),
          workaround: true
        });
      }
      
      return NextResponse.json(
        { 
          message: "TEST API: Validation error while activating offer", 
          error: validationError.message
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("TEST API: Error activating EOM offer:", error);
    return NextResponse.json(
      { message: error.message || "Failed to activate offer in test API" },
      { status: 500 }
    );
  }
}
