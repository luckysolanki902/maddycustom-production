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
    details: ["Unique customization", "Reflects your personality", "Tailored wrap designs"],
  },
  {
    title: "Premium Build",
    image: `${baseImageUrl}/assets/icons/maddy-premiumbuild.png`,
    details: ["High-quality materials", "Water-resistant wraps", "Long-lasting durability"],
  },
  {
    title: "Value Choice",
    image: `${baseImageUrl}/assets/icons/maddy-valuechoice.png`,
    details: ["Affordable styling option", "Cost-effective", "Stylish look on a budget"],
  },
  {
    title: "Seamless Fit",
    image: `${baseImageUrl}/assets/icons/maddy-seamlessfit.png`,
    details: ["Precision fit", "Smooth look", "Factory finish"],
  },
];

const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", when: "beforeChildren", staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
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
            whileHover={{ y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {/* Icon block (no absolute) */}
            <div className={styles.iconBlock}>
              <div className={styles.iconInner}>
                <Image
                  src={card.image}
                  alt={card.title}
                  width={112}
                  height={112}
                  style={{width: '80px', height: 'auto'}}
                  priority
                  unoptimized={process.env.NODE_ENV === "development"}
                />
              </div>
            </div>

            {/* Content block */}
            <div className={styles.contentBox}>
              <h3 className={styles.title}>{card.title}</h3>
              <ul className={styles.list}>
                {card.details.map((line, j) => (
                  <li className={styles.listItem} key={j}>
                    <svg className={styles.tick} viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                      <path d="M7.5 13.2 4.8 10.5l-1.3 1.3 4 4 9-9-1.3-1.3-7.7 7.7z" fill="currentColor" />
                    </svg>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}
