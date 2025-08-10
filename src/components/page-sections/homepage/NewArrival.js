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

  // subtle animations - reduced complexity and made more robust
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        duration: 0.3, 
        ease: "easeOut", 
        staggerChildren: 0.03,
        delayChildren: 0.1
      } 
    },
  };
  const itemVariants = { 
    hidden: { opacity: 0, y: 8 }, 
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.25, ease: "easeOut" } 
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
        variants={itemVariants} 
        className={styles.card} 
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        layout
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
    <motion.div className={styles.card} variants={itemVariants} aria-hidden layout>
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
      viewport={{ once: true, margin: "-60px", amount: 0.1 }}
      variants={containerVariants}
    >
      <motion.h2 variants={itemVariants} className={styles.heading}>{title}</motion.h2>

      <motion.div variants={itemVariants} className={styles.carouselWrap}>
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