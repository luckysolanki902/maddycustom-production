'use client';

import React, { useState, useRef, useEffect } from 'react';  // ← Add useState, useRef, useEffect
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
  const imgStyle = { width: '100%', height: 'auto', borderRadius: '20px 10px 0 0' };

  const handleClick = () => {
    router.push(link);
  };
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <div className={styles.cardStyles} onClick={handleClick}>
      <Image src={imageSrc} alt={name} width={1242 * 2} height={547 * 2} style={imgStyle} />
      <h3 style={{ fontFamily: 'Krona One', textAlign: 'left' }} className={styles.h3}>
        {name}
      </h3>
      <p style={{ fontFamily: 'Krona One' }} className={styles.detailp}>
        <span className={styles.rs}>₹</span>
        <span style={{ color: 'gray' }} className={styles.price}>
          {price}
        </span>
      </p>
      <div className={styles.orderpng}>
        <Image
          width={565.66}
          height={310.66}
          src={`${baseImageUrl}/assets/icons/order.png`}
          alt=""
          priority
        />
      </div>
    </div>
  );
};

const OurUniqueProductCarousel = ({ products }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  // ── ADD: pagination state & swiperRef ──
  const [activeIdx, setActiveIdx] = useState(0);
  const swiperRef = useRef(null);

  // Reset to first slide whenever products change
  useEffect(() => {
    setActiveIdx(0);
    swiperRef.current?.slideToLoop(0);
  }, [products]);

  return (
    <div className={styles.mainCarDiv} style={{ position: 'relative' }}>
      
      {/* ── ADD: Four DIVs as pagination boxes ── */}
      <div className={styles.paginationBoxes}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`${styles.paginationBox} ${
              activeIdx === i ? styles.activeBox : ''
            }`}
            onClick={() => swiperRef.current?.slideToLoop(i)}
          />
        ))}
      </div>

      {/* your existing grey banner */}
      <div className={styles.carouselBackground}>
        <h2 className={styles.carouselHeading}>Bike Tank Wraps</h2>
      </div>

      {/* your existing code to mark image loaded */}
      {React.useEffect(() => setActiveIdx(0), [])}

      {/* ── ADD: wire onSwiper & onSlideChange here ── */}
      <Swiper
        onSwiper={(sw) => (swiperRef.current = sw)}
        onSlideChange={(sw) => setActiveIdx(sw.realIndex % 4)}
        style={{ position: 'relative' }}
        className={styles.swipercustom}
        loop={true}
        speed={500}
        simulateTouch={true}
        grabCursor={true}
        slidesPerView={isSmallScreen ? 1 : 3}
        spaceBetween={isSmallScreen ? 40 : 80}
        autoplay={{ delay: 3000, disableOnInteraction: false }}
      >
        {products.map((card, index) => (
          <SwiperSlide
            key={index}
            style={{
              background: 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
            }}
          >
            <Card
              imageSrc={`${baseImageUrl}${
                card.images[0].startsWith('/') ? card.images[0] : '/' + card.images[0]
              }`}
              name={card.name}
              price={card.price}
              link={`/shop${card.pageSlug}`}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default OurUniqueProductCarousel;
