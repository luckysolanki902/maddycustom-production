// components/page-sections/orderSuccess/OrderSummary.js

import React from 'react';
import { Card, Typography, Divider } from '@mui/material';

const OrderSummary = ({ order }) => (
  <Card
    sx={{
      flexGrow: 1,
      minWidth: 250,
      padding: 3,
      borderRadius: 3,
      boxShadow: 3,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}
  >
    <Typography variant="h5" gutterBottom>
      Order Summary
    </Typography>
    <table style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td>Price:</td>
          <td style={{ textAlign: 'right' }}>₹{order.items.reduce((acc, item) => acc + item.quantity * item.priceAtPurchase, 0)}</td>
        </tr>

        {order.extraCharges
          ?.filter(charge => charge.chargesAmount > 0)
          .map((charge, index) => (
            <tr key={index}>
              <td>{charge.chargesName}:</td>
              <td style={{ textAlign: 'right' }}>₹{charge.chargesAmount}</td>
            </tr>
          ))}

        {order.totalDiscount > 0 && (
          <tr>
            <td>Total Discount:</td>
            <td style={{ textAlign: 'right' }}>- ₹{order.totalDiscount}</td>
          </tr>
        )}

        {order.paymentDetails.amountDueCod > 0 && (
          <tr>
            <td>Amount Due COD:</td>
            <td style={{ textAlign: 'right', color: 'red' }}>₹{order.paymentDetails.amountDueCod}</td>
          </tr>
        )}
        {order.paymentDetails.amountPaidOnline > 0 && (
          <tr>
            <td>Amount Paid Online:</td>
            <td style={{ textAlign: 'right', color: 'green' }}>₹{order.paymentDetails.amountPaidOnline}</td>
          </tr>
        )}

        <tr>
          <td colSpan={2}>
            <Divider sx={{ my: 2 }} />
          </td>
        </tr>
        <tr style={{ fontWeight: 'bold' }}>
          <td>Total Amount:</td>
          <td style={{ textAlign: 'right' }}>₹{order.totalAmount}</td>
        </tr>
      </tbody>
    </table>
  </Card>
);

export default OrderSummary;
