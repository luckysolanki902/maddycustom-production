"use client";

import { useState, useEffect, useCallback } from 'react';

const EndOfMonthSale = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

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
    const shouldShow = checkIfLastFiveDays();
    setIsVisible(shouldShow);
    
    if (shouldShow) {
      updateCountdown();
      const timer = setInterval(updateCountdown, 1000);
      return () => clearInterval(timer);
    }
  }, [checkIfLastFiveDays, updateCountdown]);

  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      margin: '0.5rem 0',
      padding: '0.5rem',
      background: 'linear-gradient(135deg, #ff5f6d, #ffc371)',
      borderRadius: '6px',
      color: 'white',
      boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            END OF MONTH SALE! 🎉 Rs. 50 OFF
          </h3>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.2rem'
        }}>
          <span style={{ fontSize: '0.8rem' }}>Ends in:</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.15rem'
          }}>
            <div style={{ 
              textAlign: 'center', 
              minWidth: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center' 
            }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '0.1rem 0.25rem',
                borderRadius: '3px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                minWidth: '1.5rem'
              }}>{timeLeft.days}</span>
              <span style={{ fontSize: '0.6rem' }}>d</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>:</span>
            <div style={{ 
              textAlign: 'center', 
              minWidth: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center' 
            }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '0.1rem 0.25rem',
                borderRadius: '3px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                minWidth: '1.5rem'
              }}>{timeLeft.hours.toString().padStart(2, '0')}</span>
              <span style={{ fontSize: '0.6rem' }}>h</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>:</span>
            <div style={{ 
              textAlign: 'center', 
              minWidth: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center' 
            }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '0.1rem 0.25rem',
                borderRadius: '3px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                minWidth: '1.5rem'
              }}>{timeLeft.minutes.toString().padStart(2, '0')}</span>
              <span style={{ fontSize: '0.6rem' }}>m</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>:</span>
            <div style={{ 
              textAlign: 'center', 
              minWidth: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center' 
            }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '0.1rem 0.25rem',
                borderRadius: '3px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                minWidth: '1.5rem'
              }}>{timeLeft.seconds.toString().padStart(2, '0')}</span>
              <span style={{ fontSize: '0.6rem' }}>s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EndOfMonthSale;