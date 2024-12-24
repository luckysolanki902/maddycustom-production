'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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


const drawerWidth = 300;

// Inline Styles
const contactBoxStyle = {
    borderTop: '1px solid #ccc',
    padding: '10px',
    display: 'flex',
    justifyContent: 'space-around',
    borderRadius: '0 0 12px 12px',
    backgroundColor: '#fff',
    overflow: 'hidden',
    width: '100%',
};

const iconStyle = {
    fontSize: 25,
    color: 'rgb(62, 62, 62)',
    cursor: 'pointer',
    overflow: 'hidden',
};

const linkStyle = {
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    width: '100%',
};

const Sidebar = (props) => {
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const router = useRouter();
    const [state, setState] = useState({
        left: false,
    });

    // Determine if a link is active based on current route
    const isActive = (href) => router.asPath === href;

    // Toggle drawer open/close state
    const toggleDrawer = (anchor, open) => (event) => {
        if (
            event &&
            event.type === 'keydown' &&
            (event.key === 'Tab' || event.key === 'Shift')
        ) {
            return;
        }
        setState({ ...state, [anchor]: open });
    };

    // Render the list inside the drawer
    const renderList = (anchor) => (
        <Box
            sx={{
                width: drawerWidth,
                display: 'flex',
                flexDirection: 'column',
                height: '100%', // Ensure the Box occupies full height
                position: 'relative',
                padding: '0.5rem',
                boxSizing: 'border-box',
            }}
            role="presentation"
            onClick={toggleDrawer(anchor, false)}
            onKeyDown={toggleDrawer(anchor, false)}
        >
            {/* Main Content Container */}
            <Box
                sx={{
                    flexGrow: 1, // Allow this section to take up remaining space
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Logo Section */}
                <Box
                    sx={{
                        width: '100%',
                        marginBottom: '20px',
                        display: 'flex',
                        justifyContent: 'flex-start',
                        overflow: 'hidden',
                        paddingLeft: '1rem',
                    }}
                >
                    <Image
                        height={1000}
                        width={1000}
                        src={`${baseUrl}/assets/logos/maddylogo_christmas_cap.png`}
                        alt="Maddy Logo"
                        title="Maddy Logo"
                        style={{ width: '95%', overflow: 'hidden', height: 'auto', transform: 'translateX(-40px)' }}
                    />
                </Box>

                {/* Navigation Links */}
                <List sx={{ overflow: 'auto', flexGrow: 1, width: '100%' }}>
                    {[
                        { text: 'Home', href: '/' },
                        { text: 'Contact Us', href: '/#homecontactdiv' },
                        { text: 'Search Categories', href: '/#searchcategories' },
                        { text: 'Track Your Order', href: '/orders/track' },
                    ].map((item, index) => (
                        <ListItem
                            key={item.text}
                            disablePadding
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: isActive(item.href) ? 'rgba(211, 211, 211, 0.5)' : 'transparent',
                                borderRadius: '2rem',
                                overflow: 'hidden',
                                width: '100%',
                                mb: 1, // Add some margin between items
                            }}
                        >
                            <Link href={item.href} passHref style={linkStyle}>
                                <ListItemButton sx={{ overflow: 'hidden', width: '100%' }}>
                                    <ListItemIcon sx={{ minWidth: '2.4rem', overflow: 'hidden' }}>
                                        {getIcon(index)}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography
                                                component="span"
                                                variant="inherit"
                                                sx={{
                                                    fontSize: { xs: '1rem', md: '0.76rem' },
                                                    fontFamily: 'Jost',
                                                    fontWeight: '500',
                                                    overflow: 'hidden',
                                                    width: '100%',
                                                }}
                                            >
                                                {item.text}
                                            </Typography>
                                        }
                                    />
                                </ListItemButton>
                            </Link>
                        </ListItem>
                    ))}
                </List>
            </Box>

            {/* Contact Icons at the Bottom */}
            <Box style={contactBoxStyle}>
                <Link style={{cursor:'pointer'}} href="https://wa.me/8112673988" className="sideiconhover">
                    <WhatsAppIcon style={iconStyle} />
                </Link>
                <Link style={{cursor:'pointer'}} href="mailto:contact.maddycustoms@gmail.com" className="sideiconhover">
                    <EmailIcon style={iconStyle} />
                </Link>
                <Link style={{cursor:'pointer'}} href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==" className="sideiconhover">
                    <InstagramIcon style={iconStyle} />
                </Link>
            </Box>
        </Box>
    );

    // Function to return the appropriate icon based on index
    const getIcon = (index) => {
        switch (index) {
            case 0:
                return <HomeRoundedIcon style={{ color: 'rgb(85, 85, 85)', fontSize: '1.3rem' }} />;
            case 1:
                return <PhoneIcon style={{ color: 'rgb(85, 85, 85)', fontSize: '1.3rem' }} />;
            case 2:
                return <SearchIcon style={{ color: 'rgb(85, 85, 85)', fontSize: '1.3rem' }} />;
            case 3:
                return <LocalShippingIcon style={{ color: 'rgb(85, 85, 85)', fontSize: '1.3rem' }} />;
            default:
                return <ReportProblemRoundedIcon style={{ color: 'rgb(85, 85, 85)', fontSize: '1.3rem' }} />;
        }
    };

    return (
        <>
            {/* Menu Button */}
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
            >
                {/* You can add button text here if needed */}
            </Button>

            {/* Swipeable Drawer */}
            <SwipeableDrawer
                anchor="left"
                open={state['left']}
                onClose={toggleDrawer('left', false)}
                onOpen={toggleDrawer('left', true)}
                sx={{ overflow: 'hidden', position: 'relative' }}
            >
                {renderList('left')}
            </SwipeableDrawer>
        </>
    );
};

export default Sidebar;
