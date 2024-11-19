// lib/utils/shiprocket.js
import axios from 'axios';
const SpecificCategoryVariant = require('@/models/SpecificCategoryVariant');

/**
 * Function to get Shiprocket token
 */
export async function getShiprocketToken() {
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
    });
    return response.data.token;
}

/**
 * Function to create a Shiprocket order
 */
export async function createShiprocketOrder(orderData) {
    const token = await getShiprocketToken();
    
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', orderData, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        }
    });
    return response.data;
}

/**
 * Function to track a Shiprocket order by order ID
 */
export async function trackShiprocketOrder(orderId) {
    const token = await getShiprocketToken();
    
    const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track`, {
        params: { order_id: orderId },
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
}

/**
 * Calculates the total dimensions and weight for the order based on its items' variants.
 * Considers wrap weight, box weight, and box capacity.
 * 
 * @param {Array} items - Array of order items.
 * @returns {Object} - Total length, breadth, height, and weight.
 */

export const getDimensionsAndWeight = async (items) => {
    // Extract all specificCategoryVariant IDs from the items
    const variantIds = items.map(item => item.specificCategoryVariant);
    
    // Fetch all variants in a single query
    const variants = await SpecificCategoryVariant.find({ _id: { $in: variantIds } });
    
    // Create a map for quick variant lookup
    const variantMap = {};
    variants.forEach(variant => {
        variantMap[variant._id.toString()] = variant.dimensions;
    });

    let totalWrapWeight = 0;
    let totalBoxWeight = 0;
    let totalLength = 0;
    let totalBreadth = 0;
    let totalHeight = 0;

    for (const item of items) {
        const variant = variantMap[item.specificCategoryVariant.toString()];

        if (!variant) {
            throw new Error(`Variant with ID ${item.specificCategoryVariant} not found.`);
        }

        const { length, breadth, height, weight: wrapWeight, boxWeight, boxCapacity } = variant;

        // Calculate the number of boxes required for this item
        const numberOfBoxes = Math.ceil(item.quantity / boxCapacity);

        // Accumulate wrap weight
        totalWrapWeight += wrapWeight * item.quantity;

        // Accumulate box weight
        totalBoxWeight += boxWeight * numberOfBoxes;

        // Accumulate dimensions
        totalLength += length * numberOfBoxes;
        totalBreadth += breadth * numberOfBoxes;
        totalHeight += height * numberOfBoxes;
    }

    // Total weight is the sum of wrap weight and box weight
    const totalWeight = totalWrapWeight + totalBoxWeight;

    return {
        length: totalLength,
        breadth: totalBreadth,
        height: totalHeight,
        weight: totalWeight,
    };
};
