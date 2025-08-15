"use client"
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { register } from "swiper/element/bundle";
import Image from "next/image";
import Link from "next/link";
import { useMediaQuery } from "@mui/material";

register();

const FullWidthRoundCornerLandscapeCarousel = ({ 
  images, // Legacy prop - array of image URLs
  slides   // New prop - array of objects with { url, link, alt }
}) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    // Process data - support both legacy images prop and new slides prop
    const carouselData = slides || (images ? images.map((url, index) => ({ 
      url, 
      link: null, 
      alt: `carousel-image-${index}` 
    })) : []);

    const SlideContent = ({ slide, index }) => (
      <Image
        priority={index === 0} // Only prioritize first image
        unoptimized={process.env.NODE_ENV === "development"}
        src={slide.url}
        alt={slide.alt || `carousel-image-${index}`}
        width={1242 * 2}
        height={547 * 2}
        style={{ width: "100%", height: "auto", cursor: slide.link ? "pointer" : "default" }}
      />
    );
    
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
                    bulletClass: 'swiper-pagination-bullet custom-bullet hero-bullet',
                    bulletActiveClass: 'swiper-pagination-bullet-active custom-bullet-active hero-bullet-active',
                    renderBullet: function (index, className) {
                        return `<span class="${className}"></span>`;
                    },
                }}
                className="hero-swiper"
            >
                {carouselData.map((slide, index) => (
                    <SwiperSlide key={index}>
                        {slide.link ? (
                            <Link href={slide.link} style={{ display: 'block', width: '100%' }}>
                                <SlideContent slide={slide} index={index} />
                            </Link>
                        ) : (
                            <SlideContent slide={slide} index={index} />
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
            
            <style jsx>{`
                :global(.hero-swiper .swiper-pagination) {
                    bottom: 25px !important;
                    text-align: center;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: ${isMobile ? '4px' : '6px'};
                }
                
                :global(.hero-swiper .hero-bullet) {
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
                
                :global(.hero-swiper .hero-bullet:hover) {
                    opacity: 0.6;
                }
                
                :global(.hero-swiper .hero-bullet-active) {
                    opacity: 1 !important;
                }
                
                /* Large Desktop (1440px+) */
                @media (min-width: 1440px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 8px;
                        bottom: 30px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 14px;
                        height: 14px;
                    }
                }
                
                /* Desktop (1024px - 1439px) */
                @media (min-width: 1024px) and (max-width: 1439px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 7px;
                        bottom: 28px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 13px;
                        height: 13px;
                    }
                }
                
                /* Laptop/Small Desktop (768px - 1023px) */
                @media (min-width: 768px) and (max-width: 1023px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 6px;
                        bottom: 26px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 12px;
                        height: 12px;
                    }
                }
                
                /* Tablet (481px - 767px) */
                @media (min-width: 481px) and (max-width: 767px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 5px;
                        bottom: 24px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 10px;
                        height: 10px;
                    }
                }
                
                /* Large Mobile (376px - 480px) */
                @media (min-width: 376px) and (max-width: 480px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 4px;
                        bottom: 22px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 9px;
                        height: 9px;
                    }
                }
                
                /* Medium Mobile (321px - 375px) */
                @media (min-width: 321px) and (max-width: 375px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 4px;
                        bottom: 20px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 8px;
                        height: 8px;
                    }
                }
                
                /* Small Mobile (up to 320px) */
                @media (max-width: 320px) {
                    :global(.hero-swiper .swiper-pagination) {
                        gap: 3px;
                        bottom: 18px !important;
                    }
                    
                    :global(.hero-swiper .hero-bullet) {
                        width: 7px;
                        height: 7px;
                    }
                }
            `}</style>
        </div>
    );
};

export default FullWidthRoundCornerLandscapeCarousel;
