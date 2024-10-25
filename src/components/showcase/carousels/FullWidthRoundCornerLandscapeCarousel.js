// @/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel.js
// Currently being used in the top of homepage as the main carousel
"use client"
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { register } from 'swiper/element/bundle';
import Image from 'next/image';
register();

const FullWidthRoundCornerLandscapeCarousel = ({ images }) => {
    return (
        <>
            <Swiper style={{ height: 'auto', borderRadius: '2rem' }}
                loop={true} speed={500} simulateTouch={true} autoplay={{ delay: 3000, disableOnInteraction: false }} >
                {images.map((url, index) => (
                    <SwiperSlide key={index}>
                        <Image
                            priority={true}
                            src={url}
                            alt={`carousel-image-${index}`}
                            width={1242 * 2}
                            height={547 * 2}
                            style={{ width: '100%', height: 'auto', cursor: 'pointer' }}
                        />
                    </SwiperSlide>
                ))}
            </Swiper>
        </>
    )
}

export default FullWidthRoundCornerLandscapeCarousel;
