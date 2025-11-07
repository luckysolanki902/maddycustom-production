import { NextResponse } from 'next/server';

import { GET as baseProductsGet } from '../route';

export const revalidate = 1; // Revalidate this route every 10 hours

export async function GET(request) {
  const url = new URL(request.url);
  const collectionId = url.searchParams.get('collection_id') ?? url.searchParams.get('collectionId');

  if (!collectionId) {
    return NextResponse.json(
      { error: 'collection_id query parameter is required.' },
      { status: 400 },
    );
  }

  return baseProductsGet(request);
}
