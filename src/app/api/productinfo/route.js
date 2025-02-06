// /app/api/productinfo/route.js
import ProductInfoTab from '@/models/ProductInfoTab';
import connectToDatabase from '@/lib/middleware/connectToDb';
// import { ObjectId } from 'mongodb';

/**
 * GET /api/productinfo?type=...&id=...
 *
 * Loads the description for a given reference.
 */
export async function GET(request) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const refId = searchParams.get("id");

    if (!type || !refId) {
      return new Response(
        JSON.stringify({ error: "Missing required query parameters (type, id)" }),
        { status: 400 }
      );
    }
    const tab = searchParams.get("tab");
    

    // Connect to the database
    await connectToDatabase();

    // Build the query based on the type (priority order: product > variant > category)
    let query = {};
    if (tab) {
        query.title = tab;  // assuming your schema field that stores the tab is called "title"
        }
    if (type === "product") {
      query.product = refId;
    } else if (type === "variant") {
      query.specificCategoryVariant = refId;
      query.product=null;
    } else if (type === "category") {
      query.product=null;
      query.specificCategoryVariant=null;
      query.specificCategory = refId;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be 'product', 'variant' or 'category'." }),
        { status: 400 }
      );
    }

    // Find one document matching the reference
    const productInfo = await ProductInfoTab.findOne(query);
    if (!productInfo) {
      return new Response(
        JSON.stringify({ message: "No description found for the given reference." }),
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(productInfo), { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/productinfo:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}