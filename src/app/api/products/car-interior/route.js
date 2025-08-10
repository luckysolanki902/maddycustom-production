import { connectToDatabase } from '@/lib/server/database';
import SpecificCategory from '@/models/SpecificCategory';
import Product from '@/models/Product';

export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'interior' or 'exterior'
    const limit = parseInt(searchParams.get('limit')) || 6;
    
    if (!type || !['interior', 'exterior'].includes(type)) {
      return Response.json(
        { error: 'Invalid type. Must be "interior" or "exterior"' },
        { status: 400 }
      );
    }

    const classificationTag = type === 'interior' ? 'car-interiors' : 'car-exterior';

    // Find specific categories that match the classification tag and are available
    const specificCategories = await SpecificCategory.find({
      classificationTags: { $in: [classificationTag] },
      isAvailable: true
    }).select('_id name pageSlug');

    if (!specificCategories.length) {
      return Response.json({
        success: true,
        products: [],
        message: `No ${type} categories found`
      });
    }

    // Get one product from each specific category
    const products = [];
    
    for (const category of specificCategories.slice(0, limit)) {
      try {
        // Find one available product from this specific category
        const product = await Product.findOne({
          specificCategory: category._id,
          isAvailable: true,
          isActive: true
        })
        .populate('specificCategory', 'name pageSlug')
        .select('name price specificCategory')
        .lean();

        if (product) {
          products.push({
            _id: product._id,
            name: product.specificCategory?.name || 'Unknown Category',
            price: product.price || 0,
            categorySlug: product.specificCategory?.pageSlug,
            productId: product._id
          });
        }
      } catch (err) {
        console.error(`Error fetching product for category ${category._id}:`, err);
        continue;
      }
    }

    return Response.json({
      success: true,
      products,
      total: products.length,
      type
    });

  } catch (error) {
    console.error(`Error fetching ${searchParams.get('type')} products:`, error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to fetch products',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
