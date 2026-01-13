import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';

// Cache sales stats for 10 minutes
export const revalidate = 600;

/**
 * GET /api/stats/sales?type=specificCategory|specificCategoryVariant&id=<id>&days=<optionalDays>&round=<true|false>
 * Returns the total number of items sold (quantity) for the specified category/variant in the last `days` days.
 * If "round" is true, the total is rounded according to a simple e-commerce rounding principle.
 */
export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // "specificCategory" OR "specificCategoryVariant"
    const id = searchParams.get('id'); // the category/variant id
    const daysParam = searchParams.get('days');
    const roundParam = searchParams.get('round');
    const days = daysParam ? parseInt(daysParam, 10) : 10;
    const doRound = roundParam === 'true';

    // Validate required parameters
    if (!type || !id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required query parameters: type and id',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'specificCategory' && type !== 'specificCategoryVariant') {
      return new Response(
        JSON.stringify({
          error: 'Invalid type. Must be either "specificCategory" or "specificCategoryVariant"',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert the provided id into a MongoDB ObjectId
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(id);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid id format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate the start date from which to count orders
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build the match condition based on the type provided.
    const productMatchCondition =
      type === 'specificCategory'
        ? { 'productDoc.specificCategory': objectId }
        : { 'productDoc.specificCategoryVariant': objectId };

    // Build the aggregation pipeline
    const pipeline = [
      // 1. Only consider orders from the last `days` days.
      { $match: { createdAt: { $gte: startDate } } },
      // 2. Unwind the items array
      { $unwind: '$items' },
      // 3. Lookup the Product document for each order item.
      {
        $lookup: {
          from: 'products', // Adjust if your collection name is different.
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      { $unwind: '$productDoc' },
      // 4. Filter to include only order items matching the given category/variant.
      { $match: productMatchCondition },
      // 5. Group all matching items and sum the quantity.
      {
        $group: {
          _id: null,
          totalItemsSold: { $sum: '$items.quantity' },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    let totalItemsSold = result.length > 0 ? result[0].totalItemsSold : 0;

    // Apply rounding if requested.
    if (doRound) {
      if (totalItemsSold < 100) {
        totalItemsSold = Math.round(totalItemsSold / 10) * 10;
      } else if (totalItemsSold < 1000) {
        totalItemsSold = Math.round(totalItemsSold / 100) * 100;
      } else {
        totalItemsSold = Math.round(totalItemsSold / 1000) * 1000;
      }
    }

    return new Response(JSON.stringify({ totalItemsSold }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in GET /api/stats/sales:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
