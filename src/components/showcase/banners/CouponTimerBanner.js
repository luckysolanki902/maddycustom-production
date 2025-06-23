"use client";

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const CouponTimerBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const COUPON_CODE = "EOM50";

  // Check window size for responsive design
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate end of month date
  const calculateEndOfMonth = useCallback(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }, []);

  // Check if we're in the last 5 days of the month
  const checkIfLastFiveDays = useCallback(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    return currentDay >= (lastDayOfMonth - 4);
  }, []);

  // Update countdown timer 
  const updateCountdown = useCallback(() => {
    const now = new Date();
    const endOfMonth = calculateEndOfMonth();
    const totalSeconds = Math.floor((endOfMonth - now) / 1000);
    
    if (totalSeconds <= 0) {
      setIsVisible(false);
      return;
    }
    
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    setTimeLeft({ days, hours, minutes, seconds });
  }, [calculateEndOfMonth]);

  useEffect(() => {
    if (isVisible) {
      updateCountdown();
      const timer = setInterval(updateCountdown, 1000);
      return () => clearInterval(timer);
    }
  }, [checkIfLastFiveDays, updateCountdown, isVisible]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(COUPON_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isVisible) return null;

  // Dynamically choose a persuasive message based on days left
  const getUrgencyMessage = () => {
    if (timeLeft.days >= 2) {
      return "Shop now before prices return to normal!";
    } else if (timeLeft.days === 1) {
      return "Just 24 hours left to save big!";
    } else {
      return "Last chance! Offer ends today.";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{
          margin: '0',
          padding: isMobile ? '0.3rem 0.4rem' : '0.35rem 0.6rem',
          background: 'linear-gradient(125deg, #e4405f, #ff9944)',
          color: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          textAlign: 'center',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 100
        }}
      >
        {/* Improved subtle background pattern */}
        <motion.div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 75% 25%, rgba(255,255,255,0.12) 0%, transparent 40%), radial-gradient(circle at 25% 75%, rgba(255,255,255,0.1) 0%, transparent 35%)',
            zIndex: -1
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.15rem' : '0' }}>
          {isMobile ? (
            <>
              {/* Mobile layout - ultra compact two-row design */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}>
                {/* Left side: Sale name + coupon */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  {/* Sale name with highlighted text */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.1rem'
                  }}>
                    <div style={{
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.2)',
                      padding: '0.1rem 0.25rem',
                      borderRadius: '2px',
                      whiteSpace: 'nowrap'
                    }}>
                      <motion.span
                        animate={{ opacity: [0.85, 1, 0.85] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ 
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        End of Month
                      </motion.span>
                    </div>
                  </div>

                  {/* Coupon */}
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyCode}
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      color: '#e4405f',
                      padding: '0.2rem 0.35rem',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      border: '1px dashed #e4405f',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                    animate={copied ? { scale: [1, 1.10, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {COUPON_CODE}
                    {copied && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                          marginLeft: '3px',
                          fontSize: '0.6rem',
                          color: '#4caf50',
                        }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </motion.div>
                </div>

                {/* Right side: Discount + Countdown */}
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '0.1rem'
                }}>
                  {/* Discount amount */}
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    whiteSpace: 'nowrap'
                  }}>
                    ₹50 OFF
                  </div>
                  
                  {/* Compact timer */}
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.15rem',
                    background: 'rgba(0,0,0,0.1)',
                    borderRadius: '2px',
                    padding: '0.05rem 0.15rem',
                  }}>
                    <CompactTimerDisplay 
                      days={timeLeft.days}
                      hours={timeLeft.hours}
                      minutes={timeLeft.minutes}
                    />
                  </div>
                </div>
              </div>

              {/* Mobile persuasive text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                style={{
                  fontSize: '0.6rem',
                  fontWeight: '500',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  opacity: 0.95,
                  letterSpacing: '0.1px',
                }}
              >
                {getUrgencyMessage()}
              </motion.div>
            </>
          ) : (
            // Desktop layout - elegant single row
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.8rem',
            }}> 
              {/* Sale name with highlighted styling */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <motion.span
                  animate={{ 
                    textShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 5px rgba(255,255,255,0.5)', '0 0 0px rgba(255,255,255,0)']
                  }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.7px'
                  }}
                >
                  End of Month Sale:
                </motion.span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                  ₹50 OFF all products
                </span>
              </div>
              
              {/* Coupon code */}
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCopyCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#e4405f',
                  padding: '0.2rem 0.45rem',
                  borderRadius: '4px',
                  border: '1.5px dashed #e4405f',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  gap: '0.3rem'
                }}
              >
                <span style={{ 
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  letterSpacing: '0.5px'
                }}>
                  {COUPON_CODE}
                </span>
                <span style={{ 
                  fontSize: '0.65rem',
                  opacity: 0.85,
                  fontWeight: '500'
                }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </span>
              </motion.div>
              
              {/* Improved timer */}
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                borderRadius: '3px',
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.15)',
                padding: '0.15rem 0.25rem',
              }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: '600',
                  marginRight: '0.25rem'
                }}>
                  ENDS:
                </span>
                <DesktopTimerDisplay 
                  days={timeLeft.days}
                  hours={timeLeft.hours}
                  minutes={timeLeft.minutes}
                />
              </div>
              
              {/* Persuasive message for desktop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{
                  fontSize: '0.7rem',
                  fontStyle: 'italic',
                  opacity: 0.9,
                  fontWeight: '500',
                }}
              >
                {getUrgencyMessage()}
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Desktop improved timer display
const DesktopTimerDisplay = ({ days, hours, minutes }) => {
  return (
    <div style={{ 
      display: 'flex',
      alignItems: 'center',
      gap: '0.2rem',
    }}>
      <TimerUnit value={days} label="d" />
      <span style={{ fontSize: '0.7rem', fontWeight: '300', opacity: 0.7 }}>:</span>
      <TimerUnit value={hours} label="h" padZero={true} />
      <span style={{ fontSize: '0.7rem', fontWeight: '300', opacity: 0.7 }}>:</span>
      <TimerUnit value={minutes} label="m" padZero={true} />
    </div>
  );
};

// Improved timer unit for desktop
const TimerUnit = ({ value, label, padZero = false }) => {
  const displayValue = padZero ? value.toString().padStart(2, '0') : value;
  
  return (
    <div style={{ 
      display: 'flex',
      alignItems: 'center',
      gap: '0.05rem' 
    }}>
      <span style={{
        fontWeight: '700',
        fontSize: '0.75rem',
      }}>
        {displayValue}
      </span>
      <span style={{ 
        fontSize: '0.55rem',
        opacity: 0.8,
        fontWeight: '400'
      }}>
        {label}
      </span>
    </div>
  );
};

// Ultra compact mobile timer display
const CompactTimerDisplay = ({ days, hours, minutes }) => {
  return (
    <>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: '600',
      }}>
        {days}
        <span style={{ fontSize: '0.45rem', fontWeight: '400', marginLeft: '1px' }}>d</span>
      </span>
      <span style={{ fontSize: '0.6rem' }}>:</span>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: '600',
      }}>
        {hours.toString().padStart(2, '0')}
        <span style={{ fontSize: '0.45rem', fontWeight: '400', marginLeft: '1px' }}>h</span>
      </span>
      <span style={{ fontSize: '0.6rem' }}>:</span>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: '600',
      }}>
        {minutes.toString().padStart(2, '0')}
        <span style={{ fontSize: '0.45rem', fontWeight: '400', marginLeft: '1px' }}>m</span>
      </span>
    </>
  );
};

export default CouponTimerBanner;