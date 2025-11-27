// components/page-sections/viewcart/PaymentModes.js

'use client';

import React from 'react';
import styles from './styles/paymentmodes.module.css';
import { MAX_ORDER_VALUE_FOR_COD } from '@/lib/constants/payments';
import PaymentIcon from '@mui/icons-material/Payment';
import CircularProgress from '@mui/material/CircularProgress';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';

// Payment method icons
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';

const getPaymentIcon = (type) => {
  switch (type) {
    case 'online':
      return <CreditCardIcon className={styles.paymentTypeIcon} />;
    case 'cod':
    case 'ten':
      return <LocalAtmIcon className={styles.paymentTypeIcon} />;
    default:
      return <PaymentIcon className={styles.paymentTypeIcon} />;
  }
};

// Max order value allowed for Cash on Delivery (from shared constant)
const maxOrderValueForCOD = MAX_ORDER_VALUE_FOR_COD;

const PaymentModes = ({ paymentModes, isLoading, selectedPaymentMode, onChange, totalAmount = 0 }) => {
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <CircularProgress size={24} />
      </div>
    );
  }

  if (!paymentModes || paymentModes.length === 0) {
    return null;
  }

  // Sort by displayOrder if available (recommended options first)
  const sortedModes = [...paymentModes].sort((a, b) => 
    (a.displayOrder || 99) - (b.displayOrder || 99)
  );

  // Calculate amounts for display (online portion and COD portion for split payments)
  const calculateAmounts = (mode) => {
    const onlinePct = mode.configuration?.onlinePercentage || 100;
    const online = Math.round((totalAmount * onlinePct) / 100);
    const cod = totalAmount - online + (mode.extraCharge || 0);
    return { online, cod, total: online + cod };
  };

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
          {sortedModes.map((mode) => {
            const amounts = calculateAmounts(mode);
            const isSelected = selectedPaymentMode?.name === mode.name;
            const isSplit = (mode.configuration?.onlinePercentage || 100) < 100;
            const hasCharge = mode.extraCharge > 0;
            
            // COD limit check
            const isCod = (mode?.name || '').toLowerCase() === 'cod';
            const isCodDisabled = isCod && totalAmount > maxOrderValueForCOD;

            return (
              <motion.div
                key={mode.name}
                className={`
                  ${styles.paymentOption}
                  ${isSelected ? styles.selected : ''}
                  ${isCodDisabled ? styles.disabled : ''}
                `}
                whileHover={{ scale: isCodDisabled ? 1 : 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <FormControlLabel
                  value={mode.name}
                  disabled={isCodDisabled}
                  control={
                    <Radio 
                      sx={{ 
                        color: '#2d2d2d', 
                        '&.Mui-checked': { color: '#2d2d2d' } 
                      }} 
                      size="small" 
                    />
                  }
                  label={
                    <div className={styles.paymentOptionContent}>
                      <div className={styles.paymentOptionLeft}>
                        {/* {getPaymentIcon(mode.name)}  */}
                        <div className={styles.paymentOptionInfo}>
                          {/* Caption + Amount Header */}
                          <div className={styles.paymentOptionHeader}>
                            <span className={styles.paymentOptionName}>
                              {mode.caption?.toUpperCase() || mode.name?.toUpperCase()}
                              {' '}
                              <span className={styles.amountInline}>
                                ₹{isSplit ? amounts.online.toLocaleString('en-IN') : totalAmount.toLocaleString('en-IN')}
                              </span>
                            </span>
                            
                            {/* Recommended Badge */}
                            {mode.isRecommended && (
                              <span className={styles.recommendedBadge}>
                                <CheckCircleIcon sx={{ fontSize: 12 }} />
                                Best Price
                              </span>
                            )}
                            
                            {/* Extra Charge Badge */}
                            {hasCharge && (
                              <span className={styles.extraChargeBadge}>
                                +₹{mode.extraCharge}
                              </span>
                            )}
                          </div>
                          
                          {/* Description */}
                          <span className={styles.paymentOptionDescription}>
                            {isSplit 
                              ? `₹${amounts.cod.toLocaleString('en-IN')} on delivery`
                              : mode.description
                            }
                          </span>
                          
                          {/* COD Unavailable Message */}
                          {isCodDisabled && (
                            <span className={styles.codUnavailable}>
                              Not available for orders above ₹{maxOrderValueForCOD.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
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

