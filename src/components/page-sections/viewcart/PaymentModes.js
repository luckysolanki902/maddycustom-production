// components/page-sections/viewcart/PaymentModes.js

'use client';

import React from 'react';
import styles from './styles/paymentmodes.module.css';
import PaymentIcon from '@mui/icons-material/Payment';
import CircularProgress from '@mui/material/CircularProgress';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import { motion } from 'framer-motion';

// Payment method icons
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';

const getPaymentIcon = (type) => {
  switch (type) {
    case 'online':
      return <CreditCardIcon className={styles.paymentTypeIcon} />;
    case 'cod':
      return <LocalAtmIcon className={styles.paymentTypeIcon} />;
    case 'bank':
      return <AccountBalanceIcon className={styles.paymentTypeIcon} />;
    default:
      return <PaymentIcon className={styles.paymentTypeIcon} />;
  }
};

// Max order value allowed for Cash on Delivery
const maxOrderValueForCOD = 3000; // INR - adjust as needed

const PaymentModes = ({ paymentModes, isLoading, selectedPaymentMode, onChange, totalAmount = 0 }) => {
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <CircularProgress size={24} />
        <p className={styles.loadingText}>Loading payment options...</p>
      </div>
    );
  }

  if (!paymentModes || paymentModes.length === 0) {
    return null;
  }

  return (
    <motion.div
      className={styles.paymentModesContainer}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.header}>
        <PaymentIcon className={styles.headerIcon} />
        <h3 className={styles.headerTitle}>Payment Method</h3>
      </div>

      <FormControl component="fieldset" className={styles.radioGroupContainer}>
        <RadioGroup
          aria-label="payment-mode"
          name="payment-mode"
          value={selectedPaymentMode?.name || ''}
          onChange={onChange}
        >
          {paymentModes.map((mode) => {
            const hasCharge = mode.extraCharge > 0;
            const isCod = (mode?.name || '').toLowerCase() === 'cod';
            const isCodDisabled = isCod && totalAmount > maxOrderValueForCOD;

            return (
              <motion.div
                key={mode.name}
                className={`
                  ${styles.paymentOption}
                  ${selectedPaymentMode?.name === mode.name ? styles.selected : ''}
                  ${isCodDisabled ? styles.disabled : ''}
                `}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <FormControlLabel
                  value={mode.name}
                  control={<Radio sx={{ color: '#2d2d2d', '&.Mui-checked': { color: '#2d2d2d' } }} size="small" disabled={isCodDisabled} />}
                  disabled={isCodDisabled}
                  label={
                    <div className={styles.paymentOptionContent}>
                      <div className={styles.paymentOptionLeft}>
                        {getPaymentIcon(mode.name)}
                        <div className={styles.paymentOptionInfo}>
                          <span className={styles.paymentOptionName}>
                            {mode?.caption?.toUpperCase() || mode?.caption?.toUpperCase()}
                          </span>
                          {mode.description && (
                            <span className={styles.paymentOptionDescription}>
                              {mode.description.split(/\.\s/).map((s, i) => (
                                <React.Fragment key={i}>
                                  {s}
                                  <br />
                                </React.Fragment>
                              ))}
                            </span>
                          )}
                          {isCodDisabled && (
                            <span className={styles.codUnavailable}>
                              Cash on Delivery isn’t available for orders above ₹{maxOrderValueForCOD}.
                              Please choose Online Payment.
                            </span>
                          )}
                        </div>
                      </div>

                      {hasCharge && (
                        <span className={styles.extraCharge}>+₹{mode.extraCharge}</span>
                      )}
                    </div>
                  }
                  className={styles.formControlLabel}
                />
              </motion.div>
            );
          })}
        </RadioGroup>
      </FormControl>
    </motion.div>
  );
};

export default PaymentModes;

