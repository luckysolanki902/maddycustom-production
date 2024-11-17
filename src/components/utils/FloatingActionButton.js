"use client"
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSpring, animated } from 'react-spring';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import HomeIcon from '@mui/icons-material/Home';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './styles/floatingactionbar.module.css';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import Image from 'next/image';
import Badge from '@mui/material/Badge'; // Import MUI Badge

const FloatingActionBar = () => {
  const pathname = usePathname();
  const items = useSelector((state) => state.cart.items);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0); // Calculate total quantity
  
  const [firstItemAdded, setFirstItemAdded] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  useEffect(() => {
    if (totalQuantity > 0 && !firstItemAdded) {
      setFirstItemAdded(true);
    }
  }, [totalQuantity, firstItemAdded]);

  const cartAnimation = useSpring({
    opacity: totalQuantity > 0 ? 1 : 1, // Always visible, adjust opacity if needed
    transform: totalQuantity > 0 ? 'translateY(0px)' : 'translateY(0px)', // No movement
    config: { tension: 200, friction: 20 },
  });

  if (pathname === '/viewcart') return null;

  if (totalQuantity < 1) return null

  return (
    <div className={styles.container}>
      <div className={styles.actionBar}>
        {/* Cart Button with Badge */}
        <animated.div
          style={firstItemAdded ? cartAnimation : {}}
          className={styles.iconButton}
        >
          <Link href="/viewcart" passHref>
            <div className={`${styles.iconButton} ${totalQuantity > 0 ? styles.cartButtonActive : ''}`}>
              <Badge badgeContent={totalQuantity} color="info">
                <Image
                  src={`${baseImageUrl}/assets/icons/cart.png`}
                  className={styles.icon}
                  width={200}
                  height={200}
                  alt='Cart Icon'
                />
              </Badge>
              <span>Cart</span>
            </div>
          </Link>
        </animated.div>

        {/* Divider */}
        <div className={styles.divider}></div>

        {/* Home Button */}
        <Link href="/" passHref>
          <div className={`${styles.iconButton} ${pathname === '/' ? styles.cartButtonActive : ''}`}>
            <Image
              src={`${baseImageUrl}/assets/icons/roundedhome.png`}
              className={styles.icon}
              width={200}
              height={200}
              alt='Home Icon'
            />
            <span>Home</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default FloatingActionBar;
