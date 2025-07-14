// /app/api/orders/user/route.js

import connectToDatabase from "@/lib/middleware/connectToDb";
import Order from "@/models/Order";
import { NextResponse } from "next/server";

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");

		if (!userId) {
			return NextResponse.json({ message: "User ID is required" }, { status: 400 });
		}
	
		await connectToDatabase();

    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return NextResponse.json({ message: "Error fetching orders" }, { status: 500 });
  }
}
