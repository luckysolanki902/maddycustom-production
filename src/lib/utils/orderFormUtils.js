// @/lib/utils/orderUtils.js

// Calculates the total amount for the order based on cart items and payment configuration.

export const calculateTotalAmount = (cartItems, paymentModeConfig) => {
    let total = 0;
    cartItems.forEach((item) => {
      total += item.productDetails.price * item.quantity;
    });
    // Apply discounts, delivery charges, etc. as needed
    return total;
  };
  
//   Determines the payment button text based on the payment mode configuration.

  export const getPaymentButtonText = (paymentModeConfig) => {
    const onlinePercentage = paymentModeConfig?.configuration?.onlinePercentage;
    
    if (!paymentModeConfig || onlinePercentage === undefined || onlinePercentage === null) {
      return 'Pay Now';
    }
    
    if (onlinePercentage === 100) {
      return 'Pay Now';
    }
    
    if (onlinePercentage === 0) {
      return 'Place Order (COD)';
    }
    
    return `Pay ${onlinePercentage}% Now`;
  };
  