
import { NextResponse } from 'next/server';
import Product from '@/models/Product';
import dbConnect from '@/lib/dbConnect';

export async function GET(request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const designGroupId = searchParams.get('designGroupId');
  const productId = searchParams.get('productId');

  if (!designGroupId) {
    return NextResponse.json({ message: 'designGroupId is required' }, { status: 400 });
  }

  try {
    const products = await Product.find({
      designGroupId,
      _id: { $ne: productId }, // Exclude the product that was just added
      available: true,
    }).populate('specificCategory', 'name');

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching recommended products:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
