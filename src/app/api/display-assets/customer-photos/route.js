import connectToDatabase from '@/lib/middleware/connectToDb';
import DisplayAsset from '@/models/DisplayAssets';
import { NextResponse } from 'next/server';
import { shouldDisplayAsset } from '@/lib/utils/displayAssetUtils';

export const revalidate = 3600; // ISR: 1 hour

function toRelativeLink(link) {
  if (!link) return link;
  try {
    if (/^https?:\/\//i.test(link)) {
      const u = new URL(link);
      return (u.pathname || '/') + (u.search || '') + (u.hash || '');
    }
    if (/^\/\//.test(link)) {
      const u = new URL('https:' + link);
      return (u.pathname || '/') + (u.search || '') + (u.hash || '');
    }
    return link.startsWith('/') ? link : '/' + link;
  } catch (e) {
    return link && link.startsWith('/') ? link : (link ? '/' + link : link);
  }
}

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page'); // optional page filter (e.g., 'homepage', 'viewcart')
    const limitParam = searchParams.get('limit');

    const baseQuery = { isActive: true };
    if (page) baseQuery.page = page;

    // Fetch only assets that match the customer-photos predicate
    let query = DisplayAsset.find({
      ...baseQuery,
      $or: [
        { componentName: 'customer-photos-section' },
        { componentId: { $regex: 'customer-photo', $options: 'i' } }
      ]
    }).sort({ position: 1, createdAt: 1 });

    if (limitParam) {
      const l = parseInt(limitParam, 10);
      if (!isNaN(l) && l > 0) query = query.limit(l);
    }

    const rows = await query.lean();
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const assets = (rows || [])
      .filter(a => shouldDisplayAsset(a))
      .map(a => {
        const out = { ...a };
        if (a.media) {
          if (a.media.desktop) {
            out.media = out.media || {};
            out.media.desktop = a.media.desktop.startsWith('http')
              ? a.media.desktop
              : `${baseUrl}${a.media.desktop.startsWith('/') ? a.media.desktop : '/' + a.media.desktop}`;
          }
          if (a.media.mobile) {
            out.media = out.media || {};
            out.media.mobile = a.media.mobile.startsWith('http')
              ? a.media.mobile
              : `${baseUrl}${a.media.mobile.startsWith('/') ? a.media.mobile : '/' + a.media.mobile}`;
          }
        }
        if (a.link) out.link = toRelativeLink(a.link);
        return out;
      });

    const response = NextResponse.json({ assets, count: assets.length, ts: Date.now() }, { status: 200 });

    // Strong caching both at edge/proxy and browser
    if (process.env.NODE_ENV === 'development') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Surrogate-Control', 'no-store');
    } else {
      // s-maxage for CDN/proxy, max-age for browser, allow brief stale
      response.headers.set('Cache-Control', 'public, s-maxage=3600, max-age=3600, stale-while-revalidate=60');
    }

    return response;
  } catch (e) {
    console.error('[customer-photos] error:', e.message);
    return NextResponse.json({ assets: [], error: 'failed' }, { status: 500 });
  }
}
