"use client"
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { register } from "swiper/element/bundle";
import Image from "next/image";
import { useMediaQuery } from "@mui/material";

register();

const FullWidthRoundCornerLandscapeCarousel = ({ images }) => {

    return (
        <Swiper
            style={{ height: "auto", borderRadius: "2rem" }}
            loop={true}
            speed={500}
            simulateTouch={true}
            autoplay={{ delay: 3000, disableOnInteraction: false }}
        >
            {images.map((url, index) => (
                <SwiperSlide key={index}>
                    <Image
                        priority={true}
                        unoptimized={process.env.NODE_ENV === "development"}
                        src={url}
                        alt={`carousel-image-${index}`}
                        width={1242 * 2}
                        height={547 * 2}
                        style={{ width: "100%", height: "auto", cursor: "pointer" }}
                    />
                </SwiperSlide>
            ))}
        </Swiper>
    );
};

export default FullWidthRoundCornerLandscapeCarousel;
