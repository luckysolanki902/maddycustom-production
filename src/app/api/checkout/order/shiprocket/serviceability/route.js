// /app/api/checkout/order/shiprocket/serviceability/route.js
import { NextResponse } from 'next/server';
import { checkServiceability } from '@/lib/utils/shiprocket';

export const dynamic = 'force-dynamic';

// Create a simple in-memory cache for serviceability results
// This is a simple implementation - for production consider Redis or a more robust solution
const serviceabilityCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pickupPostcode = searchParams.get('pickup_postcode');
    const deliveryPostcode = searchParams.get('delivery_postcode');

    if (!pickupPostcode || !deliveryPostcode) {
      return NextResponse.json(
        { error: 'Missing pickup or delivery postcode' },
        { status: 400 }
      );
    }

    // Create a cache key
    const cacheKey = `${pickupPostcode}-${deliveryPostcode}`;
    
    // Check if we have a cached result
    if (serviceabilityCache.has(cacheKey)) {
      const { data, timestamp } = serviceabilityCache.get(cacheKey);
      
      // Check if the cache is still valid
      if (Date.now() - timestamp < CACHE_TTL) {
        return NextResponse.json(data);
      } else {
        // Cache expired, delete it
        serviceabilityCache.delete(cacheKey);
      }
    }
    
    // No valid cache, make the API call
    const result = await checkServiceability(pickupPostcode, deliveryPostcode);

    // Determine serviceability based on available courier companies
    const isServiceable = !!(
      result?.data?.available_courier_companies &&
      result.data.available_courier_companies.length > 0
    );

    // Prepare response data
    const responseData = {
      serviceable: isServiceable,
      deliveryPostcode: deliveryPostcode,
      // Include minimal data from the result
      courierOptions: result?.data?.available_courier_companies?.length || 0
    };
    
    // Cache the result
    serviceabilityCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Serviceability check error:', error);
    return NextResponse.json({ 
      error: error.message,
      serviceable: false 
    }, { status: 500 });
  }
}
