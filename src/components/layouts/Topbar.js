'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './styles/topbar.module.css';
import { ShoppingCart, Search, Menu } from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import Badge from '@mui/material/Badge';
import { useSpring, animated } from 'react-spring';
import Typewriter from 'typewriter-effect';
import { typewriterStrings } from '@/lib/constants/typewriterCategories';
import { useScrollContext } from '@/contexts/ScrollContext';

import { toggleSidebar, openSearchDialog, openCartDrawer } from '@/store/slices/uiSlice';

const Topbar = () => {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const [searchText, setSearchText] = useState('');

  // Get total quantity from Redux
  const items = useSelector((state) => state.cart.items);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

  // Use shared scroll context for perfect synchronization
  const { isHidden } = useScrollContext();

  // Create smooth animation - topbar slides out completely
  const animationProps = useSpring({
    transform: isHidden ? 'translateY(-100%)' : 'translateY(0%)',
    config: { 
      tension: 280, 
      friction: 30,
      clamp: true // Prevents overshoot for crisp animation
    }
  });

  // Update the cart click handler to specify 'top' source
  const handleCartClick = () => {
    dispatch(openCartDrawer({ source: 'top' }));
  };

  return (
    <animated.nav style={animationProps} className={styles.topbar}>
      {/* Left Section: hamburger (mobile) + logo + links (desktop) */}
      <div className={styles.leftSection}>
        {/* Hamburger icon only visible on smaller screens (handled via CSS) */}
        <div
          className={styles.hamburgerIcon}
          onClick={() => dispatch(toggleSidebar())}
        >
          <Menu style={{ fontSize: 30, color: '#424242', cursor: 'pointer' }} />
        </div>

        {/* Logo */}
        <div className={styles.logo}>
          <Image
            className={styles.logoImg}
            src={`${baseUrl}/assets/logos/maddy_custom3_main_logo.png`}
            alt="maddylogo"
            title="maddylogo"
            width={150}
            height={70}
            priority
            onClick={() => window.location.href = '/'}
            style={{ cursor: 'pointer' }}
          />
        </div>

        {/* Navigation Links (visible on desktop) */}
        <div className={styles.navLinks}>
          {[
            { text: 'Home', href: '/' },
            { text: 'Track Your Order', href: '/orders/track' },
            { text: 'Customer Support', href: '/faqs' },
            { text: 'About Us', href: '/about-us' },
          ].map((item) => (
            <Link
              key={item.text}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.active : ''
                }`}
            >
              {item.text}
            </Link>
          ))}
        </div>
      </div>

      {/* Right Side - search icon (mobile), desktop search box and cart icon */}
      <div className={styles.rightIcons} >
        {pathname !== '/' && (
          <Search
            className={styles.mobileSearchIcon}
            onClick={() => dispatch(openSearchDialog())}
          />
        )}
        {/* Desktop search box - hidden on mobile */}
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon}    onClick={() => dispatch(openSearchDialog())}/>          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {searchText === '' && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                color: '#555' // Adding text color so it's visible
              }}>
                <Typewriter
                  options={{
                    strings: typewriterStrings,
                    autoStart: true,
                    loop: true,
                    delay: 40,
                    deleteSpeed: 10,
                  }}
                />
              </div>
            )}
            <input
              type="text"
              placeholder=""
              className={styles.searchInput}
              onClick={() => dispatch(openSearchDialog())}
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
              readOnly // focusing triggers the dialog
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
        {/* Cart Icon with Badge */}
        <div
          className={styles.cartContainer}
          onClick={handleCartClick}
        >
          <Badge badgeContent={totalQuantity} color="info">
            <ShoppingCart className={styles.cartIcon} />
          </Badge>
        </div>
      </div>
    </animated.nav>
  );
};

export default Topbar;

