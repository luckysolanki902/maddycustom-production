// @/app/api/auth/send-otp/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function POST(request) {
    try {
        const { phoneNumber, authMethod = 'whatsapp' } = await request.json();

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

    // Generate OTP
    const otp = user.generateOTP();
    
    // Save the user with OTP data
    await user.save();
    
    // Debug log to confirm OTP is saved
    console.log('Debug - Generated OTP:', otp);
    console.log('Debug - Saved hashed OTP:', user.otpDetails?.otp);// Send OTP via WhatsApp
        if (authMethod === 'whatsapp') {
            const result = await sendWhatsAppMessage({
                user: {
                    _id: user._id,
                    phoneNumber: user.phoneNumber,
                    name: 'User'
                },
                campaignName: 'LoginWithWhatsapp',
                templateParams: [otp],
                isOTPCampaign: true, // Explicitly mark this as an OTP campaign to skip campaign logs
          buttons: [
                        {
                            "type": "button",
                            "sub_type": "url",
                            "index": "0",
                            "parameters": [
                                {
                                    "type": "text",
                                    "text": `${otp}`
                                }
                            ]
                        }
                    ]
            });
            console.log({ result })
  
            if (!result.success) {
                return NextResponse.json(
                    { message: 'Failed to send OTP via WhatsApp', error: result.message },
                    { status: 500 }
                );
            }
        } else if (authMethod === 'sms') {
            // Implement SMS sending logic here when ready
            // For now, return an error since it's not implemented yet
            return NextResponse.json(
                { message: 'SMS delivery not yet implemented' },
                { status: 501 }
            );
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
