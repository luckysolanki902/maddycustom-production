import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import Product from '@/models/Product';

export const revalidate = 3600; // 1 hour edge cache

export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 6;
    
    // Fetch both interior and exterior products
    const results = {
      interior: [],
      exterior: []
    };

    // Process both types
    for (const type of ['interior', 'exterior']) {
      const classificationTag = type === 'interior' ? 'car-interiors' : 'car-exteriors';

      try {
        // Find specific categories that match the classification tag and are available
        const specificCategories = await SpecificCategory.find({
          classificationTags: { $in: [classificationTag] },
          available: true
        }).select('_id name pageSlug');
        if (specificCategories.length > 0) {
          // Get one product from each specific category
          for (const category of specificCategories.slice(0, limit)) {
            try {
              // Find one available product from this specific category
              const product = await Product.findOne({
                specificCategory: category._id,
                available: true,
              })
              .populate('specificCategory', 'name pageSlug')
              .select('name price specificCategory images')
              .lean();

              if (product) {
                const productSlug = product.specificCategory?.pageSlug;
                const productListPageSlug = productSlug ? productSlug.split('/').slice(0, -1).join('/') : null;
                
                results[type].push({
                  _id: product._id,
                  name: product.specificCategory?.name || 'Unknown Category',
                  price: product.price || 0,
                  categorySlug: product.specificCategory?.pageSlug,
                  productId: product._id,
                  productListPageSlug,
                  image: product.images?.[0] || null,
                  type
                });
              }
            } catch (err) {
              console.error(`Error fetching product for ${type} category ${category._id}:`, err);
              continue;
            }
          }
        }
      } catch (err) {
        console.error(`Error processing ${type} products:`, err);
      }
    }
    console.log(JSON.stringify(results, null, 2));
    return Response.json({
      success: true,
      data: results,
      totals: {
        interior: results.interior.length,
        exterior: results.exterior.length
      }
    });

  } catch (error) {
    console.error('Error fetching car interior/exterior products:', error);
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
