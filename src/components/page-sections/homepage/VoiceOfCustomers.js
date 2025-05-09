"use client";

import React from "react";
import Image from "next/image";
import styles from "./styles/VoiceOfCustomers.module.css";
import InstagramIcon from "@mui/icons-material/Instagram";
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';

const testimonials = [
  {
    handle: "@janmejay484",
    avatar: "/assets/icons/instagram-demo-pic.png",
    comment: "Maddycustom made my ride perfectly unique ",
  },
  {
    handle: "@Priya",
    avatar: "/assets/icons/instagram-demo-pic.png",
    comment: "Love the quality and fit of my new wrap!",
  },
  {
    handle: "@Rahul",
    avatar: "/assets/icons/instagram-demo-pic.png",
    comment: "Fast shipping and top-notch customer service.",
  },
  {
    handle: "@Rahul",
    avatar: "/assets/icons/instagram-demo-pic.png",
    comment: "Fast shipping and top-notch customer service.",
  },
  {
    handle: "@Rahul",
    avatar: "/assets/icons/instagram-demo-pic.png",
    comment: "Fast shipping and top-notch customer service.",
  },
  {
    handle: "@Rahul",
    avatar: "/assets/icons/instagram-demo-pic.png",
    comment: "Fast shipping and top-notch customer service.",
  },

];

export default function VoiceOfOurCustomers() {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>The Voice Of Our Customers</h2>
      <div className={styles.cardRow}>
        {testimonials.map((t, i) => {
          // strip leading '@' for the URL
          const instaUser = t.handle.replace(/^@/, "");

          return (
            <div className={styles.card} key={i}>
              <div className={styles.iconRow}>
                <InstagramIcon
                  className={styles.instagramIcon}
                  fontSize="large"
                />
                <a
                  href={`https://instagram.com/${instaUser}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.handle}
                >
                  {t.handle}
                </a>
              </div>

              <div className={styles.avatar}>
                <Image
                  src={`${baseImageUrl}${t.avatar}`}
                  alt={t.handle}
                  width={80}
                  height={80}
                  className={styles.avatarImg}
                />
              </div>
              <h2 className={styles.CompanyName}>Maddy Custom</h2>
              <p className={styles.comment}>{t.comment}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
