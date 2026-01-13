"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import styles from "./styles/imagegallery.module.css";

// MUI
import { useMediaQuery, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

// Swiper
import { Swiper, SwiperSlide } from "swiper/react";
import { Controller, EffectFade, FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";

/**
 * Minimal ImageGallery:
 *  - Normal view (horizontal thumbs below)
 *  - Click image -> fullscreen (white bg)
 *    * Desktop: main image left ~80%, vertical thumbs right ~20%
 *    * Mobile: main image top, horizontal thumbs bottom
 *  - Preserves aspect ratio, etc.
 */
export default function ImageGallery({ images, alt, restrictWidth }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullView, setIsFullView] = useState(false);

  const isSmallDevice = useMediaQuery("(max-width: 600px)");

  // Swiper refs for normal mode
  const normalMainSwiperRef = useRef(null);
  const normalThumbSwiperRef = useRef(null);

  // Swiper refs for fullscreen mode
  const fullMainSwiperRef = useRef(null);
  const fullThumbSwiperRef = useRef(null);

  // ------------------ Handle Browser Back for Fullscreen ------------------
  const handlePopState = useCallback(
    (event) => {
      if (isFullView) {
        event.preventDefault();
        handleCloseFullView();
      }
    },
    [isFullView]
  );

  // ------------------ Keyboard Navigation ------------------
  const handleKeyDown = useCallback(
    (event) => {
      if (!isFullView) return;
      
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const newIndex = (currentIndex - 1 + images.length) % images.length;
        setCurrentIndex(newIndex);
        if (fullMainSwiperRef.current) {
          fullMainSwiperRef.current.slideTo(newIndex, 300);
        }
        if (fullThumbSwiperRef.current) {
          fullThumbSwiperRef.current.slideTo(newIndex, 300);
        }
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const newIndex = (currentIndex + 1) % images.length;
        setCurrentIndex(newIndex);
        if (fullMainSwiperRef.current) {
          fullMainSwiperRef.current.slideTo(newIndex, 300);
        }
        if (fullThumbSwiperRef.current) {
          fullThumbSwiperRef.current.slideTo(newIndex, 300);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCloseFullView();
      }
    },
    [isFullView, currentIndex, images.length]
  );

  useEffect(() => {
    if (isFullView) {
      window.history.pushState({ fullView: true }, "");
      window.addEventListener("popstate", handlePopState);
      window.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when in fullscreen
      document.body.style.overflow = "hidden";
    } else {
      if (window.history.state && window.history.state.fullView) {
        // If the current history state is from this fullscreen,
        // we pop it off by going back
        window.history.back();
      }
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isFullView, handlePopState, handleKeyDown]);

  // ------------------ Normal View Logic ------------------
  const handleOpenFullView = (index) => {
    setCurrentIndex(index);
    setIsFullView(true);

    // Sync fullscreen swipers to selected index
    setTimeout(() => {
      if (fullMainSwiperRef.current) fullMainSwiperRef.current.slideTo(index, 0);
      if (fullThumbSwiperRef.current) fullThumbSwiperRef.current.slideTo(index, 0);
    }, 50);
  };

  const handleChangeIndexNormal = (newIndex) => {
    setCurrentIndex(newIndex);

    // Slide main and thumb swipers with better sync
    if (normalMainSwiperRef.current) {
      normalMainSwiperRef.current.slideTo(newIndex, 300);
    }
    if (normalThumbSwiperRef.current) {
      // Center the selected thumbnail in view
      const thumbSwiper = normalThumbSwiperRef.current;
      const slides = thumbSwiper.slides;
      if (slides[newIndex]) {
        const slideOffset = slides[newIndex].offsetLeft;
        const swiperWidth = thumbSwiper.width;
        const slideWidth = slides[newIndex].offsetWidth;
        const centerOffset = slideOffset - (swiperWidth / 2) + (slideWidth / 2);
        thumbSwiper.translateTo(-centerOffset, 300);
      }
    }
  };

  // ------------------ Fullscreen View Logic ------------------
  const handleCloseFullView = () => {
    setIsFullView(false);
  };

  const handleChangeIndexFull = useCallback((newIndex) => {
    setCurrentIndex(newIndex);

    // Slide main and thumb swipers in fullscreen
    if (fullMainSwiperRef.current) {
      fullMainSwiperRef.current.slideTo(newIndex, 300);
    }
    if (fullThumbSwiperRef.current) {
      fullThumbSwiperRef.current.slideTo(newIndex, 300);
    }
  }, []);

  // ------------------ Render ------------------
  return (
    <div className={styles.galleryContainer}>
      {/* ====================== NORMAL MODE ====================== */}
      {!isFullView && (
        <>
          {/* Main Image Swiper */}
          <Swiper
            onSwiper={(swiper) => (normalMainSwiperRef.current = swiper)}
            onSlideChange={(swiper) => setCurrentIndex(swiper.activeIndex)}
            modules={[Controller]}
            slidesPerView={1}
            speed={300}
            allowTouchMove={true}
            className={styles.mainSwiper}
          >
            {images.map((url, index) => (
              <SwiperSlide key={`main-${index}`}>
                <div className={styles.mainImageContainer} style={{ maxWidth: restrictWidth ? "600px" : "100%" }}>
                  <Image
                    src={url}
                    alt={`${alt}-${index}`}
                    loading="eager"
                    width={isSmallDevice ? 600 : undefined}
                    height={isSmallDevice ? 400 : undefined}
                    fill={!isSmallDevice}
                    style={isSmallDevice ? {
                      width: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                      objectPosition: 'center'
                    } : undefined}
                    className={styles.mainImage}
                    onClick={() => handleOpenFullView(index)}
                    priority={index === 0}
                    sizes="(max-width: 600px) 100vw, (max-width: 1024px) 80vw, 60vw"
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Thumbnails */}
          <div className={styles.thumbnailRowContainer}>
            <Swiper
              onSwiper={(swiper) => (normalThumbSwiperRef.current = swiper)}
              slidesPerView="auto"
              spaceBetween={isSmallDevice ? 8 : 12}
              speed={300}
              centeredSlides={false}
              freeMode={true}
              modules={[FreeMode]}
              className={styles.thumbSwiper}
            >
              {images.map((url, index) => (
                <SwiperSlide key={`thumb-${index}`} style={{ width: "auto" }}>
                  <div
                    className={`${styles.thumbWrapper} ${currentIndex === index ? styles.activeThumb : ""
                      }`}
                    onClick={() => handleChangeIndexNormal(index)}
                  >
                    <Image
                      src={url}
                      alt={`thumb-${index}`}
                      fill
                      className={styles.thumbnailImage}
                      sizes="(max-width: 600px) 100px, 150px"
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Modern Arrow Buttons (PC only) */}
            {!isSmallDevice && images.length > 1 && (
              <div className={styles.modernArrowContainer}>
                <button
                  type="button"
                  onClick={() =>
                    handleChangeIndexNormal(
                      (currentIndex - 1 + images.length) % images.length
                    )
                  }
                  className={styles.modernArrowButton}
                  aria-label="Previous image"
                >
                  <ArrowBackIosNewIcon />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleChangeIndexNormal((currentIndex + 1) % images.length)
                  }
                  className={styles.modernArrowButton}
                  aria-label="Next image"
                >
                  <ArrowForwardIosIcon />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ====================== FULLSCREEN MODE ====================== */}
      {isFullView && (
        <div className={styles.fullscreenOverlay}>
          <div className={styles.fullscreenContainer}>
            {/* Close Button */}
            <IconButton
              className={styles.closeButton}
              onClick={handleCloseFullView}
              aria-label="Close Full View"
              sx={{
                position: "absolute",
                top: isSmallDevice ? 16 : 20,
                [isSmallDevice ? "right" : "right"]: isSmallDevice ? 16 : 20,
                zIndex: 10001,
                backgroundColor: "rgba(0, 0, 0, 0.7) !important",
                color: "#fff !important",
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.9) !important",
                }
              }}
            >
              <CloseIcon />
            </IconButton>

            {/* Navigation Hints */}
            {!isSmallDevice && (
              <div className={styles.navigationHints}>
                <span>Use arrow keys or click thumbnails to navigate • ESC to close</span>
              </div>
            )}

            <div
              className={
                isSmallDevice
                  ? styles.fullscreenInnerMobile
                  : styles.fullscreenInnerDesktop
              }
            >
              {/* Fullscreen Main Swiper */}
              <Swiper
                onSwiper={(swiper) => (fullMainSwiperRef.current = swiper)}
                onSlideChange={(swiper) => setCurrentIndex(swiper.activeIndex)}
                slidesPerView={1}
                speed={400}
                effect="fade"
                modules={[EffectFade]}
                allowTouchMove={true}
                className={styles.fullMainSwiper}
              >
                {images.map((url, index) => (
                  <SwiperSlide key={`f-main-${index}`}>
                    <div className={styles.fullMainImageContainer}>
                      <Image
                        src={url}
                        alt={`${alt}-fullscreen-${index}`}
                        width={0}
                        height={0}
                        sizes="(max-width: 600px) 100vw, 80vw"
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: isSmallDevice ? 'none' : '90vh',
                          objectFit: 'contain',
                          objectPosition: 'center'
                        }}
                        className={styles.fullMainImage}
                        priority={index === 0}
                      />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>

              {/* Navigation Arrows for Main Image */}
              {images.length > 1 && (
                <>
                  <IconButton
                    className={styles.navArrowLeft}
                    onClick={() => {
                      const newIndex = (currentIndex - 1 + images.length) % images.length;
                      handleChangeIndexFull(newIndex);
                    }}
                    sx={{
                      position: "absolute",
                      left: isSmallDevice ? 10 : 20,
                      top: "50%",
                      transform: "translateY(-50%)",
                      zIndex: 10000,
                      backgroundColor: "rgba(0, 0, 0, 0.6) !important",
                      color: "#fff !important",
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.8) !important",
                      }
                    }}
                  >
                    <ArrowBackIosNewIcon />
                  </IconButton>
                  <IconButton
                    className={styles.navArrowRight}
                    onClick={() => {
                      const newIndex = (currentIndex + 1) % images.length;
                      handleChangeIndexFull(newIndex);
                    }}
                    sx={{
                      position: "absolute",
                      right: isSmallDevice ? 10 : !isSmallDevice ? 240 : 20,
                      top: "50%",
                      transform: "translateY(-50%)",
                      zIndex: 10000,
                      backgroundColor: "rgba(0, 0, 0, 0.6) !important",
                      color: "#fff !important",
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.8) !important",
                      }
                    }}
                  >
                    <ArrowForwardIosIcon />
                  </IconButton>
                </>
              )}

              {/* Fullscreen Thumbnails */}
              {!isSmallDevice ? (
                // ===== DESKTOP: Improved Thumbs on Right =====
                <div className={styles.fullThumbColumnContainer}>
                  <div className={styles.thumbnailHeader}>
                    <span>{currentIndex + 1} / {images.length}</span>
                  </div>
                  <Swiper
                    onSwiper={(swiper) => (fullThumbSwiperRef.current = swiper)}
                    slidesPerView="auto"
                    direction="vertical"
                    spaceBetween={12}
                    speed={300}
                    centeredSlides={false}
                    freeMode={true}
                    modules={[FreeMode]}
                    className={styles.fullThumbSwiperColumn}
                  >
                    {images.map((url, idx) => (
                      <SwiperSlide key={`f-thumb-${idx}`} style={{ height: "auto" }}>
                        <div
                          className={`${styles.thumbWrapper} ${styles.fullThumbWrapper} ${currentIndex === idx ? styles.activeThumb : ""
                            }`}
                          onClick={() => handleChangeIndexFull(idx)}
                        >
                          <Image
                            src={url}
                            alt={`full-thumb-${idx}`}
                            fill
                            className={styles.thumbnailImage}
                            sizes="120px"
                          />
                          {currentIndex === idx && (
                            <div className={styles.activeIndicator} />
                          )}
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              ) : (
                // ===== MOBILE: Horizontal Thumbs at Bottom =====
                <div className={styles.fullThumbRowContainer}>
                  <Swiper
                    onSwiper={(swiper) => (fullThumbSwiperRef.current = swiper)}
                    slidesPerView="auto"
                    spaceBetween={8}
                    speed={300}
                    centeredSlides={false}
                    className={styles.fullThumbSwiperRow}
                  >
                    {images.map((url, idx) => (
                      <SwiperSlide key={`f-thumb-mobile-${idx}`} style={{ width: "auto" }}>
                        <div
                          className={`${styles.thumbWrapper} ${currentIndex === idx ? styles.activeThumb : ""
                            }`}
                          onClick={() => handleChangeIndexFull(idx)}
                        >
                          <Image
                            src={url}
                            alt={`full-thumb-mobile-${idx}`}
                            fill
                            className={styles.thumbnailImage}
                            sizes="80px"
                          />
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
