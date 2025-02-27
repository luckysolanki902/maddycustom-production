'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
    Box,
    SwipeableDrawer,
    Button,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import PhoneIcon from '@mui/icons-material/Phone';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import InstagramIcon from '@mui/icons-material/Instagram';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Image from 'next/image';

const Sidebar = (props) => {
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const router = useRouter();
    const [state, setState] = useState({ left: false });

    // Media query to check if screen width is >= 1000px
    const isDesktop = useMediaQuery('(min-width:1000px)');

    // Toggle drawer open/close state
    const toggleDrawer = (anchor, open) => (event) => {
        if (event?.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setState({ ...state, [anchor]: open });
    };

    if (isDesktop) return null; // Hide sidebar on screens smaller than 1000px

    return (
        <>
            <Button
                onClick={toggleDrawer('left', true)}
                startIcon={
                    <MenuIcon
                        style={{
                            color: props.color || 'black',
                            fontSize: 29,
                            marginBottom: props.margin ? props.marginB : '-42px',
                            zIndex: 20,
                        }}
                    />
                }
            />
            <SwipeableDrawer
                anchor="left"
                open={state['left']}
                onClose={toggleDrawer('left', false)}
                onOpen={toggleDrawer('left', true)}
            >
                <Box sx={{ width: 300 }}>
                    {/* Sidebar Content */}
                    <Box sx={{ padding: '0.5rem' }}>
                        {/* Logo */}
                        <Box sx={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                            <Image
                                height={1000}
                                width={1000}
                                src={`${baseUrl}/assets/logos/maddy_custom3_main_logo.png`}
                                alt="Maddy Logo"
                                title="Maddy Logo"
                                style={{ width: '55%', height: 'auto' }}
                            />
                        </Box>
                        {/* Navigation Links */}
                        <List>
                            {[
                                { text: 'Home', href: '/' },
                                { text: 'Contact Us', href: '/#homecontactdiv' },
                                { text: 'Search Categories', href: '/#searchcategories' },
                                { text: 'Track Your Order', href: '/orders/track' },
                            ].map((item, index) => (
                                <ListItem key={item.text} disablePadding>
                                    <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                                        <ListItemButton>
                                            <ListItemIcon>
                                                {index === 0 ? <HomeRoundedIcon /> : 
                                                 index === 1 ? <PhoneIcon /> : 
                                                 index === 2 ? <SearchIcon /> : 
                                                 <LocalShippingIcon />}
                                            </ListItemIcon>
                                            <ListItemText primary={item.text} />
                                        </ListItemButton>
                                    </Link>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Box>
            </SwipeableDrawer>
        </>
    );
};

export default Sidebar;
