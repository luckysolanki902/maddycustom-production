'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { removeItem } from '@/store/slices/cartSlice';
import styles from './styles/viewcart.module.css';

// Subcomponents
import ViewCartHeader from '../page-sections/viewcart/ViewCartHeader';
import CartList from '../page-sections/viewcart/CartList';
import PriceDetails from '../page-sections/viewcart/PriceDetails';
import PaymentModes from '../page-sections/viewcart/PaymentModes';
import Footer from '../page-sections/viewcart/Footer';

// Dialogs and Notifications
import ApplyCoupon from '../dialogs/ApplyCoupon';
import CustomSnackbar from '@/components/notifications/CustomSnackbar';
import OrderForm from '../dialogs/OrderForm';

// Utility Functions
import {
  calculateTotalQuantity,
  calculateTotalCostBeforeDiscount,
  calculateDiscountAmount,
  calculateTotalCostAfterDiscount,
} from '@/lib/utils/cartCalculations';
import HappyCustomersClient from '../showcase/sliders/HappyCustomerClient';
import { setCouponApplied } from '@/store/slices/orderFormSlice';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';

const ViewCart = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);
  const orderForm = useSelector((state) => state.orderForm);
  const { couponApplied } = orderForm;

  // Coupon state
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [couponState, setCouponState] = useState({
    couponApplied: false,
    couponName: '',
    couponDiscount: 0,
    discountType: '', // 'percentage' or 'fixed'
    isDbCoupon: false,
  });

  // Snackbar State
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success', // 'success' | 'error' | 'info' | 'warning'
  });

  // Payment Modes State
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState(null);
  const [isLoadingPaymentModes, setIsLoadingPaymentModes] = useState(true);

  // OrderForm Dialog State
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);

  // Fetch Payment Modes on Component Mount
  useEffect(() => {
    const fetchPaymentModes = async () => {
      try {
        const response = await axios.get('/api/checkout/modeofpayments');
        if (response.status === 200) {
          setPaymentModes(response.data.data);
          // Set default selected payment mode (e.g., 'online')
          const defaultMode =
            response.data.data.find((mode) => mode.name === 'online') ||
            response.data.data[0];
          setSelectedPaymentMode(defaultMode);
        } else {
          setSnackbar({
            open: true,
            message: 'Failed to fetch payment modes.',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error('Error fetching payment modes:', error.message);
        setSnackbar({
          open: true,
          message: 'An error occurred while fetching payment modes.',
          severity: 'error',
        });
      } finally {
        setIsLoadingPaymentModes(false);
      }
    };

    fetchPaymentModes();
  }, []);

  // Use utility functions to calculate totals
  const totalQuantity = calculateTotalQuantity(cartItems);
  const totalCostBeforeDiscount = calculateTotalCostBeforeDiscount(cartItems);
  const discountAmount = calculateDiscountAmount(totalCostBeforeDiscount, couponState);
  const totalCostAfterDiscount = calculateTotalCostAfterDiscount(
    totalCostBeforeDiscount,
    discountAmount
  );

  // Delivery Cost (Default or based on payment mode)
  const deliveryCost = 0; // Default delivery cost

  // Extra Charge based on Payment Mode
  const extraCharge =
    selectedPaymentMode && selectedPaymentMode.extraCharge
      ? selectedPaymentMode.extraCharge
      : 0;

  // Total cost including delivery and extra charge
  const totalCostWithDelivery =
    totalCostAfterDiscount + deliveryCost + extraCharge;

  // Original Total (for display when coupon applied)
  const originalTotal = totalCostBeforeDiscount + deliveryCost + extraCharge;

  // Calculate Payment Splits based on selected payment mode
  const onlinePercentage = selectedPaymentMode?.configuration?.onlinePercentage;
  const codPercentage = selectedPaymentMode?.configuration?.codPercentage;

  // Handle removing a cart item
  const handleRemoveItem = (productId) => {
    dispatch(removeItem({ productId }));
  };

  // Updated handleBack function
  const handleBack = () => {
    router.back();
  };

  // Handle Checkout button click
  const handleCheckout = () => {
    setIsOrderFormOpen(true);
  };

  // Handle applying a coupon
  const handleApplyCoupon = (couponCode, discount, discountType, isDbCoupon) => {
    setCouponState({
      couponApplied: true,
      couponName: couponCode,
      couponDiscount: discount,
      discountType: discountType,
      isDbCoupon: isDbCoupon,
    });
    setSnackbar({
      open: true,
      message: 'Coupon applied successfully!',
      severity: 'success',
    });
    dispatch(setCouponApplied({ couponCode: couponCode, discountAmount }));
  };

  // (Empty useEffect removed or left minimal if not needed)

  // Handle Snackbar close
  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Handle removing a coupon
  const handleRemoveCoupon = () => {
    setCouponState({
      couponApplied: false,
      couponName: '',
      couponDiscount: 0,
      discountType: '',
      isDbCoupon: false,
    });
    setSnackbar({
      open: true,
      message: 'Coupon removed.',
      severity: 'warning',
    });
    dispatch(setCouponApplied({ couponCode: '', discountAmount: 0 }));
  };

  // Handle Payment Mode Selection
  const handlePaymentModeChange = (event) => {
    const selectedModeName = event.target.value;
    const mode = paymentModes.find((mode) => mode.name === selectedModeName);
    setSelectedPaymentMode(mode);
  };

  // --- Memoize props for TopBoughtProducts ---
  const topBoughtSubCategories = useMemo(() => {
    // Create a unique array of subCategories from cartItems
    return [...new Set(cartItems.map((item) => item.productDetails.subCategory))];
  }, [cartItems]);

  const topBoughtCurrentProductId = useMemo(() => {
    // Join all product IDs from cartItems into a comma-separated string
    return cartItems.map((item) => item.productDetails._id).join(',');
  }, [cartItems]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <ViewCartHeader totalQuantity={totalQuantity} onBack={handleBack} />

      {/* Cart Items List */}
      {totalQuantity > 0 && <CartList cartItems={cartItems} onRemove={handleRemoveItem} />}

      {/* Price Details and Payment Modes */}
      {totalQuantity > 0 && (
        <section className={styles.cartList}>
          <PriceDetails
            deliveryCost={deliveryCost}
            couponState={couponState}
            discountAmount={discountAmount}
            totalCostWithDelivery={totalCostWithDelivery}
            onOpenCoupon={() => setIsCouponDialogOpen(true)}
            onRemoveCoupon={handleRemoveCoupon}
          />

          <PaymentModes
            paymentModes={paymentModes}
            isLoading={isLoadingPaymentModes}
            selectedPaymentMode={selectedPaymentMode}
            onChange={handlePaymentModeChange}
          />
        </section>
      )}

      {/* Top Bought Products with memoized props */}
      <TopBoughtProducts 
        subCategories={topBoughtSubCategories}
        currentProductId={topBoughtCurrentProductId}
      />

      <HappyCustomersClient headingText='Happy Customers' />

      {/* Total Cost and Checkout */}
      {totalQuantity > 0 && (
        <Footer
          totalCost={totalCostWithDelivery}
          originalTotal={couponState.couponApplied ? originalTotal + 100 : originalTotal + 100}
          onCheckout={handleCheckout}
          onlinePercentage={onlinePercentage}
          codPercentage={codPercentage}
        />
      )}

      {/* Coupon Dialog */}
      <ApplyCoupon
        open={isCouponDialogOpen}
        onClose={() => setIsCouponDialogOpen(false)}
        onApplyCoupon={handleApplyCoupon}
        totalCost={totalCostBeforeDiscount}
        removeCoupon={handleRemoveCoupon}
      />

      {/* Order Form Dialog */}
      <OrderForm
        open={isOrderFormOpen}
        onClose={() => setIsOrderFormOpen(false)}
        paymentModeConfig={selectedPaymentMode}
        couponCode={couponState.couponApplied ? couponState.couponName : null}
        totalCost={totalCostWithDelivery}
        couponsDetails={couponApplied}
        deliveryCost={deliveryCost}
        discountAmountFinal={discountAmount}
        items={cartItems}
      />

      {/* Custom Snackbar for Feedback */}
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        handleClose={handleSnackbarClose}
      />
    </div>
  );
};

export default ViewCart;
