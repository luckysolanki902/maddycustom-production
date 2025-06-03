import React, { useState, useEffect } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { motion, useAnimation } from 'framer-motion';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import styles from './styles/couponcard.module.css';

// Beautiful, cohesive color scheme
const cardThemes = {
  default: {
    background: 'linear-gradient(145deg, #ffffff, #f8f9fa)',
    color: '#2d2d2d'
  },
  applied: {
    background: 'linear-gradient(145deg, #dcfce7, #d1fae5)',
    color: '#22c55e'
  },
  bestDeal: {
    background: 'linear-gradient(145deg, #ccfbf1, #d1faf5)',
    color: '#0d9488'
  },
  inactive: {
    background: 'linear-gradient(145deg, #f9fafb, #f3f4f6)',
    color: '#757575'
  }
};

const CouponCard = ({
  discount = 0,
  discountType = 'percentage', // 'percentage', 'fixed', or 'bundle'
  validity = new Date(),
  name = 'COUPON',
  description = '',
  onApply,
  applicable = true,
  conditionMessage = '',
  isBestDeal = false,
  shortfall = 0,
  cartTotal = 0,
  isApplied = false,
  actualDiscount = 0, // The actual amount to be saved
  discountCap = null
}) => {
  const [theme, setTheme] = useState(cardThemes.default);
    console.log(discountCap, 'is the discountCap')
  // Animation controls for the badge
  const badgeAnimation = useAnimation();
  const cardAnimation = useAnimation();
  useEffect(() => {
    // Set theme based on coupon status
    if (isApplied) {
      setTheme(cardThemes.applied);
    } else if (!applicable) {
      setTheme(cardThemes.inactive);
    } else if (isBestDeal) {
      setTheme(cardThemes.bestDeal);
    } else {
      setTheme(cardThemes.default);
    }
    
    // Make sure component is mounted before starting animations
    const animateBadge = async () => {
      if (isBestDeal) {
        // Initial swing animation
        await badgeAnimation.start({
          rotateY: [0, 25, -10, 5, 0],
          rotateZ: [0, -5, 10, -3, 0],
          transition: { 
            duration: 2, 
            ease: "easeInOut",
            delay: 0.5
          }
        });
        
        // Continuous subtle swing
        const timerId = setTimeout(() => {
          badgeAnimation.start({
            rotateY: [0, 5, 0, -5, 0],
            rotateZ: [0, -2, 0, 2, 0],
            transition: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 3,
              ease: "easeInOut"
            }
          });
        }, 2500);
        
        // Cleanup timer if component unmounts
        return () => clearTimeout(timerId);
      }
    };
    
    const animateCard = () => {
      if (isBestDeal) {
        // Highlight animation for best deal card
        cardAnimation.start({
          scale: [1, 1.02, 1],
          transition: {
            repeat: 2,
            repeatType: "reverse",
            duration: 1.5,
          }
        });
      }
      
      if (isApplied) {
        // Applied coupon gets a special highlight
        cardAnimation.start({
          y: [0, -5, 0],
          boxShadow: [
            "0 4px 12px rgba(12, 206, 107, 0.1)", 
            "0 8px 24px rgba(12, 206, 107, 0.2)", 
            "0 4px 12px rgba(12, 206, 107, 0.1)"
          ],
          transition: {
            duration: 1.5,
            ease: "easeInOut"
          }
        });
      }
    };
    
    // Run animations only after the component has mounted
    animateBadge();
    animateCard();
    
  }, [isBestDeal, isApplied, applicable, badgeAnimation, cardAnimation]);

  const handleApplyClick = (e) => {
    e.stopPropagation(); // Prevent card click from triggering
    if (applicable && onApply) {
      onApply(name);
    }
  };
  
  const handleCardClick = () => {
    if (applicable && onApply && !isApplied) {
      onApply(name);
    }
  };

  // Calculate displayed savings
  const calculatedDiscount = discountType === 'percentage' ? 
    Math.round((discount / 100) * cartTotal) : discount;
