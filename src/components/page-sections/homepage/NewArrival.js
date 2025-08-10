"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import Image from "next/image";
import Link from "next/link";
import { Jost } from "next/font/google";

import styles from "./styles/newarrival.module.css";

// Jost font to match Figma
const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default function NewArrival({ assets = [], loading = false, title = "New Arrivals" }) {
  // keep only active + componentName match
  const newArrivalAssets = useMemo(
    () => assets.filter((a) => a?.componentName === "new-arrivals" && a?.isActive),
    [assets]
  );

  // More robust animations - simplified to prevent glitches
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        duration: 0.4, 
        ease: "easeOut"
      } 
    },
  };
  
  const itemVariants = { 
    hidden: { opacity: 0, y: 10 }, 
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.4, ease: "easeOut" } 
    } 
  };

  if (!loading && !newArrivalAssets.length) return null;

  // Swiper: 2 (phone) / 3 (tablet >=768) / 4 (desktop >=1024)
  const swiperSettings = {
    modules: [Pagination],
    pagination: {
      clickable: true,
      bulletClass: "swiper-pagination-bullet custom-bullet",
      bulletActiveClass: "swiper-pagination-bullet-active custom-bullet-active",
    },
    slidesPerView: 2,
    spaceBetween: 12,
    breakpoints: {
      768: { slidesPerView: 3, spaceBetween: 16 },
      1024: { slidesPerView: 4, spaceBetween: 20 },
    },
  };

  const ProductCard = ({ asset }) => {
    const src = asset?.media?.desktop || asset?.media?.mobile || "/images/assets/placeholder-banner.jpg";

    return (
      <motion.div 
        className={styles.card} 
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Link href={asset?.link || "#"} className={styles.link} aria-label={asset?.content || "New arrival"}>
          <div className={styles.imageWrap}>
            <Image
              src={src}
              alt={asset?.content || "New Arrival"}
              width={480}
              height={480}
              sizes="(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 25vw"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              unoptimized={process.env.NODE_ENV === "development"}
            />
          </div>
          <div className={styles.content}>
            <h3 className={`${styles.title} ${styles.line2}`}>{asset?.content}</h3>
            {asset?.content2 ? <p className={`${styles.sub} ${styles.line1}`}>{asset?.content2}</p> : null}
          </div>
        </Link>
      </motion.div>
    );
  };

  const SkeletonCard = () => (
    <motion.div 
      className={styles.card} 
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`${styles.imageWrap} ${styles.skeleton}`} />
      <div className={styles.content}>
        <div className={`${styles.skTitle} ${styles.skeleton}`} />
        <div className={`${styles.skSub} ${styles.skeleton}`} />
      </div>
    </motion.div>
  );

  return (
    <motion.section
      className={`${styles.section} ${jost.className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-30px", amount: 0.15 }}
      variants={containerVariants}
    >
      <motion.h2 
        className={styles.heading}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {title}
      </motion.h2>

      <motion.div 
        className={styles.carouselWrap}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Swiper {...swiperSettings} className={styles.naSwiper}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <SwiperSlide key={`sk-${i}`}>
                  <SkeletonCard />
                </SwiperSlide>
              ))
            : newArrivalAssets.map((asset, idx) => (
                <SwiperSlide key={asset?._id || asset?.componentId || idx}>
                  <ProductCard asset={asset} />
                </SwiperSlide>
              ))}
        </Swiper>
      </motion.div>

    </motion.section>
  );
}