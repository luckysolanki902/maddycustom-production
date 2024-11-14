import React from 'react';
import { Card, Typography } from '@mui/material';

const ReceiverDetails = ({ address, createdAt, formatDate }) => (
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
      Receiver Details
    </Typography>
    <table style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td>Name:</td>
          <td style={{ textAlign: 'right' }}>{address.receiverName}</td>
        </tr>
        <tr>
          <td>Mobile:</td>
          <td style={{ textAlign: 'right' }}>{address.receiverPhoneNumber}</td>
        </tr>
        <tr>
          <td>Address:</td>
          <td style={{ textAlign: 'right' }}>
            {address.addressLine1}, {address.city}, {address.state}, {address.pincode}
          </td>
        </tr>
        <tr>
          <td>Ordered on:</td>
          <td style={{ textAlign: 'right' }}>{formatDate(createdAt)}</td>
        </tr>
      </tbody>
    </table>
  </Card>
);

export default ReceiverDetails;
