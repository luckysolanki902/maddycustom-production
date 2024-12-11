// /app/api/test/dimensions/route.js

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/middleware/connectToDb";
import Order from "@/models/Order"; // Adjust the path as necessary
import SpecificCategoryVariant from "@/models/SpecificCategoryVariant"; // Adjust the path as necessary
import PackagingBox from "@/models/PackagingBox"; // Ensure this model exists
import { getDimensionsAndWeight } from "@/lib/utils/shiprocket";

export async function POST(request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required." },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Fetch the order by ID, populate necessary fields
    const order = await Order.findById(orderId)
      .populate({
        path: "items.product",
        populate: {
          path: "specificCategoryVariant",
          populate: {
            path: "packagingDetails.boxId",
            model: "PackagingBox",
          },
        },
      })
      .exec();

    if (!order) {
      return NextResponse.json(
        { message: "Order not found." },
        { status: 404 }
      );
    }

    // Extract items from the order
    const items = order.items.map((item) => ({
      product: {
        specificCategoryVariant: item.product.specificCategoryVariant,
      },
      quantity: item.quantity,
      _id: item._id, // Assuming each item has an _id
    }));

    // Calculate dimensions and weight
    const dimensionsAndWeight = await getDimensionsAndWeight(items);

    return NextResponse.json({ dimensionsAndWeight }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/test/dimensions:", error);
    return NextResponse.json(
      { message: "Internal Server Error." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required." },
        { status: 400 }
      );
    }

    // Connect to the database
    await dbConnect();

    // Fetch the order by ID, populate necessary fields
    const order = await Order.findById(orderId)
      .populate({
        path: "items.product",
        populate: {
          path: "specificCategoryVariant",
          populate: {
            path: "packagingDetails.boxId",
            model: "PackagingBox",
          },
        },
      })
      .exec();

    if (!order) {
      return NextResponse.json(
        { message: "Order not found." },
        { status: 404 }
      );
    }

    // Extract items from the order
    const items = order.items.map((item) => ({
      product: {
        specificCategoryVariant: item.product.specificCategoryVariant,
      },
      quantity: item.quantity,
      _id: item._id, // Assuming each item has an _id
    }));

    // Calculate dimensions and weight
    const dimensionsAndWeight = await getDimensionsAndWeight(items);

    return NextResponse.json({ dimensionsAndWeight }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/test/dimensions:", error);
    return NextResponse.json(
      { message: "Internal Server Error." },
      { status: 500 }
    );
  }
}
