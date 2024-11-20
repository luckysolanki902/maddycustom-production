"use client";

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { register } from 'swiper/element/bundle';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/win.module.css';
import { useMediaQuery } from '@mui/material';

register();

const Card = ({ imageSrc, name, price, link }) => {
    const router = useRouter();
    const imgStyle = { width: '100%', height: 'auto', borderRadius: '10px 10px 0 0' };

    const handleClick = () => {
        router.push(link);
    };
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    return (
        <div className={styles.cardStyles} onClick={handleClick}>
            <Image src={imageSrc} alt={name} width={1242 * 2} height={547 * 2} style={imgStyle} />
            <h3 style={{ fontFamily: "Krona One", textAlign: 'left' }} className={styles.h3}>{name}</h3>
            <p style={{ fontFamily: 'Krona One' }} className={styles.detailp}>
                <span className={styles.rs}>₹</span>
                <span style={{ color: 'gray' }} className={styles.price}>{price}</span>
            </p>
            <div className={styles.orderpng}>
                <Image width={565.66} height={310.66} src={`${baseImageUrl}/assets/icons/order.png`} alt='' priority />
            </div>
        </div>
    );
};

const OurUniqueProductCarousel = ({ products }) => { // Accept products as props
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const [isImageLoaded, setIsImageLoaded] = React.useState(false);
    const isSmallScreen = useMediaQuery('(max-width: 768px)');

    return (
        <div className={styles.mainCarDiv} style={{ position: 'relative' }}>
            {isSmallScreen ? (
                <Image
                    src={`${baseImageUrl}/assets/carousels/carouselbgs/winSliderBgPhone2.png`}
                    alt="Background Image"
                    width={1242 * 2}
                    height={547 * 2}
                    style={{ width: '100%', height: 'auto', cursor: 'pointer' }}
                    onLoad={() => setIsImageLoaded(true)}
                />
            ) : (
                <Image
                    src={`${baseImageUrl}/assets/carousels/carouselbgs/winSliderBgPC3.png`}
                    alt="Background Image"
                    width={1242 * 2}
                    height={547 * 2}
                    style={{ width: '100%', height: 'auto', cursor: 'pointer' }}
                    onLoad={() => setIsImageLoaded(true)}
                />
            )}
            {isImageLoaded && (
                <Swiper
                    className={styles.swipercustom}
                    loop={true}
                    speed={500}
                    simulateTouch={true}
                    pagination={isSmallScreen ? { type: 'bullets', clickable: true, dynamicBullets: true } : false}
                    grabCursor={true}
                    slidesPerView={isSmallScreen ? 1 : 3}
                    spaceBetween={isSmallScreen ? 40 : 80}
                    autoplay={{ delay: 3000, disableOnInteraction: false }}
                >
                    {products.map((card, index) => (
                        <SwiperSlide key={index} style={{ background: 'transparent', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                            <Card
                                imageSrc={`${baseImageUrl}${card.images[0]}`} // assuming first image is used in carousel
                                name={card.name}
                                price={card.price}
                                link={`/shop${card.pageSlug}`}
                            />
                        </SwiperSlide>
                    ))}
                </Swiper>
            )}
        </div>
    );
};

export default OurUniqueProductCarousel;
