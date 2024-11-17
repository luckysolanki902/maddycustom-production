// components/page-sections/viewcart/PaymentModes.js

'use client';

import React from 'react';
import {
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Skeleton,
} from '@mui/material';
import styles from './styles/viewcart.module.css';

const PaymentModes = ({
  paymentModes,
  isLoading,
  selectedPaymentMode,
  onChange,
}) => (
  <div className={`${styles.cartItem} ${styles.mopBox}`}>
    <FormControl component="fieldset">
      <FormLabel component="legend" style={{ color: 'black' }}>
        Select Mode of Payment
      </FormLabel>
      {isLoading ? (
        <div style={{ marginTop: '16px' }}>
          {/* Skeleton Loaders */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Skeleton variant="circular" width={24} height={24} style={{ marginRight: '8px' }} />
            <Skeleton variant="text" width="60%" height={20} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={24} height={24} style={{ marginRight: '8px' }} />
            <Skeleton variant="text" width="60%" height={20} />
          </div>
        </div>
      ) : (
        <RadioGroup
          aria-label="payment-mode"
          name="payment-mode"
          value={selectedPaymentMode ? selectedPaymentMode.name : ''}
          onChange={onChange}
        >
          {paymentModes.map((mode) => (
            <FormControlLabel
              key={mode._id}
              value={mode.name}
              control={<Radio style={{ color: 'black' }} />}
              label={
                <span style={{ color: 'black', display: 'flex', alignItems: 'center' }}>
                  {mode.caption ? `${mode.caption}` : ''}
                  {mode.extraCharge > 0 && (
                    <span
                      style={{
                        padding: '0.2rem 0.3rem',
                        marginLeft: '0.3rem',
                        borderRadius: '0.5rem',
                        fontWeight: '400',
                        fontFamily: 'Roboto',
                        display: 'flex',
                        fontSize: '0.7rem',
                        backgroundColor: '#fafa7d',
                      }}
                      className={styles.patch}
                    >
                      <span>+</span> <span>₹{mode.extraCharge}</span>
                    </span>
                  )}
                </span>
              }
            />
          ))}
        </RadioGroup>
      )}
    </FormControl>
  </div>
);

export default PaymentModes;
