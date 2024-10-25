"use client"

import  { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Typewriter from 'typewriter-effect';
// import { useDispatch } from 'react-redux';
import { useSpring, animated } from 'react-spring';
import searchStyles from './styles/category-searchbox.module.css';

const bikeBrandsWithLinks = {
    "Car Pillar Wraps": "bike/win-wraps",
    "Helmet Store": "bike/helmet-wraps",
    "Tank Wraps": '/bike/tank-wraps-classic',
    "Bonnet Strip Wraps": "/bike/bonnet-strip-wraps",
    "Royal Enfield Classic 350": "/bike/royal-enfield-classic",
    "KTM Duke 125, 200, 390": "/bike/ktm-duke",
    "Yamaha MT 125": "/bike/yamaha-mt",
    "Pulsar N160": "/bike/pulsar-n160",
    "Pulsar NS 160, 200": "/bike/pulsar-ns",
    "TVS Raider 125": "/bike/tvs-raider",
    "Yamaha R15": "/bike/yamha-r15",
    "Apache 160, 200": "/bike/tvs-apache",
};

const CategorySearchBox = () => {
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    const router = useRouter();
    // const dispatch = useDispatch();
    const [onSearch, setOnSearch] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const springProps = useSpring({
        opacity: onSearch ? 1 : 0,
        transform: onSearch ? 'scale(1)' : 'scale(0.5)',
        config: { tension: 280, friction: 60 },
        height: onSearch ? '100vh' : '0vh',
        scrollBehavior: 'smooth',
        paddingBottom:onSearch ? '3rem' : '0px'
    });
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
            const filteredSuggestions = Object.keys(bikeBrandsWithLinks)
                .filter((brand) =>
                    brand?.toLowerCase().includes(inputValue.toLowerCase())
                )
                .slice(0, 10);  // Increased number of suggestions to 10

            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions(Object.keys(bikeBrandsWithLinks));
        }
    };

    useEffect(() => {
        setSuggestions(Object.keys(bikeBrandsWithLinks));
    }, []);

    const handleSuggestionClick = (suggestion) => {
        const link = bikeBrandsWithLinks[suggestion];
        if (link) {
            router.push(link);
        }

        setSearchText('');
        setSuggestions([]);
    };

    useEffect(() => {
        if (router?.asPath?.includes('#searchyourbikeinput')) {
            setOnSearch(true);
        }
    }, [router.asPath]);

    const brandSuggestions2 = ['Helmet Store', 'Win Wraps', 'Bike Wraps', 'Tank Wraps', 'Bonnet Strip Wraps'];

    return (
        <div>
            <div className={`${searchStyles.unexpandedWhite} ${onSearch ? searchStyles.expandWhite : ''}`} >
                <div className={onSearch ? searchStyles.showclose : searchStyles.hideclose} onClick={handleClose} style={{ cursor: 'pointer' }}>
                    <div style={{ cursor: 'pointer', marginLeft: '2rem' }}>
                        <Image width={20} height={20} alt='' src={`${baseUrl}/assets/icons/left-arrow.png`} style={{ cursor: 'pointer' }} />
                    </div>
                    <div className={onSearch ? searchStyles.showHeading : searchStyles.closeHeading}><h2>Search Your Bike</h2></div>
                </div>
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
                                        strings: brandSuggestions2,
                                        autoStart: true,
                                        loop: true,
                                        delay: 40,
                                        deleteSpeed: 10,
                                    }}
                                />
                            )}
                            <input
                                type="text"
                                spellCheck={false}
                                onFocus={handleFocus}
                                onChange={handleInputChange}
                                value={searchText}
                                className={searchStyles.inputField}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'transparent', border: 'none' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Animated suggestion box */}
                <animated.div style={springProps} className={onSearch ? searchStyles.predictionson : searchStyles.predictionsoff}>
                    <div className={searchStyles.predContainer} style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                        {suggestions.map((suggestion, index) => (
                            <a href={bikeBrandsWithLinks[suggestion]} key={index} className={searchStyles.pred} onClick={() => handleSuggestionClick(suggestion)}>
                                <span className={searchStyles.minisearch}>
                                    <Image src={`${baseUrl}/assets/icons/thin-search.png`} width={25} height={25} alt="" priority loading='eager' />
                                </span>
                                <h2>{suggestion}</h2>
                                {(['helmet', 'tank', 'pillar', 'bonnet'].some(word => suggestion?.toLowerCase().includes(word))) && (
                                    <span className={searchStyles.new}>
                                        <Image src={`${baseUrl}/assets/icons/new.png`} loading='eager' width={30} height={30} alt='' />
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>
                </animated.div>
            </div>
        </div>
    );
};

export default CategorySearchBox;
