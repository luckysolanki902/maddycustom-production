import connectToDatabase from '@/lib/middleware/connectToDb';
import DisplayAsset from '@/models/DisplayAssets';
import { NextResponse } from 'next/server';
import { shouldDisplayAsset } from '@/lib/utils/displayAssetUtils';

// Conditional revalidation: enable caching only in production
export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 1800; // No cache in dev, 30 minutes in prod 

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const componentName = searchParams.get('componentName');
    // Build query object
    let query = { isActive: true };
    
    if (page) {
      query.page = page;
    }
    
    if (componentName) {
      query.componentName = componentName;
    }

    // Fetch display assets based on query
    const assets = await DisplayAsset.find(query)
      .sort({ position: 1, createdAt: 1 })
      .lean();


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
