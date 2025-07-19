// @/app/api/auth/send-otp/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';
import crypto from "crypto";

export async function POST(request) {
    try {
        const { phoneNumber, authMethod = "whatsapp", shipRocketUserConsent = false, useShiprocket = false } = await request.json();

        // Validate phone number
        if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
            return NextResponse.json(
                { message: 'Valid phone number is required' },
                { status: 400 }
            );
        }

        // Connect to database
        await connectToDatabase();

        // Find or create user
        let user = await User.findOne({ phoneNumber }).select('+otpDetails');

        if (!user) {
            // Create a new user with the phone number
            user = new User({
                phoneNumber,
                name: '',
                isVerified: false,
                preferredAuthMethod: authMethod,
                otpDetails: {
                    otp: null,
                    otpExpiry: null,
                    resendAllowedAt: null,
                    otpAttempts: 0,
                }
            });
        }

        // Check if resend is allowed
        if (
            user.otpDetails &&
            user.otpDetails.resendAllowedAt &&
            new Date(user.otpDetails.resendAllowedAt) > new Date()
        ) {
            const waitTimeSeconds = Math.ceil(
                (new Date(user.otpDetails.resendAllowedAt) - new Date()) / 1000
            );
            return NextResponse.json(
                {
                    message: 'Please wait before requesting another OTP',
                    waitTime: waitTimeSeconds
                },
                { status: 429 }
            );
        }

    const isShiprocket = authMethod === "sms" && !user.addresses.length && shipRocketUserConsent && useShiprocket;

    console.log('Debug - useShiprocket:', useShiprocket);
    console.log('Debug - isShiprocket:', isShiprocket);
    console.log('Debug - authMethod:', authMethod);
    console.log('Debug - user addresses length:', user.addresses.length);
    console.log('Debug - shipRocketUserConsent:', shipRocketUserConsent);

    // Generate OTP
    const otp = user.generateOTP({ isShiprocket });

    console.log('Debug - Generated OTP:', otp);
    console.log('Debug - OTP Details before save:', user.otpDetails);

    // Save the user with OTP data
    await user.save();
    
    console.log('Debug - OTP Details after save:', user.otpDetails);
    
    // Debug log to confirm OTP is saved
    console.log('Debug - Saved hashed OTP:', user.otpDetails?.otp);
        if (authMethod === "whatsapp") {
          return NextResponse.json({ message: "WhatsApp OTP deprecated ", error: smsError.message }, { status: 500 });
          // const result = await sendWhatsAppMessage({
          //   user: {
          //     _id: user._id,
          //     phoneNumber: user.phoneNumber,
          //     name: "User",
          //   },
          //   campaignName: "LoginWithWhatsapp",
          //   templateParams: [otp],
          //   isOTPCampaign: true, // Explicitly mark this as an OTP campaign to skip campaign logs
          //   buttons: [
          //     {
          //       type: "button",
          //       sub_type: "url",
          //       index: "0",
          //       parameters: [
          //         {
          //           type: "text",
          //           text: `${otp}`,
          //         },
          //       ],
          //     },
          //   ],
          // });
          // console.log({ result });

          // if (!result.success) {
          //   return NextResponse.json({ message: "Failed to send OTP via WhatsApp", error: result.message }, { status: 500 });
          // }
        } else if (isShiprocket) {
            const body = {
              country_code: "91",
              phone: phoneNumber,
              modes: ["SMS"],
              timestamp: new Date().toISOString(),
            };

            const bodyString = JSON.stringify(body);

            // Generate HMAC SHA256 of body string, base64 encoded
            const hmac = crypto.createHmac("sha256", process.env.SHIPROCKET_SECRET);
            hmac.update(bodyString);
            const hash = hmac.digest("base64");

            try {
              const shiprocketResponse = await fetch(
                "https://checkout-api.shiprocket.com/api/v1/access-token/s2s-login/initiate",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.SHIPROCKET_API_KEY,
                    "X-Api-HMAC-SHA256": hash,
                  },
                  body: bodyString,
                }
              );

              const shiprocketData = await shiprocketResponse.json();
              console.log(shiprocketData);

              if (!shiprocketResponse.ok) {
                return NextResponse.json(
                  { message: "Failed to send OTP via Shiprocket", error: shiprocketData },
                  { status: 500 }
                );
              }

              // You might want to return here if no further processing is needed
              return NextResponse.json(
                {
                  message: "OTP sent successfully via Shiprocket",
                  phoneNumber,
                  userId: user._id,
                  resendAllowedAt: user.otpDetails.resendAllowedAt,
                  maskedPhone: `${phoneNumber.substring(0, 2)}******${phoneNumber.substring(8)}`,
                  shiprocketToken: shiprocketData.result.token,
                },
                { status: 200 }
              );
            } catch (shiprocketError) {
              console.error("Error sending OTP via Shiprocket:", shiprocketError);
              return NextResponse.json(
                { message: "Failed to send OTP via Shiprocket", error: shiprocketError.message },
                { status: 500 }
              );
            }
        } else if (authMethod === "sms") {
            try {
              const url = "https://control.msg91.com/api/v5/flow";
              // "https://control.msg91.com/api/v5/otp";
              // `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&authkey=${apiKey}&realTimeResponse=1`

              const payload = {
                template_id: "685e7fbbd6fc054c4264e0f2",
                short_url: "1",
                recipients: [{ mobiles: `91${phoneNumber}`, otp }],
              };

              const smsResponse = await fetch(url, {
                method: "POST",
                headers: {
                  authkey: process.env.MSG91_API_KEY,
                  accept: "application/json",
                  "content-type": "application/json",
                },
                body: JSON.stringify(payload),
              });

              const smsData = await smsResponse.json();

              if (smsData.type !== "success") {
                return NextResponse.json({ message: "Failed to send OTP via SMS", error: smsData }, { status: 500 });
              }
            } catch (smsError) {
              console.error("Error sending SMS via MSG91:", smsError);
              return NextResponse.json({ message: "Failed to send OTP via SMS", error: smsError.message }, { status: 500 });
            }
        } else {
            return NextResponse.json({ message: "No valid OTP method provided" }, { status: 500 });
        }

        return NextResponse.json(
            {
                message: 'OTP sent successfully',
                phoneNumber,
                userId: user._id,
                resendAllowedAt: user.otpDetails.resendAllowedAt,
                // Only return part of the phone number for UI display
                maskedPhone: `${phoneNumber.substring(0, 2)}******${phoneNumber.substring(8)}`
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Error sending OTP:', error);
        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
