import connectToDatabase from '@/lib/middleware/connectToDb';
import DisplayAsset from '@/models/DisplayAssets';
import { NextResponse } from 'next/server';
import { shouldDisplayAsset } from '@/lib/utils/displayAssetUtils';

export const revalidate = 300;  

// Convert any link (absolute or relative) to a root-relative URL that always starts with '/'
function toRelativeLink(link) {
  if (!link) return link;
  try {
    // If absolute URL, extract pathname + search + hash
    if (/^https?:\/\//i.test(link)) {
      const u = new URL(link);
      return (u.pathname || '/') + (u.search || '') + (u.hash || '');
    }
    // Protocol-relative URLs (//domain/path)
    if (/^\/\//.test(link)) {
      const u = new URL('https:' + link);
      return (u.pathname || '/') + (u.search || '') + (u.hash || '');
    }
    // Ensure it starts with a single '/'
    return link.startsWith('/') ? link : '/' + link;
  } catch (e) {
    // Fallback: ensure leading slash
    return link.startsWith('/') ? link : '/' + link;
  }
}

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
  const page = searchParams.get('page');
  const componentName = searchParams.get('componentName');
  const idsParam = searchParams.get('ids'); // comma-separated Mongo _id list
  const limitParam = searchParams.get('limit');
    // Build query object
    let query = { isActive: true };
    
    if (page) {
      query.page = page;
    }
    
    if (componentName) {
      query.componentName = componentName;
    }

    // If specific ids requested, override query to those ids (still respecting isActive unless explicitly disabled later)
    let idsFilter = null;
    if (idsParam) {
      const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length) {
        idsFilter = ids;
      }
    }

    let mongoQuery = DisplayAsset.find(idsFilter ? { _id: { $in: idsFilter }, ...query } : query)
      .sort({ position: 1, createdAt: 1 });

    if (limitParam) {
      const l = parseInt(limitParam, 10);
      if (!isNaN(l) && l > 0) mongoQuery = mongoQuery.limit(l);
    }

    const assets = await mongoQuery.lean();


    if (!assets || assets.length === 0) {
      return NextResponse.json({ 
        assets: [],
        message: 'No display assets found' 
      }, { status: 200 });
    }

    // Get CloudFront base URL
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    // Filter assets based on display rules and prepare response
    const filteredAssets = assets
      .filter(asset => shouldDisplayAsset(asset))
      .map(asset => {
        // Append CloudFront base URL to media URLs
        const processedAsset = { ...asset };
        
        if (asset.media) {
          if (asset.media.desktop) {
            processedAsset.media.desktop = asset.media.desktop.startsWith('http') 
              ? asset.media.desktop 
              : `${baseUrl}${asset.media.desktop.startsWith('/') ? asset.media.desktop : '/' + asset.media.desktop}`;
          }
          if (asset.media.mobile) {
            processedAsset.media.mobile = asset.media.mobile.startsWith('http') 
              ? asset.media.mobile 
              : `${baseUrl}${asset.media.mobile.startsWith('/') ? asset.media.mobile : '/' + asset.media.mobile}`;
          }
        }

        // Normalize link to always be root-relative (no protocol/host)
        if (asset.link) {
          processedAsset.link = toRelativeLink(asset.link);
        }

        return processedAsset;
      });

    
    // Create response with appropriate cache headers
    const response = NextResponse.json({ 
      assets: filteredAssets,
      count: filteredAssets.length,
      timestamp: new Date().toISOString()
    }, { status: 200 });

    // In development, add no-cache headers
    if (process.env.NODE_ENV === 'development') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Surrogate-Control', 'no-store');
    }

    return response;

  } catch (error) {
    console.error('Error fetching display assets:', error.message);
    return NextResponse.json({ 
      error: 'Failed to fetch display assets',
      assets: [] 
    }, { status: 500 });
  }
}
