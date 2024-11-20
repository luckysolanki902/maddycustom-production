'use client'; // Ensure client-side rendering

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Typewriter from 'typewriter-effect';
import searchStyles from './styles/categorysearchbox.module.css';

// Import MUI Components
import {
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Slide,
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import { usePathname } from 'next/navigation';

// Transition Component for Dialog
const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="down" ref={ref} {...props} />;
});

const CategorySearchBox = ({ categories, variants }) => { // Receive categories and variants as props
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const router = useRouter();
    const [onSearch, setOnSearch] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const mainSearchBoxRef = useRef(null); // Separate ref for main search box
    const dialogSearchBoxRef = useRef(null); // Separate ref for Dialog search box
    const [dynamicMaxHeight, setDynamicMaxHeight] = useState(500); // Example default value
    const currentPath = usePathname();

    // Initialize suggestions with all categories and variants
    useEffect(() => {
        const initialSuggestions = [
            ...categories.map(cat => cat.name),
            ...variants.map(variant => variant.name)
        ];
        setSuggestions(initialSuggestions.slice(0, 10)); // Limit to top 10 suggestions
    }, [categories, variants]);

    // Handle dynamic maxHeight based on viewport
    useEffect(() => {
        const calculateMaxHeight = () => {
            const viewportHeight = window.innerHeight;
            const desiredMaxHeight = viewportHeight - 200; // Adjust as needed
            setDynamicMaxHeight(desiredMaxHeight);
        };

        calculateMaxHeight();
        window.addEventListener('resize', calculateMaxHeight);
        return () => window.removeEventListener('resize', calculateMaxHeight);
    }, []);

    // Handle back button to close search dialog
    useEffect(() => {
        const handlePopState = () => {
            if (onSearch) {
                setOnSearch(false);
            }
        };

        if (onSearch) {
            window.addEventListener('popstate', handlePopState);
        }

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [onSearch]);

    // Handle Enter key to select the first suggestion
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
                handleSuggestionClick(suggestions[0]);
            }
        },
        [suggestions]
    );

    useEffect(() => {
        if (onSearch) {
            window.addEventListener('keydown', handleKeyDown);
        } else {
            window.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onSearch, handleKeyDown]);

    // Autofocus input when search is active
    useEffect(() => {
        if (onSearch && dialogSearchBoxRef.current) {
            dialogSearchBoxRef.current.focus();
        }
    }, [onSearch]);

    const handleFocus = () => {
        setOnSearch(true);
    };

    const handleClose = () => {
        setOnSearch(false);
    };

    const handleInputChange = (e) => {
        const inputValue = e.target.value;
        setSearchText(inputValue);

        if (inputValue.trim() !== '') {
            const lowerInput = inputValue.toLowerCase();
            const filteredCategories = categories
                .filter(cat => cat.name.toLowerCase().includes(lowerInput))
                .map(cat => cat.name);
            const filteredVariants = variants
                .filter(variant => variant.name.toLowerCase().includes(lowerInput))
                .map(variant => variant.name);
            const combinedSuggestions = [...filteredCategories, ...filteredVariants].slice(0, 10);
            setSuggestions(combinedSuggestions);
        } else {
            const initialSuggestions = [
                ...categories.map(cat => cat.name),
                ...variants.map(variant => variant.name)
            ];
            setSuggestions(initialSuggestions.slice(0, 10));
        }
    };

    const handleSuggestionClick = (suggestion) => {
        // Determine if the suggestion is a variant
        const variant = variants.find(v => v.name.toLowerCase() === suggestion.toLowerCase());

        console.log({ suggestion, variants });
        if (variant && variant.pageSlug) {
            router.push(`/shop/${variant.pageSlug}`);
        } else {
            // It's a category, find the first variant of this category
            const category = categories.find(c => c.name.toLowerCase() === suggestion.toLowerCase());
            if (category) {
                const firstVariant = variants.find(v => String(v.specificCategory) === String(category.id));
                // console.log({firstVariant})
                if (firstVariant && firstVariant.pageSlug) {
                    //  console.log({firstVariant})
                    router.push(`/shop/${firstVariant.pageSlug}`);
                } else {
                    console.warn('No variant found for category:', category.name);
                }
            }
        }

        // Clear search state after navigation
        setSearchText('');
        setSuggestions([]);
        setOnSearch(false);
    };

    const typewriterStrings = categories.map(cat => cat.name);

    return (
        <>
            {/* Main Search Box - Only Rendered When Dialog is Closed */}
            {!onSearch && (
                <div className={searchStyles.unexpandedWhite}>
                    <div className={searchStyles.searchBoxContainer}>
                        <div className={searchStyles.searchBoxSubContainer}>
                            <span className={searchStyles.searchIcon}>
                                <div className="searchIcon">
                                    <Image src={`${baseUrl}/assets/icons/search.png`} width={512} height={512} alt="" />
                                </div>
                            </span>
                            <div className={searchStyles.inputContainer} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                                {searchText === '' && !onSearch && (
                                    <Typewriter
                                        options={{
                                            strings: typewriterStrings,
                                            autoStart: true,
                                            loop: true,
                                            delay: 40,
                                            deleteSpeed: 10,
                                        }}
                                    />
                                )}
                                <input
                                    ref={mainSearchBoxRef}
                                    type="text"
                                    spellCheck={false}
                                    onFocus={handleFocus}
                                    onChange={handleInputChange}
                                    value={searchText} // Corrected here
                                    className={`${searchStyles.inputField} ${searchStyles.nonDialogInputField}`}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'transparent', border: 'none' }}
                                    // placeholder="Search..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full-Screen MUI Dialog */}
            <Dialog
                fullScreen
                open={onSearch}
                onClose={handleClose}
                TransitionComponent={Transition}
                PaperProps={{
                    style: { backgroundColor: 'white' },
                }}
            >
                <AppBar sx={{ position: 'relative', backgroundColor: 'white', boxShadow: 'none' }}>
                    <Toolbar className={searchStyles.searchheader}>
                        <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">
                            {/* Replace CloseIcon with left-arrow.png */}
                            <Image
                                src={`${baseUrl}/assets/icons/left-arrow.png`}
                                width={24}
                                height={24}
                                alt="Close"
                                style={{ cursor: 'pointer' }}
                            />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1, color: 'black' , fontFamily:'Jost'}} variant="h6" component="div">
                            Search Your Bike
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Box sx={{ p: 2, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box className={searchStyles.searchBoxSubContainer} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Image
                            src={`${baseUrl}/assets/icons/search.png`}
                            width={24}
                            height={24}
                            alt="Search"
                            style={{ marginRight: '16px' }}
                        />
                        <input
                            ref={dialogSearchBoxRef}
                            type="text"
                            spellCheck={false}
                            onChange={handleInputChange}
                            value={searchText}
                            className={`${searchStyles.inputField} ${searchStyles.dialogInputField}`}
                            autoFocus
                            style={{
                                flex: 1,
                                fontSize: '1.2rem',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                            }}
                            placeholder="Search..."
                        />
                    </Box>
                    {/* Suggestion List */}
                    <Box sx={{ flex: 1, overflowY: 'auto' }} className={searchStyles.suggestionBox}>
                        {suggestions.length > 0 ? (
                            <List>
                                {suggestions.map((suggestion, index) => (
                                    <ListItem
                                        sx={{
                                            cursor: 'pointer', // Changed to pointer for better UX
                                            '&:hover, &.Mui-focusVisible': {
                                                backgroundColor: '#f5f5f5',
                                            },
                                            ...(searchText.trim() !== '' && index === 0 ? { backgroundColor: '#f5f5f5' } : {}),
                                        }}
                                        key={index}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                    >
                                        <ListItemIcon>
                                            <Image src={`${baseUrl}/assets/icons/thin-search.png`} width={25} height={25} alt="" priority loading='eager' />
                                        </ListItemIcon>
                                        <ListItemText primary={
                                            <Box display='flex' alignItems='center'>
                                                <Typography variant="body1" component="span" sx={{fontFamily:'Jost'}}>
                                                    {suggestion}
                                                </Typography>
                                                {(['helmet', 'tank', 'pillar', 'bonnet'].some(word => suggestion?.toLowerCase().includes(word))) && (
                                                    <Image src={`${baseUrl}/assets/icons/new.png`} loading='eager' width={30} height={30} alt='New' sx={{ ml: 1 }} />
                                                )}
                                            </Box>
                                        } />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography variant="h6" align="center" sx={{ mt: 4 , fontFamily:'Jost'}}>
                                No results found
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Dialog>
        </>
    )
}

export default CategorySearchBox;
