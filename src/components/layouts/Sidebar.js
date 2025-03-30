'use client';

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { SwipeableDrawer, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { toggleSidebar, closeSidebar, openSearchDialog } from '@/store/slices/uiSlice';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PhoneIcon from '@mui/icons-material/Phone';
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import InstagramIcon from '@mui/icons-material/Instagram';
import Image from 'next/image';

export default function Sidebar({ categories = [], variants = [] }) {
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const dispatch = useDispatch();
  const router = useRouter();
  const isSidebarOpen = useSelector((state) => state.ui.isSidebarOpen);

  // Helper: determine if a route is active
  const isActive = (href) => router.asPath === href;

  // Helper: return an icon based on index
  const getIcon = (index) => {
    switch (index) {
      case 0:
        return <HomeRoundedIcon sx={{ color: 'rgb(85,85,85)', fontSize: '1.3rem' }} />;
      case 1:
        return <PhoneIcon sx={{ color: 'rgb(85,85,85)', fontSize: '1.3rem' }} />;
      case 2:
        return <SearchIcon sx={{ color: 'rgb(85,85,85)', fontSize: '1.3rem' }} />;
      case 3:
        return <LocalShippingIcon sx={{ color: 'rgb(85,85,85)', fontSize: '1.3rem' }} />;
      default:
        return <ReportProblemRoundedIcon sx={{ color: 'rgb(85,85,85)', fontSize: '1.3rem' }} />;
    }
  };

  // Nav items: if an item has an "action", we call that on click
  const navItems = [
    { text: 'Home', href: '/' },
    { text: 'Customer Support', href: '/faqs' },
    { text: 'Search Categories', action: () => dispatch(openSearchDialog()) },
    { text: 'Track Your Order', href: '/orders/track' },
  ];

  return (
    <SwipeableDrawer
      anchor="left"
      open={isSidebarOpen}
      onClose={() => dispatch(closeSidebar())}
      onOpen={() => {}}
    >
      <Box
        sx={{
          width: 300,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          padding: '0.5rem',
          boxSizing: 'border-box',
        }}
        role="presentation"
        onClick={() => dispatch(closeSidebar())}
      >
        {/* Logo */}
        <Box
          sx={{
            width: '100%',
            mb: 2,
            display: 'flex',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          onClick={() => router.push('/')}
        >
          <Image
            src={`${baseUrl}/assets/logos/maddy_custom3_main_logo.png`}
            alt="Maddy Logo"
            title="Maddy Logo"
            width={150}
            height={70}
            style={{ width: '55%', height: 'auto' }}
          />
        </Box>

        {/* Navigation Links */}
        <List sx={{ overflow: 'auto', flexGrow: 1, width: '100%' }}>
          {navItems.map((item, index) => (
            <ListItem
              key={item.text}
              disablePadding
              sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: item.href && isActive(item.href) ? 'rgba(211,211,211,0.5)' : 'transparent',
                borderRadius: '2rem',
                width: '100%',
                mb: 1,
              }}
              onClick={item.action ? item.action : undefined}
            >
              {item.href ? (
                <Link
                  href={item.href}
                  passHref
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <ListItemButton sx={{ width: '100%' }}>
                    <ListItemIcon sx={{ minWidth: '2.4rem' }}>{getIcon(index)}</ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: '1rem',
                        fontFamily: 'Jost',
                        fontWeight: 500,
                      }}
                    />
                  </ListItemButton>
                </Link>
              ) : (
                <ListItemButton sx={{ width: '100%' }}>
                  <ListItemIcon sx={{ minWidth: '2.4rem' }}>{getIcon(index)}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '1rem',
                      fontFamily: 'Jost',
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>
              )}
            </ListItem>
          ))}
        </List>

        {/* Contact Icons */}
        <Box
          sx={{
            borderTop: '1px solid #ccc',
            p: 1,
            display: 'flex',
            justifyContent: 'space-around',
            borderRadius: '0 0 12px 12px',
            backgroundColor: '#fff',
          }}
        >
          <Link href="https://wa.me/8112673988" style={{ cursor: 'pointer' }}>
            <WhatsAppIcon sx={{ fontSize: 25, color: 'rgb(62,62,62)' }} />
          </Link>
          <Link href="mailto:contact.maddycustoms@gmail.com" style={{ cursor: 'pointer' }}>
            <EmailIcon sx={{ fontSize: 25, color: 'rgb(62,62,62)' }} />
          </Link>
          <Link href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==" style={{ cursor: 'pointer' }}>
            <InstagramIcon sx={{ fontSize: 25, color: 'rgb(62,62,62)' }} />
          </Link>
        </Box>
      </Box>
    </SwipeableDrawer>
  );
}
