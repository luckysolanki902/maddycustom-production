"use client"
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { register } from "swiper/element/bundle";
import Image from "next/image";
import { useMediaQuery } from "@mui/material";

register();

const FullWidthRoundCornerLandscapeCarousel = ({ images }) => {
    console.log('images:', images);
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    return (
        <div style={{ position: 'relative' }}>
            <Swiper
                modules={[Pagination, Autoplay]}
                style={{ 
                    height: "auto", 
                    borderRadius: "0.4rem",
                    paddingBottom: isMobile ? "40px" : "50px" // Space for pagination
                }}
                loop={true}
                speed={500}
                simulateTouch={true}
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                pagination={{
                    clickable: true,
                    bulletClass: 'swiper-pagination-bullet custom-bullet',
                    bulletActiveClass: 'swiper-pagination-bullet-active custom-bullet-active',
                    renderBullet: function (index, className) {
                        return `<span class="${className}"></span>`;
                    },
                }}
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
            
            <style jsx>{`
                :global(.swiper-pagination) {
                    bottom: 25px !important;
                    text-align: center;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: ${isMobile ? '4px' : '6px'};
                }
                
                :global(.custom-bullet) {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: rgb(168, 156, 156);
                    opacity: 0.3;
                    transition: opacity 0.3s ease;
                    cursor: pointer;
                    border: none;
                    margin: 0;
                    transform: none;
                }
                
                :global(.custom-bullet:hover) {
                    opacity: 0.6;
                }
                
                :global(.custom-bullet-active) {
                    opacity: 1 !important;
                }
                
                /* Large Desktop (1440px+) */
                @media (min-width: 1440px) {
                    :global(.swiper-pagination) {
                        gap: 8px;
                        bottom: 30px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 14px;
                        height: 14px;
                    }
                }
                
                /* Desktop (1024px - 1439px) */
                @media (min-width: 1024px) and (max-width: 1439px) {
                    :global(.swiper-pagination) {
                        gap: 7px;
                        bottom: 28px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 13px;
                        height: 13px;
                    }
                }
                
                /* Laptop/Small Desktop (768px - 1023px) */
                @media (min-width: 768px) and (max-width: 1023px) {
                    :global(.swiper-pagination) {
                        gap: 6px;
                        bottom: 26px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 12px;
                        height: 12px;
                    }
                }
                
                /* Tablet (481px - 767px) */
                @media (min-width: 481px) and (max-width: 767px) {
                    :global(.swiper-pagination) {
                        gap: 5px;
                        bottom: 24px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 10px;
                        height: 10px;
                    }
                }
                
                /* Large Mobile (376px - 480px) */
                @media (min-width: 376px) and (max-width: 480px) {
                    :global(.swiper-pagination) {
                        gap: 4px;
                        bottom: 22px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 9px;
                        height: 9px;
                    }
                }
                
                /* Medium Mobile (321px - 375px) */
                @media (min-width: 321px) and (max-width: 375px) {
                    :global(.swiper-pagination) {
                        gap: 4px;
                        bottom: 20px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 8px;
                        height: 8px;
                    }
                }
                
                /* Small Mobile (up to 320px) */
                @media (max-width: 320px) {
                    :global(.swiper-pagination) {
                        gap: 3px;
                        bottom: 18px !important;
                    }
                    
                    :global(.custom-bullet) {
                        width: 7px;
                        height: 7px;
                    }
                }
            `}</style>
        </div>
    );
};

export default FullWidthRoundCornerLandscapeCarousel;
