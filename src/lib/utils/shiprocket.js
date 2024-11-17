import axios from 'axios';

// Function to get Shiprocket token
export async function getShiprocketToken() {
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
    });
    return response.data.token;
}

// Function to create a Shiprocket order
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

// New function to track Shiprocket order by order ID
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

// Get dimensions and weight of order items

export const getDimensionsAndWeight = (items) => {
    // Implement logic to calculate total dimensions and weight
    // This is a placeholder implementation and should be adjusted based on actual product data
  
    let totalLength = 10;
    let totalBreadth = 10;
    let totalHeight = 10;
    let totalWeight = 0.3;
  
    // items.forEach(item => {
    //   const product = item.productDetails;
    //   totalLength += (product.length || 10) * item.quantity; // Default length 10 if not provided
    //   totalBreadth += (product.breadth || 10) * item.quantity; // Default breadth 10 if not provided
    //   totalHeight += (product.height || 10) * item.quantity; // Default height 10 if not provided
    //   totalWeight += (product.weight || 500) * item.quantity; // Default weight 500g if not provided
    // });
  
    return {
      length: totalLength,
      breadth: totalBreadth,
      height: totalHeight,
      weight: totalWeight,
    };
  };
  
  
  