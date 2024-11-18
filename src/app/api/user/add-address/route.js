// app/api/user/add-address/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

// Helper function to compare addresses
const areAddressesEqual = (addr1, addr2) => {
    return (
        addr1.receiverPhoneNumber.trim() === addr2.receiverPhoneNumber.trim() &&
        addr1.addressLine1.trim().toLowerCase() === addr2.addressLine1.trim().toLowerCase() &&
        (addr1.addressLine2?.trim().toLowerCase() === (addr2.addressLine2 || '').trim().toLowerCase()) &&
        addr1.city.trim().toLowerCase() === addr2.city.trim().toLowerCase() &&
        addr1.state.trim().toLowerCase() === addr2.state.trim().toLowerCase() &&
        addr1.pincode.trim() === addr2.pincode.trim()
    );
};

export async function POST(request) {
    try {
        // Parse the JSON body of the request
        const { phoneNumber, address } = await request.json();

        // Validate required fields
        if (!phoneNumber || !address) {
            return NextResponse.json(
                { message: 'Phone number and address are required' },
                { status: 400 }
            );
        }

        // Validate address fields
        const requiredAddressFields = ['receiverName', 'receiverPhoneNumber', 'addressLine1', 'city', 'state', 'pincode'];
        for (const field of requiredAddressFields) {
            if (!address[field] || typeof address[field] !== 'string' || address[field].trim() === '') {
                return NextResponse.json(
                    { message: `Address field '${field}' is required and must be a non-empty string` },
                    { status: 400 }
                );
            }
        }

        // Connect to the database
        await connectToDatabase();

        // Find the user by phone number
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return NextResponse.json(
                { message: 'User not found' },
                { status: 404 }
            );
        }

        // Check if the address already exists
        const addressExists = user.addresses.some(existingAddress => areAddressesEqual(existingAddress, address));

        if (addressExists) {
            return NextResponse.json(
                { message: 'Address already exists' },
                { status: 200 }
            );
        }

        // Add the new address to the user's addresses array
        user.addresses.push(address);
        await user.save();

        // Respond with success and the updated addresses
        return NextResponse.json(
            { message: 'Address added successfully', addresses: user.addresses },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error adding address:', error);

        // Respond with a generic error message
        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

