import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './styles/timeroverbg.module.css';

/**
 * @param {string} imageUrl - URL of the background image for the timer
 * @param {string} endTime - Target time in ISO format (e.g. "2025-02-19T23:59:00") until which to show the timer
 * @param {number} paramCount - Determines how many units to display:
 *   4 => D, H, M, S
 *   3 => (if days>0) => D, H, M, else => H, M, S
 *   2 => (if days>0) => D, H, else if hours>0 => H, M, else => M, S
 * @param {number} imageQuality - Image quality (1-100). Default: 75
 * @param {number} width - default width for the next/image. Default: 976
 * @param {number} height - default height for the next/image. Default: 406
 */
const TimerOverBg = ({
  imageUrl,
  endTime = '2025-02-19T23:59:00',
  paramCount = 4,
  imageQuality = 75,
  width = 976,
  height = 406,
}) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const targetTime = new Date(endTime).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      // If time is up, clear interval and stop rendering
      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // If there's no time left (past the endTime), render nothing
  if (!timeLeft) {
    return null;
  }

  const { days, hours, minutes, seconds } = timeLeft;

  /**
   * Build the array of time units based on paramCount and actual values.
   */
  const getDisplayUnits = (days, hours, minutes, seconds, paramCount) => {
    if (paramCount === 4) {
      // Always D, H, M, S
      return [
        { label: 'D', value: days },
        { label: 'H', value: hours },
        { label: 'M', value: minutes },
        { label: 'S', value: seconds },
      ];
    } else if (paramCount === 3) {
      // If days>0 => D, H, M; else => H, M, S
      if (days > 0) {
        return [
          { label: 'D', value: days },
          { label: 'H', value: hours },
          { label: 'M', value: minutes },
        ];
      } else {
        return [
          { label: 'H', value: hours },
          { label: 'M', value: minutes },
          { label: 'S', value: seconds },
        ];
      }
    } else {
      // paramCount === 2
      // If days>0 => D, H
      // else if hours>0 => H, M
      // else => M, S
      if (days > 0) {
        return [
          { label: 'D', value: days },
          { label: 'H', value: hours },
        ];
      } else if (hours > 0) {
        return [
          { label: 'H', value: hours },
          { label: 'M', value: minutes },
        ];
      } else {
        return [
          { label: 'M', value: minutes },
          { label: 'S', value: seconds },
        ];
      }
    }
  };

  const displayUnits = getDisplayUnits(days, hours, minutes, seconds, paramCount);

  return (
    <div className={styles.timerContainer}>
      {/* Background Image */}
      <Image
        src={imageUrl}
        alt="Timer Background"
        quality={imageQuality}
        width={width}
        height={height}
        className={styles.timerBgImage}
      />

      {/* Timer Overlay (Positioned on the right) */}
      <div className={styles.timerOverlay}>
        {displayUnits.map((unit, index) => (
          <div key={index} className={styles.timerUnit}>
            <span className={styles.timerValue}>
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className={styles.timerLabel}>{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimerOverBg;
