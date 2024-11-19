import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/middleware/connectToDb";
import Order from "@/models/Order";
import { getDimensionsAndWeight } from "@/lib/utils/shiprocket";

export async function GET(req) {
  try {
    await connectToDatabase();

    // Fetch the order to test population logic
    const orderId = "673c950f071ff371035f4bc7"; // Replace with a valid order ID
    const order = await Order.findById(orderId)
      .populate({
        path: "items.product",
        populate: {
          path: "specificCategoryVariant",
          model: "SpecificCategoryVariant",
        },
      });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Extract dimensions and weights
    const dimensionsAndWeight = await getDimensionsAndWeight(order.items);

    return NextResponse.json({ order, dimensionsAndWeight });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "An error occurred while fetching dimensions" },
      { status: 500 }
    );
  }
}