const displaySavings = discountCap
  ? Math.min(Number(actualDiscount || calculatedDiscount) || 0, Number(discountCap))
  : Number(actualDiscount || calculatedDiscount) || 0;
  return (
    <motion.div
      className={`${styles.card} ${!applicable ? styles.notApplicable : ''} 
                  ${isBestDeal ? styles.bestDealCard : ''} 
                  ${isApplied ? styles.appliedCard : ''}`}
      style={{ 
        background: theme.background,
        color: theme.color
      }}
      animate={cardAnimation}
      onClick={handleCardClick}
      whileHover={{ y: -3 }}
    >
      {/* Dashed line */}
      <div className={styles.dashedLine} style={{ borderColor: `${theme.color}40` }}></div>
      
      {/* Best deal badge */}
      {isBestDeal && !isApplied && (
        <motion.div 
          className={styles.bestDealBadge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <motion.div 
            className={styles.bestDealBadgeContent}
            animate={badgeAnimation}
          >
            <StarIcon className={styles.starIcon} />
            <span>BEST</span>
          </motion.div>
        </motion.div>
      )}

      {/* Applied badge */}
      {isApplied && (
        <motion.div 
          className={styles.appliedBadge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <CheckCircleIcon className={styles.appliedIcon} />
          <span>APPLIED</span>
        </motion.div>
      )}

      {/* Lock overlay for inapplicable coupons */}
      {!applicable && (
        <motion.div 
          className={styles.lockOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <LockIcon className={styles.lockIcon} />
          {shortfall > 0 && (
            <motion.div 
              className={styles.shortfallMessage}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <ShoppingCartIcon className={styles.cartIcon} />
              <span>Add ₹{shortfall} more</span>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Main content */}
      <div className={styles.content}>
        <div className={styles.header}>
          <Typography variant="subtitle2" className={styles.couponName} style={{ 
            background: `${theme.color}15`, 
            color: theme.color 
          }}>
            {name}
          </Typography>
        </div>
        
        <Box className={styles.discountSection}>
          <Typography variant="h4" className={styles.discountValue}>
            {discountType === 'percentage'
              ? `${discount}%`
              : discountType === 'bundle'
              ? 'Bundle'
              : `₹${discount}`}
          </Typography>
          <Typography variant="body2" className={styles.offText}>
            {discountType === 'bundle' ? 'DEAL' : 'OFF'}
          </Typography>
          
          {/* Show actual savings */}
          {applicable && (
            <Typography variant="caption" className={styles.savingsText} style={{ 
              background: `${theme.color}15`, 
              color: theme.color 
            }}>
              Save ₹{displaySavings}
            </Typography>
          )}
        </Box>
        
        {/* Description */}
        {description && (
          <Typography variant="caption" className={styles.description}>
            {description}
          </Typography>
        )}
        
        <Typography variant="caption" className={styles.validity} style={{ 
          background: `${theme.color}15`,
          color: theme.color
        }}>
          Valid till {new Date(validity).toLocaleDateString()}
        </Typography>
        
        {/* Show condition message for locked coupons */}
        {!applicable && conditionMessage && (
          <Typography variant="caption" className={styles.conditionMessage} style={{ 
            background: `${theme.color}15`,
            color: theme.color
          }}>
            {conditionMessage}
          </Typography>
        )}
        
        {/* Apply button */}
        {applicable && !isApplied && (
          <motion.div 
            className={styles.applyButton}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              variant="contained" 
              onClick={handleApplyClick}
              style={{ 
                background: theme.color,
                color: '#ffffff'
              }}
              fullWidth
            >
              Apply
            </Button>
          </motion.div>
        )}
        
        {/* Applied status */}
        {isApplied && (
          <motion.div 
            className={styles.applyButton}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Button 
              variant="contained"
              fullWidth
              style={{ 
                background: `${theme.color}20`,
                color: theme.color,
                fontWeight: '600'
              }}
              disabled
            >
              Applied
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default CouponCard;
