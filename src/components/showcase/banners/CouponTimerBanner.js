"use client";

import { useState, useEffect, useCallback } from 'react';

const CouponTimerBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  // Added seconds to state to match usage in the component
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const COUPON_CODE = "EOM50";

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
    // For development/testing, uncomment:
    
    // For production, use this instead:
    // const shouldShow = checkIfLastFiveDays();
    // setIsVisible(shouldShow);
    
    if (isVisible) {
      updateCountdown();
      // Changed to 1000ms since we're showing seconds
      const timer = setInterval(updateCountdown, 1000);
      return () => clearInterval(timer);
    }
  }, [checkIfLastFiveDays, updateCountdown, isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{
      margin: '0.75rem 0',
      padding: '0.75rem',
      background: 'linear-gradient(135deg, #ff5f6d, #ffc371)',
      borderRadius: '6px',
      color: 'white',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      textAlign: 'center'
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '1rem'
      }}>
        {/* Coupon info */}
        <div>
          <p style={{ 
            fontSize: '0.9rem', 
            margin: '0',
            fontWeight: 'bold'
          }}>
            End of Month Special: 
            <span style={{
              marginLeft: '0.5rem',
              background: 'rgba(255,255,255,0.25)',
              border: '1px dashed white',
              padding: '0.15rem 0.5rem',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }} onClick={() => {
              navigator.clipboard.writeText(COUPON_CODE);
              alert("Copied!");
            }}>
              {COUPON_CODE}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>
              (50% OFF)
            </span>
          </p>
        </div>

        {/* Countdown timer with fixed structure */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}>
          <div style={{ textAlign: 'center', minWidth: '2.25rem' }}>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              padding: '0.15rem 0.25rem',
              borderRadius: '3px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              display: 'block',
            }}>
              {timeLeft.days}
            </span>
            <span style={{ fontSize: '0.7rem' }}>days</span>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>:</span>
          <div style={{ textAlign: 'center', minWidth: '2.25rem' }}>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              padding: '0.15rem 0.25rem',
              borderRadius: '3px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              display: 'block',
            }}>
              {timeLeft.hours.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.7rem' }}>hrs</span>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>:</span>
          <div style={{ textAlign: 'center', minWidth: '2.25rem' }}>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              padding: '0.15rem 0.25rem',
              borderRadius: '3px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              display: 'block',
            }}>
              {timeLeft.minutes.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.7rem' }}>min</span>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>:</span>
          <div style={{ textAlign: 'center', minWidth: '2.25rem' }}>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              padding: '0.15rem 0.25rem',
              borderRadius: '3px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              display: 'block',
            }}>
              {timeLeft.seconds.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.7rem' }}>sec</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouponTimerBanner;