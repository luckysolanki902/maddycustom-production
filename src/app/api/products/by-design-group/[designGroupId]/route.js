import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

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

    const enhancedProducts = products
      .map(product => {
        const newProduct = {
          ...product,
          variant: product.specificCategoryVariant,
          category: product.specificCategory,
        };

        delete newProduct.specificCategory;
        delete newProduct.specificCategoryVariant;

        return newProduct;
      })
      .filter(
        (prod, index, self) =>
          index === self.findIndex(p => String(p.category?._id) === String(prod.category?._id))
      );


    return Response.json({
      success: true,
      products: enhancedProducts || [],
    });
  } catch (error) {
    console.error('Error fetching products by design group:', error);
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
