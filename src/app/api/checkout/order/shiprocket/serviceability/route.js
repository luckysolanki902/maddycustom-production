// /app/api/checkout/order/shiprocket/serviceability/route.js
import { NextResponse } from 'next/server';
import { checkServiceability } from '@/lib/utils/shiprocket';
export async function GET(request) {
    try {
      const { searchParams } = new URL(request.url);
      const pickupPostcode = searchParams.get('pickup_postcode');
      const deliveryPostcode = searchParams.get('delivery_postcode');
  
      if (!pickupPostcode || !deliveryPostcode) {
        return NextResponse.json(
          { error: 'Missing pickup or delivery postcode' },
          { status: 400 }
        );
      }
  
      const result = await checkServiceability(pickupPostcode, deliveryPostcode);
  
      // Example: define "serviceable" by whether we have at least 1 available courier
      const isServiceable = !!(
        result?.data?.available_courier_companies &&
        result.data.available_courier_companies.length > 0
      );
  
      // Return a simpler response shape
      return NextResponse.json({
        serviceable: isServiceable,
        raw: result, // the original Shiprocket data if you want to pass it along
      });
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  