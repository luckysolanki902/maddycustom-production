'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import styles from './styles/topbar.module.css';
import { ShoppingCart, Search, Menu } from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import Badge from '@mui/material/Badge';
import { useSpring, animated } from 'react-spring';

import { toggleSidebar, openSearchDialog } from '@/store/slices/uiSlice';

const Topbar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;


  // Get total quantity from Redux
  const items = useSelector((state) => state.cart.items);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

  // Scroll detection state: track previous scroll position and visibility
  const [prevScrollY, setPrevScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Hide the topbar when scrolling down (past 100px) and show when scrolling up
          if (currentScrollY > prevScrollY && currentScrollY > 100) {
            setIsVisible(false);
          } else {
            setIsVisible(true);
          }
          setPrevScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollY]);

  // Create a smooth animation for the topbar using react-spring
  const animationProps = useSpring({
    transform: isVisible ? 'translateY(0%)' : 'translateY(-100%)',
    config: { tension: 210, friction: 20 },
  });

  
  // If pathname is /viewcart, don't render the topbar
  if (pathname === '/viewcart') return null;

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
            onClick={() => router.push('/')}
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
              className={`${styles.navItem} ${
                pathname === item.href ? styles.active : ''
              }`}
            >
              {item.text}
            </Link>
          ))}
        </div>
      </div>

      {/* Right Side - search icon (mobile), desktop search box and cart icon */}
      <div className={styles.rightIcons}>
        {/* Mobile search icon - visible only on mobile via CSS */}
        <Search
          className={styles.mobileSearchIcon}
          onClick={() => dispatch(openSearchDialog())}
        />
        {/* Desktop search box - hidden on mobile */}
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search on MaddyCustom"
            className={styles.searchInput}
            onClick={() => dispatch(openSearchDialog())}
            readOnly // focusing triggers the dialog
          />
        </div>
        {/* Cart Icon with Badge */}
        <div
          className={styles.cartContainer}
          onClick={() => router.push('/viewcart')}
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

