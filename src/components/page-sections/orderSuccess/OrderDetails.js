import React from 'react';
import { Box } from '@mui/material';
import OrderSummary from './OrderSummary';
import ReceiverDetails from './ReceiverDetails';

const OrderDetails = ({ order, formatDate }) => (
  <Box sx={{ mt: 4, display: 'flex', gap: 4, flexWrap: 'wrap', padding:'1rem' }}>
    <OrderSummary order={order} />
    <ReceiverDetails address={order.address} createdAt={order.createdAt} formatDate={formatDate} />
  </Box>
);

export default OrderDetails;
