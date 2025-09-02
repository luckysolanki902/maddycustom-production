import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Inventory from '@/models/Inventory';

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
      designGroupId,
      available: true,
    })
      .populate("inventoryData specificCategoryVariant specificCategory")
      .lean();

    const enhancedProducts = await Promise.all(
      products
        .map(async (product) => {
          const newProduct = {
            ...product,
            variant: product.specificCategoryVariant,
            category: product.specificCategory,
          };

          // If product has no images and has options available, get first image from options
          if ((!newProduct.images || newProduct.images.length === 0) && newProduct.v) {
            const firstOption = await Option.findOne({ product: product._id }).lean();
            if (firstOption?.images && firstOption.images.length > 0) {
              newProduct.images = firstOption.images;
            }
          }

          delete newProduct.specificCategory;
          delete newProduct.specificCategoryVariant;

          return newProduct;
        })
    );

    const uniqueProducts = enhancedProducts
      .filter(
        (prod, index, self) =>
          index === self.findIndex(p => String(p.category?._id) === String(prod.category?._id))
      );


    return Response.json({
      success: true,
      products: uniqueProducts || [],
    });
  } catch (error) {
    console.error('Error fetching products by design group:', error);
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
