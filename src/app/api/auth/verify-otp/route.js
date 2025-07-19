// @/app/api/auth/verify-otp/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { phoneNumber, otp, shipRocketToken } = await request.json();

    // Validate input
    if (!phoneNumber || !otp) {
      return NextResponse.json({ message: "Phone number and OTP are required" }, { status: 400 });
    }

    // Connect to database
    await connectToDatabase(); 
    
    // Find user with OTP details explicitly selected
    const user = await User.findOne({ phoneNumber }).select("+otpDetails.otp +otpDetails.otpExpiry +otpDetails.resendAllowedAt +otpDetails.otpAttempts");

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (!user.otpDetails) {
      return NextResponse.json({ message: "No active OTP found. Please request a new OTP." }, { status: 400 });
    } 
    
    // Verify OTP
    if (!shipRocketToken) {
      // Check if otpDetails exists
      console.log("Debug - Received OTP:", otp);
      console.log("Debug - User otpDetails:", user.otpDetails);
      console.log("Debug - Stored hashed OTP:", user.otpDetails?.otp);
      
      let verificationResult;

      if (otp === "123456") {
        console.log("Debug - Using test OTP bypass");
        // Create a successful result and handle like normal verification
        user.isVerified = true;
        user.lastLoginAt = new Date();
        user.otpDetails = {
          otp: undefined,
          otpExpiry: undefined,
          resendAllowedAt: undefined,
          otpAttempts: 0,
        };
        await user.save();
        
        verificationResult = { success: true };
      } else {
        // Debug the OTP verification
        console.log("Debug - Verifying real OTP...");
        
        // Check if user has otpDetails
        if (!user.otpDetails || !user.otpDetails.otp) {
          console.log("Debug - No OTP details found");
          
          // Check if user is already verified (OTP was already used successfully)
          if (user.isVerified) {
            return NextResponse.json(
              { message: "OTP has already been verified. Please proceed to the next step." },
              { status: 400 }
            );
          }
          
          return NextResponse.json(
            { message: "No active OTP found. Please request a new OTP." },
            { status: 400 }
          );
        }
        
        try {
          // Normal verification
          verificationResult = user.verifyOTP(otp);
          console.log("Debug - Verification result:", verificationResult);
        } catch (error) {
          console.error("Debug - Error during OTP verification:", error);
          return NextResponse.json(
            { message: "Error verifying OTP. Please try again." },
            { status: 400 }
          );
        }

        if (!verificationResult.success) {
          return NextResponse.json(
            {
              message: verificationResult.message || "Invalid OTP",
              remainingAttempts: 5 - (user.otpDetails?.otpAttempts || 0),
            },
            { status: 400 }
          );
        }
      }
    // if using shiprocket
    } else {
      try {
        // Step 1: Verify OTP with Shiprocket
        const verifyBody = {
          token: shipRocketToken,
          otp,
          user_address_consent: !!shipRocketToken,
        };

        const shiprocketVerifyResponse = await fetch("https://checkout-api.shiprocket.com/api/v1/access-token/s2s-login/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(verifyBody),
        });

        const shiprocketVerifyData = await shiprocketVerifyResponse.json();
        console.log("Shiprocket verification response:", shiprocketVerifyData);

        if (!shiprocketVerifyResponse.ok || !shiprocketVerifyData.ok) {
          return NextResponse.json(
            { message: "Failed to verify OTP with Shiprocket", error: shiprocketVerifyData },
            { status: 500 }
          );
        }

        const authorisedCustomerToken = shiprocketVerifyData.result.authorised_customer_token;

        // Step 2: Fetch customer data
        const customerDataBody = {
          token: authorisedCustomerToken,
        };

        const shiprocketCustomerResponse = await fetch("https://checkout-api.shiprocket.com/api/v1/customer-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerDataBody),
        });

        const shiprocketCustomerData = await shiprocketCustomerResponse.json();
        console.log("Shiprocket customer data response:", shiprocketCustomerData);

        if (!shiprocketCustomerResponse.ok) {
          return NextResponse.json(
            { message: "Failed to fetch Shiprocket customer data", error: shiprocketCustomerData },
            { status: 500 }
          );
        }

        user.shiprocketCustomerData = shiprocketCustomerData.result;

        // Fallback for name
        if (!user.name && user.shiprocketCustomerData.addresses?.[0]?.first_name) {
          user.name = user.shiprocketCustomerData.addresses[0].first_name;
        }

        // Fallback for email
        if (!user.email && user.shiprocketCustomerData.addresses?.[0]?.email) {
          user.email = user.shiprocketCustomerData.addresses[0].email;
        }

        // Fallback for addresses
        if ((!user.addresses || user.addresses.length === 0) && user.shiprocketCustomerData.addresses?.length > 0) {
          const addr = user.shiprocketCustomerData.addresses[0];
          user.addresses = [
            {
              receiverName: addr.first_name || "",
              receiverPhoneNumber: addr.phone || user.phoneNumber,
              addressLine1: addr.line1 || "",
              addressLine2: addr.line2 || "",
              city: addr.city || "",
              state: addr.state || "",
              country: addr.country || "India",
              pincode: addr.pincode || "",
              isPrimary: true,
            },
          ];
        }
      } catch (shiprocketError) {
        console.error("Error during Shiprocket OTP verification flow:", shiprocketError);
        return NextResponse.json({ message: "Error verifying with Shiprocket", error: shiprocketError.message }, { status: 500 });
      }
    }

    // OTP is valid, generate JWT token
    const token = user.generateAuthToken();

    // Save updated user data
    await user.save();

    // Set HTTP-only cookie with the token
    const cookieStore = await cookies();
    cookieStore.set({
      name: "authToken",
      value: token,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      sameSite: "strict",
    });

    // Return success response with user data (exclude sensitive fields)
    return NextResponse.json(
      {
        message: "Authentication successful",
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          name: user.name || "",
          isVerified: user.isVerified,
          email: user.email || "",
          hasPrimaryAddress: user.addresses.some(addr => addr.isPrimary),
          addressDetails: user.addresses.find(addr => addr.isPrimary) ?? user.addresses[0],
        },
        // Include token in response for client-side storage if needed
        token,
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
