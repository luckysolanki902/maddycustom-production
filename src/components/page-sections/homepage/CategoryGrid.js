"use client";

import { useEffect, useMemo, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import styles from "./styles/category-grid.module.css";

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

export default function CategoryGrid({
    assets = [],
    loading = false,
    title = "Shop by Category",
    b2bMode = false,
    b2bPrefix = '/b2b'
}) {
    // Keep only active + this component
    const data = useMemo(
        () =>
            assets.filter(
                (a) => a?.isActive && (a?.componentName === "category-grid" || a?.componentName === "category-slider")
            ),
        [assets]
    );

    // Animation variants - minimal and smooth
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { 
            opacity: 1, 
            transition: { 
                duration: 0.3, 
                ease: "easeOut",
                delayChildren: 0.1
            } 
        },
    };
    const itemVariants = { 
        hidden: { opacity: 0, y: 6 }, 
        visible: { 
            opacity: 1, 
            y: 0, 
            transition: { duration: 0.25, ease: "easeOut" } 
        } 
    };

    // Items per slide by viewport: 4 / 6 / 8
    const calcItemsPerSlide = () => {
        if (typeof window === "undefined") return 8; // SSR-safe default
        const w = window.innerWidth;
        if (w < 768) return 4;            // 2x2
        if (w < 1024) return 6;           // 3x2
        return 8;                         // 4x2
    };

    const [ips, setIps] = useState(calcItemsPerSlide);
    useEffect(() => {
        const onR = () => setIps(calcItemsPerSlide());
        onR();
        window.addEventListener("resize", onR);
        return () => window.removeEventListener("resize", onR);
    }, []);

    // Slides: chunk by current ips
    const slides = useMemo(() => {
        const base = loading ? Array.from({ length: ips }) : data;
        const ch = chunk(base, ips);
        return ch.length ? ch : [Array.from({ length: ips })];
    }, [data, loading, ips]);

    // how many full slides do we have right now?
    const pageCount = Math.ceil((!loading ? data.length : 0) / ips);
    // show dots only after load, and only if more than one page
    const showPagination = !loading && pageCount > 1;
    // Render card (skeleton if loading/empty slot)
    const Card = ({ item }) => {
        if (loading || !item) {
            return (
                <motion.div 
                    className={`${styles.card} ${styles.skeleton}`} 
                    variants={itemVariants}
                    aria-hidden 
                    layout
                />
            );
        }
        const src =
            item?.media?.desktop ||
            item?.media?.mobile ||
            "/images/assets/placeholder-banner.jpg";
        // In b2b mode force link to b2b path (strip existing /shop prefix if present)
        let linkHref = item?.link || '#';
        if (b2bMode) {
            const toB2BLink = (raw) => {
                if (!raw) return '#';
                let pathname = raw;
                let search = '';
                let hash = '';
                try {
                    if (/^https?:\/\//i.test(raw)) {
                        const u = new URL(raw);
                        pathname = u.pathname || '/';
                        search = u.search || '';
                        hash = u.hash || '';
                    } else {
                        // extract search/hash if present in raw relative link
                        const idxQ = raw.indexOf('?');
                        const idxH = raw.indexOf('#');
                        const cut = (i) => (i !== -1 ? raw.slice(i) : '');
                        // Determine earliest special char
                        const specials = [idxQ, idxH].filter(i => i !== -1).sort((a,b)=>a-b);
                        if (specials.length) {
                            pathname = raw.slice(0, specials[0]);
                            if (idxQ !== -1) search = raw.slice(idxQ, idxH !== -1 && idxH > idxQ ? idxH : undefined);
                            if (idxH !== -1) hash = raw.slice(idxH);
                        }
                    }
                } catch (e) {
                    // fallback keep raw
                    pathname = raw;
                }
                // Normalize multiple leading slashes
                pathname = pathname.replace(/\/+/g,'/');
                if (pathname.startsWith('/b2b/')) return pathname + search + hash;
                if (pathname === '/b2b') return pathname + search + hash;
                if (pathname.startsWith('/shop')) {
                    return pathname.replace(/^\/shop/, b2bPrefix) + search + hash;
                }
                // already absolute but not shop: prefix
                return `${b2bPrefix}${pathname.startsWith('/') ? '' : '/'}${pathname}` + search + hash;
            };
            linkHref = toB2BLink(linkHref);
        }
        return (
            <motion.div
                variants={itemVariants}
                whileHover={{ y: -1, transition: { duration: 0.15 } }}
                layout
            >
                <Link href={linkHref} className={styles.card} aria-label={item?.content || "Category"}>
                    <div className={styles.imgWrap}>
                        <Image
                            src={src}
                            alt={item?.content || "Category"}
                            fill
                            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                            style={{ objectFit: "cover" }}
                            unoptimized={process.env.NODE_ENV === "development"}
                        />
                    </div>
                    <div className={styles.meta}>
                        <h3 className={`${styles.title} ${styles.line2}`}>{item?.content || "\u00A0"}</h3>
                    </div>
                </Link>
            </motion.div>
        );
    };

    if (!loading && data.length === 0) return null;

    return (
        <motion.section 
            className={styles.section}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px", amount: 0.1 }}
            variants={containerVariants}
        >
            <motion.h2 variants={itemVariants} className={styles.heading}>{title}</motion.h2>

            <motion.div variants={itemVariants}>
                <Swiper
                    modules={[Pagination]}
                    slidesPerView={1}
                    spaceBetween={12} // base mobile gap
                    breakpoints={{
                        768: { spaceBetween: 14 }, // tablet gap
                        1024: { spaceBetween: 16 }, // desktop gap
                    }}
                    pagination={
                        showPagination
                            ? {
                                clickable: true,
                                bulletClass: "swiper-pagination-bullet custom-bullet",
                                bulletActiveClass: "swiper-pagination-bullet-active custom-bullet-active",
                            }
                            : false
                    }
                    className={styles.swiper}
                >
                    {slides.map((group, i) => (
                        <SwiperSlide key={`s-${i}`}>
                            <motion.div 
                                className={styles.grid}
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {group.map((item, j) => (
                                    <Card key={item?._id || item?.componentId || `k-${i}-${j}`} item={item} />
                                ))}
                            </motion.div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </motion.div>
        </motion.section>
    );
}
