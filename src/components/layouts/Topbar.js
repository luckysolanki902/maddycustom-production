'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './styles/topbar.module.css';
import { ShoppingCart, Search, Menu, ArrowBackIosNew, Home as HomeIcon } from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import Badge from '@mui/material/Badge';
import { useSpring, animated } from 'react-spring';
import Typewriter from 'typewriter-effect';
import { typewriterStrings } from '@/lib/constants/typewriterCategories';
import { useScrollContext } from '@/contexts/ScrollContext';

import { toggleSidebar, openSearchDialog, openCartDrawer } from '@/store/slices/uiSlice';
import { animated as motion } from 'react-spring';
import { useRouter } from 'next/navigation';
import { useSelector as useReduxSelector } from 'react-redux';
import { useDispatch as useReduxDispatch } from 'react-redux';
import { setDialogOpen } from '@/store/slices/b2bFormSlice';
import dynamic from 'next/dynamic';

const B2BOrderDialog = dynamic(() => import('../dialogs/B2BOrderDialog'), { ssr: false });

// Minimal B2B Topbar component
function B2BTopbar() {
  const dispatch = useReduxDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const selection = useReduxSelector(s => s.b2bSelection.items);
  const dialogOpen = useReduxSelector(s=>s.b2bForm.dialogOpen);
  const totalQty = selection.reduce((a, i) => a + (i.quantity || 0), 0);
  const disabled = totalQty === 0;
  // Close dialog automatically on confirmation pages (prevents reopen due to persisted state)
  React.useEffect(()=>{
    if(pathname?.startsWith('/b2b/confirmation') && dialogOpen){
      dispatch(setDialogOpen(false));
    }
  },[pathname, dialogOpen, dispatch]);
  const hideDialog = pathname?.startsWith('/b2b/confirmation');
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1 && !pathname.startsWith('/b2b')) {
      router.back();
    } else {
      router.push('/b2b');
    }
  };

  const atB2BHome = pathname === '/b2b' || pathname === '/b2b/';

  return (
    <div className={styles.b2bTopbarWrapper}>
      <div className={styles.b2bLeftCluster}>
        <button
          type="button"
            aria-label="Go back"
            onClick={handleBack}
            disabled={atB2BHome && (typeof window !== 'undefined' && window.history.length <= 1)}
            className={`${styles.b2bBackBtn} ${(atB2BHome && (typeof window !== 'undefined' && window.history.length <= 1)) ? styles.b2bBackBtnDisabled : ''}`}
        >
          <ArrowBackIosNew fontSize="small" />
        </button>
        <div className={styles.b2bLogoWrap} onClick={()=>router.push('/b2b')} title="B2B Home">
          <Image
            src={(process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '') + '/assets/logos/maddy_custom3_main_logo.png'}
            alt='maddycustom'
            width={120}
            height={52}
            className={styles.b2bLogo}
            priority
          />
        </div>
        <Link href="/b2b" className={styles.b2bHomeLink} aria-label="B2B Home">
          <HomeIcon fontSize="inherit" className={styles.b2bHomeIcon} />
          <span className={styles.b2bHomeText}>Home</span>
        </Link>
        <span className={styles.b2bTitle}>B2B Bulk Request</span>
      </div>
      <div className={styles.b2bRightCluster}>
        <Link href="/" className={styles.b2bMainSiteLink} title="Go to consumer site">
          Visit Main Site
        </Link>
        <button
          disabled={disabled}
          onClick={() => dispatch(setDialogOpen(true))}
          className={styles.b2bPrimaryCta}
          title={disabled ? 'Select at least one product to continue' : 'Proceed to send inquiry'}
        >
          {disabled ? 'Select Products' : `Review & Send (${totalQty})`}
        </button>
      </div>
      {!hideDialog && <B2BOrderDialog />}
    </div>
  );
}

const Topbar = () => {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const router = useRouter();
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

  // B2B mode detection
  if (pathname?.startsWith('/b2b')) {
    return <B2BTopbar />;
  }

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

