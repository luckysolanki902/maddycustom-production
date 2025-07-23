import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';

export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    
    const { designGroupId } = params;
    
    if (!designGroupId) {
      return Response.json(
        { success: false, message: 'Design group ID is required' },
        { status: 400 }
      );
    }

    // Find products with the same design group ID
    const products = await Product.find({
      designGroupId: designGroupId,
      available: true,
    })
    .populate('specificCategory', 'name')
    .populate('specificCategoryVariant', 'name')
    .lean();

    return Response.json({
      success: true,
      products: products || [],
    });
  } catch (error) {
    console.error('Error fetching products by design group:', error);
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
