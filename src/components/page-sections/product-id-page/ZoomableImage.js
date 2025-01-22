// @models/full-page-comps/ZoomableImage.js
"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Navigation, Pagination } from "swiper/modules";
import Image from "next/image";
import CloseIcon from "@mui/icons-material/Close";
import styles from "./styles/zoomableimage.module.css"; // Ensure correct path
import { useSpring, animated } from "@react-spring/web";
import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "@mui/material";

export default function ZoomableImage({ images, alt, isZoomed, setIsZoomed }) {
  const [currentZoomedImage, setCurrentZoomedImage] = useState(null);
  const isSmallDevice = useMediaQuery("(max-width: 600px)");

  // Define the animation properties using React Spring
  const animationProps = useSpring({
    transform: isZoomed ? "scale(1) rotate(0deg)" : "scale(1) rotate(0deg)",
    config: { tension: 300, friction: 20 },
  });

  // Handle Back Button Behavior
  const handlePopState = useCallback(
    (event) => {
      if (isZoomed) {
        // Prevent the default back navigation
        event.preventDefault();
        // Zoom out the image
        handleCloseZoom();
      }
    },
    [isZoomed]
  );

  useEffect(() => {
    if (isZoomed) {
      // Push a new state to the history when zoomed in
      window.history.pushState({ zoomed: true }, "");

      // Add the popstate event listener
      window.addEventListener("popstate", handlePopState);
    } else {
      // If not zoomed, ensure we don't have extra history entries
      if (window.history.state && window.history.state.zoomed) {
        window.history.back();
      }

      // Remove the popstate event listener
      window.removeEventListener("popstate", handlePopState);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isZoomed, handlePopState]);

  const handleImageClick = (url) => {
    setCurrentZoomedImage(url);
    setIsZoomed(true);
  };

  const handleCloseZoom = () => {
    setIsZoomed(false);
    setCurrentZoomedImage(null);
  };

  return (
    <div className={`${styles.imgContainer} ${isZoomed ? styles.zoomed : ""}`}>
      {!isZoomed ? (
        <Swiper
          modules={[Navigation, Pagination]}
          pagination={{ clickable: true }}
          loop={false}
          speed={500}
          simulateTouch={true}
          autoplay={false}
          style={{ width: "90%", height: "100%" }}
          className={styles.swiperContainer} // Apply the local wrapper class
        >
          {images.map((url, index) => (
            <SwiperSlide key={index}>
              <Image
                src={url}
                alt={`${alt}-${index}`}
                width={1242 * 2}
                height={547 * 2}
                priority={true}
                className={styles.image}
                onClick={() => handleImageClick(url)}
                style={{ width: "100%", height: "auto", cursor: "pointer" }}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div
          className={`${styles.imgContainer} ${isZoomed ? styles.zoomed : ""}`}
          onClick={handleCloseZoom}
        >
          {isZoomed && !isSmallDevice && (
            <div
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                cursor: "pointer",
                zIndex: "99999",
                backgroundColor: "white",
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <CloseIcon
                onClick={handleCloseZoom}
                style={{ fontSize: "2rem", color: "#000", zIndex: "99999" }}
              />
            </div>
          )}
          <animated.div
            className={styles.animatedDiv}
            style={isSmallDevice ? animationProps : {}}
          >
            <Image
              src={currentZoomedImage}
              alt={`${alt}-zoomed`}
              width={1242 * 2}
              height={547 * 2}
              priority={true}
              className={`${styles.image} ${isZoomed ? styles.rotated : ""}`}
              style={{ width: "100%", height: "auto" }}
            />
          </animated.div>
        </div>
      )}
    </div>
  );
}
