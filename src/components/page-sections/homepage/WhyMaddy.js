"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import styles from "./styles/WhyMaddy.module.css";

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || "/images";

const cardData = [
  {
    title: "Personal Touch",
    image: `${baseImageUrl}/assets/icons/maddy-premiumtouch.png`,
    details: [
      "Unique customization",
      "Reflects your style",
      // "Tailored wrap designs"
    ],
  },
  {
    title: "Premium Build",
    image: `${baseImageUrl}/assets/icons/maddy-premiumbuild.png`,
    details: [
      "Superior quality",
      "Water-resistant",
      // "Long-lasting durability"
    ],
  },
  {
    title: "Value Choice",
    image: `${baseImageUrl}/assets/icons/maddy-valuechoice.png`,
    details: [
      "Budget friendly",
      "Cost-effective",
      // "Stylish look on a budget"
    ],
  },
  {
    title: "Seamless Fit",
    image: `${baseImageUrl}/assets/icons/maddy-seamlessfit.png`,
    details: [
      "Precision fit",
      "Factory finish",
      // "Factory finish"
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
      when: "beforeChildren",
      staggerChildren: 0.08
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
};

const iconVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
      delay: 0.2
    }
  },
};

const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
};

export default function WhyMaddy() {
  return (
    <motion.section
      className={styles.container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-120px" }}
      variants={containerVariants}
    >
      <div className={styles.headWrap}>
        <motion.h2 className={styles.heading} variants={cardVariants}>
          Why Maddy Custom?
        </motion.h2>
        <motion.p className={styles.subhead} variants={cardVariants}>
          Premium quality, tailored to you — look sharp, last long, feel factory-fit.
        </motion.p>
        <motion.div className={styles.accentBar} variants={cardVariants} />
      </div>

      <div className={styles.cardRow}>
        {cardData.map((card, i) => (
          <motion.article
            key={i}
            className={styles.card}
            variants={cardVariants}
            whileHover={{
              y: -8,
              scale: 1.02,
              transition: { duration: 0.3, ease: "easeOut" }
            }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Icon block (no absolute) */}
            <div className={styles.iconBlock}>
              <motion.div
                className={styles.iconInner}
                variants={iconVariants}
                whileHover={{
                  scale: 1.05,
                  rotate: 5,
                  transition: { duration: 0.3 }
                }}
              >
                <Image
                  src={card.image}
                  alt={card.title}
                  width={112}
                  height={112}
                  style={{ width: '80px', height: 'auto' }}
                  priority
                  unoptimized={process.env.NODE_ENV === "development"}
                />
              </motion.div>
            </div>

            {/* Content block */}
            <div className={styles.contentBox}>
              <motion.h3
                className={styles.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                {card.title}
              </motion.h3>
              <motion.ul
                className={styles.list}
                initial="hidden"
                whileInView="visible"
                variants={{
                  visible: {
                    transition: { staggerChildren: 0.08, delayChildren: 0.4 }
                  }
                }}
              >
                {card.details.map((line, j) => (
                  <motion.li
                    className={styles.listItem}
                    key={j}
                    variants={listItemVariants}
                    whileHover={{
                      x: 4,
                      transition: { duration: 0.2 }
                    }}
                  >
                    <div className={styles.tick}>
                      <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden>
                        <path d="M7.5 13.2 4.8 10.5l-1.3 1.3 4 4 9-9-1.3-1.3-7.7 7.7z" fill="currentColor" />
                      </svg>
                    </div>
                    <span style={{lineHeight: 1.2, fontSize: '0.75rem', fontWeight: 400}}>{line}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}
