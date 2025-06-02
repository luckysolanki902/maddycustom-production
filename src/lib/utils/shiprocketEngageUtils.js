"use client";
import { v4 as uuidv4 } from "uuid";

const sendCustomFeedEvent = async (eventName, payload, userId) => {
  const url = "http://tracker.wigzopush.com/rest/v1/learn/event?token=9359622121db2e233493a&org_token=JhjA7cNKTNqZ_4UAlx_iSQ";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName,
        eventval: payload,
        eventCategory: "EXTERNAL",
        userId,
        is_active: true,
        source: "web",
      }),
    });

    if (!res.ok) {
      throw new Error(`Tracking API error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Error sending event:", error);
  }
};

export const purchase = async (order, userData = {}) => {
  try {
    const payload = {
      orderId: order._id,
      customer_id: order.user._id,
      email: order.user?.email ?? "",
      phone: order.address?.receiverPhoneNumber ?? "",
      fullName: order.address?.receiverName ?? "",
      total_price: order.totalAmount,
      total_line_items_price: order.totalAmount,
      cart_token: order.cartToken ?? uuidv4(), //
      checkout_token: order.checkoutToken ?? uuidv4(), //
      ga_transaction_id: order.paymentDetails?.razorpayDetails?.paymentId ?? "",
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      shipping_cost: order.extraCharges?.find(c => c.chargesName.toLowerCase() === "delivery")?.chargesAmount ?? 0,
      total_discounts: order.totalDiscount ?? 0,
      city: userData.city ?? "", //
      state: userData.state ?? "", //
      country: userData.country ?? "India",
      zip: userData.zip ?? "",
      financial_status: order.paymentDetails?.mode?.name ?? "online",
      taxes_included: true,
      coupons: order.couponApplied?.map(c => c.couponCode) ?? [],
      line_items:
        order.items?.map(item => ({
          line_item_id: item.product?._id, //
          variant_id: item.product?._id, //
          product_id: item.product?._id,
          price: item.priceAtPurchase,
          quantity: item.quantity,
          product_discount: item.product?.price - item.product?.MRP,
          fulfillment_status: "Pending", //
          categories: item.product?.category, //
          type: "product",
        })) ?? [],
    };
    await sendCustomFeedEvent("order", payload, userData.userId);
  } catch (err) {
    console.error("Error in order event in shiprocketEngageUtils :", err instanceof Error ? err.message : JSON.stringify(err));
  }
};

export const viewContent = async (product, variant, category, description, userData = {}) => {
  try {
    const payload = {
      canonicalUrl: product.pageSlug,
      tags: product.mainTags?.join(", ") ?? "",
      title: product.title,
      description, //
      price: `${product.price}`,
      productType: product.subCategory, //
      vendor: "Maddy Custom",
      author: "Maddy Custom",
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      productId: product._id,
      image: product.images[0] ?? "",
      category: category.name, //
      language: "en",
      variants: [
        {
          variant_id: variant._id,
          product_id: product._id,
          updated_at: variant.updatedAt,
          created_at: variant.createdAt,
          title: variant.title ?? variant.name,
          sku: product.sku ?? "",
          image: product.images[0] ?? "",
          inventory_quantity: product.inventoryData?.availableQuantity ?? "1",
          price: `${product.price}`,
          position: product.position ?? "", //
          recorded_cost: `${product.MRP}`,
        },
      ],
    };

    await sendCustomFeedEvent("product/push", payload, userData.userId);
  } catch (err) {
    console.error(
      "Error in product/push event in shiprocketEngageUtils :",
      err instanceof Error ? err.message : JSON.stringify(err)
    );
  }
};

export const initiateCheckout = async (checkoutData, cartItems, userData = {}) => {
  try {
    const payload = {
      completed_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      referring_site: "", //
      currency: "INR",
      source_identifier: "", //
      total_discounts: checkoutData.discount ?? 0, // discountAmountFinal
      total_line_items_price: checkoutData.totalValue,
      total_price: checkoutData.totalCost,
      total_tax: checkoutData.tax ?? 0, //
      abandoned_checkout_url: window.location.href,
      line_items: cartItems.map(item => ({
        checkout_id: cartItems.checkoutId ?? uuidv4(), //
        applied_discounts_json: null, //
        key: "",
        gift_card: "",
        product_id: item.productDetails._id ?? item.productId,
        quantity: item.quantity ?? 1,
        sku: item.productDetails.sku ?? "",
        taxable: true,
        title: item.productDetails.title ?? item.productDetails.name,
        variant_id: item.productDetails._id,
        variant_title: item.productDetails.title,
        variant_price: `${item.productDetails.price ?? 0}`,
        vendor: "Maddy Custom", // item.productDetails.brand ? item.productDetails.brand.toString() : "Maddy Custom"
        compare_at_price: `${item.productDetails.MRP ?? ""}`,
        price: `${item.productDetails.price ?? 0}`,
      })),
    };

    await sendCustomFeedEvent("checkout", payload, userData.userId);
  } catch (err) {
    console.error("Error in checkout event in shiprocketEngageUtils :", err instanceof Error ? err.message : JSON.stringify(err));
  }
};

export const identifyUser = async (userData = {}) => {
  if (!userData.email && !userData.phoneNumber) {
    console.warn("identify: email or phone is required.");
    return;
  }
  try {
    const payload = {
      phone: `${userData.phoneNumber ?? ""}`,
      createdAt: userData.createdAt ?? new Date().toISOString(),
      updatedAt: userData.updatedAt ?? new Date().toISOString(),
      email: `${userData.email ?? ""}`,
      firstName: userData.firstName ?? "",
      lastName: userData.lastName ?? "",
      customer_id: userData.userId ?? uuidv4(),
      postal_code: userData.postalCode ?? "", //
      city: userData.city ?? "",
      state: userData.state ?? "",
      country: userData.country ?? "India",
      country_code: userData.countryCode ?? "IN",
    };

    await sendCustomFeedEvent("identify", payload, userData.userId);
  } catch (err) {
    console.error("Error in identify event in shiprocketEngageUtils :", err instanceof Error ? err.message : JSON.stringify(err));
  }
};
