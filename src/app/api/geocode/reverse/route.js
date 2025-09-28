// Simple reverse geocoding API route using OpenStreetMap Nominatim (server-side fetch)
// IMPORTANT: This is a lightweight, rate-limited public service; consider a paid provider for production.

import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 });

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'maddycustom/1.0 (reverse-geocode)'
      }
    });

    if (!res.ok) throw new Error('Failed to reverse geocode');

    const data = await res.json();
    const a = data.address || {};

    // Build a more accurate area/locality using common OSM fields
    const areaCandidates = [
      a.neighbourhood,
      a.locality,
      a.quarter,
      a.suburb,
      a.ward,
      a.city_district,
      a.residential,
      a.village,
      a.town,
      a.hamlet
    ].filter(Boolean);

    const areaLocality = areaCandidates[0] || '';

    // Potential POI / building names as landmark
    const poi = a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure || data.name || '';

    const payload = {
      areaLocality,
      road: a.road || a.pedestrian || a.cycleway || a.footway || '',
      houseNumber: a.house_number || '',
      poi,
      city: a.city || a.town || a.village || a.suburb || a.county || '',
      state: a.state || a.state_district || '',
      pincode: a.postcode || ''
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: 'Reverse geocoding failed' }, { status: 500 });
  }
}
