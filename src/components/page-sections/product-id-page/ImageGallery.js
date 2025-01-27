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
import { Controller } from "swiper/modules";
import "swiper/css";

/**
 * Minimal ImageGallery:
 *  - Normal view (horizontal thumbs below)
 *  - Click image -> fullscreen (white bg)
 *    * Desktop: main image left ~80%, vertical thumbs right ~20%
 *    * Mobile: main image top, horizontal thumbs bottom
 *  - Preserves aspect ratio, etc.
 */
export default function ImageGallery({ images, alt }) {
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

  useEffect(() => {
    if (isFullView) {
      window.history.pushState({ fullView: true }, "");
      window.addEventListener("popstate", handlePopState);
    } else {
      if (window.history.state && window.history.state.fullView) {
        // If the current history state is from this fullscreen,
        // we pop it off by going back
        window.history.back();
      }
      window.removeEventListener("popstate", handlePopState);
    }
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isFullView, handlePopState]);

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

    // Slide main and thumb swipers
    if (normalMainSwiperRef.current) {
      normalMainSwiperRef.current.slideTo(newIndex, 300);
    }
    if (normalThumbSwiperRef.current) {
      normalThumbSwiperRef.current.slideTo(newIndex, 300);
    }
  };

  // ------------------ Fullscreen View Logic ------------------
  const handleCloseFullView = () => {
    setIsFullView(false);
  };

  const handleChangeIndexFull = (newIndex) => {
    setCurrentIndex(newIndex);

    // Slide main and thumb swipers in fullscreen
    if (fullMainSwiperRef.current) {
      fullMainSwiperRef.current.slideTo(newIndex, 300);
    }
    if (fullThumbSwiperRef.current) {
      fullThumbSwiperRef.current.slideTo(newIndex, 300);
    }
  };

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
            className={styles.mainSwiper}
          >
            {images.map((url, index) => (
              <SwiperSlide key={`main-${index}`}>
                <div className={styles.mainImageContainer}>
                  <Image
                    src={url}
                    alt={`${alt}-${index}`}
                    width={1242}
                    height={547}
                    className={styles.mainImage}
                    onClick={() => handleOpenFullView(index)}
                    priority={index === 0}
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Thumbnails + custom arrow buttons */}
          <div className={styles.thumbnailRowContainer}>
            <Swiper
              onSwiper={(swiper) => (normalThumbSwiperRef.current = swiper)}
              slidesPerView="auto"
              spaceBetween={10}
              speed={300}
              className={styles.thumbSwiper}
            >
              {images.map((url, index) => (
                <SwiperSlide key={`thumb-${index}`} style={{ width: "auto" }}>
                  <div
                    className={`${styles.thumbWrapper} ${
                      currentIndex === index ? styles.activeThumb : ""
                    }`}
                    onClick={() => handleChangeIndexNormal(index)}
                  >
                    <Image
                      src={url}
                      alt={`thumb-${index}`}
                      width={180}
                      height={80}
                      style={{ maxWidth: "100%", height: "auto" }}
                      className={styles.thumbnailImage}
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Next/Prev Buttons (Desktop only) */}
            {!isSmallDevice && images.length > 1 && (
              <div className={styles.thumbArrowsContainer}>
                <IconButton
                  onClick={() =>
                    handleChangeIndexNormal(
                      (currentIndex - 1 + images.length) % images.length
                    )
                  }
                  className={styles.thumbArrowButton}
                >
                  <ArrowBackIosNewIcon />
                </IconButton>
                <IconButton
                  onClick={() =>
                    handleChangeIndexNormal((currentIndex + 1) % images.length)
                  }
                  className={styles.thumbArrowButton}
                >
                  <ArrowForwardIosIcon />
                </IconButton>
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
                top: isSmallDevice ? 10 : 8,
                [isSmallDevice ? "right" : "left"]: isSmallDevice ? 10 : 6,
              }}
            >
              <CloseIcon />
            </IconButton>

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
                speed={300}
                className={styles.fullMainSwiper}
              >
                {images.map((url, index) => (
                  <SwiperSlide key={`f-main-${index}`}>
                    <div className={styles.fullMainImageContainer}>
                      <Image
                        src={url}
                        alt={`${alt}-fullscreen-${index}`}
                        width={1242}
                        height={547}
                        style={{ maxWidth: "100%", height: "auto" }}
                        className={styles.fullMainImage}
                        priority={index === 0}
                      />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>

              {/* Fullscreen Thumbnails */}
              {!isSmallDevice && 
                (
                // ===== DESKTOP: Thumbs on Right w/ Vertical Arrows =====
                <div className={styles.fullThumbColumnContainer}>
                  <Swiper
                    onSwiper={(swiper) => (fullThumbSwiperRef.current = swiper)}
                    slidesPerView="auto"
                    direction="vertical"
                    spaceBetween={10}
                    speed={300}
                    className={styles.fullThumbSwiperColumn}
                  >
                    {images.map((url, idx) => (
                      <SwiperSlide key={`f-thumb-${idx}`} style={{ height: "auto" }}>
                        <div
                          className={`${styles.thumbWrapper} ${
                            currentIndex === idx ? styles.activeThumb : ""
                          }`}
                          onClick={() => handleChangeIndexFull(idx)}
                        >
                          <Image
                            src={url}
                            alt={`full-thumb-${idx}`}
                            width={180}
                            height={80}
                            className={styles.thumbnailImage}
                            style={{ maxWidth: "100%", height: "auto" }}
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
