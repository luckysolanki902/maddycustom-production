"use client"
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { register } from "swiper/element/bundle";
import Image from "next/image";
import Link from "next/link";
// Import the new Timer component
import TimerOverBg from "../launch/TimerOverBg";
import { useMediaQuery } from "@mui/material";


register();


const FullWidthRoundCornerLandscapeCarousel = ({ images ,links }) => {
    const isSmallDevice = useMediaQuery('(max-width: 600px)');
    const isBetweenSmallAndMedium = useMediaQuery('(min-width: 601px) and (max-width: 1424px)');
    // Example: environment-based URL for timer background
    const baseUrl =
        process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL +
        "/assets/carousels/homepage-main/timer_bg2.jpg";
    const launchDate = new Date("2025-02-18T23:59:00");
    const now = new Date();
    const showTimer = now < launchDate;
    return (
        <Swiper
            style={{ height: "auto", borderRadius: showTimer ? "1rem" : "0.5rem" }}
            loop={true}
            speed={500}
            simulateTouch={true}
            autoplay={{ delay: 3000, disableOnInteraction: false }}
        >
            {/* First Slide - Timer */}
            {showTimer ? (
                <SwiperSlide>
                    <TimerOverBg
                        imageUrl={baseUrl}
                        endTime="2025-08-19T23:59:00"
                        paramCount={isSmallDevice ? 3 : isBetweenSmallAndMedium ? 3 : 4}          // s, m, h, d
                        imageQuality={80}      // example quality
                        width={976}
                        height={406}
                    
                    />
                </SwiperSlide>
            ) : (
                images.map((url, index) => (
                    <SwiperSlide key={index}>
                        <Link href={links?.[index] ?? "#"} passHref>
                        <Image
                            priority={true}
                            src={url}
                            alt={`carousel-image-${index}`}
                            width={1242 * 2}
                            height={547 * 2}
                            style={{ width: "100%", height: "auto", cursor: "pointer" }}
                        />  
                        </Link>
                    </SwiperSlide>
                ))
            )}

        </Swiper>
    );
};

export default FullWidthRoundCornerLandscapeCarousel;

