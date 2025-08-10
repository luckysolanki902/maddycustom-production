"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./styles/ProductCategorySlider.module.css";
import Image from "next/image";

const ProductCategorySlider = ({ position = "default" }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set client flag to prevent hydration mismatch
    setIsClient(true);
    
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 500);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Don't conditionally render until client is ready to prevent hydration mismatch
  if (!isClient) {
    return (
      <div className={styles.cardContainer} style={{ opacity: 0 }}>
        <div className={styles.cardRow}></div>
      </div>
    );
  }

  // If position is "aboveHero" and screen is 500px or below, hide this instance.
  if (position === "aboveHero" && isMobile) return null;
  // If position is "belowHero" and screen is above 500px, hide this instance.
  if (position === "belowHero" && !isMobile) return null;

  const cardData = [
    { name: "Pillar Wraps", link: "/shop/wraps/car-wraps/window-pillar-wraps/win-wraps" ,image:"/assets/icons/half_helmet.png" },
    // { name: "Key Chains", link: "/shop/accessories/minimal-personalization/keychains/realistic-functional-keychains" },
    { name: "Air Freshener", link: "/shop/accessories/car-care/car-air-freshners/hanging-bottle-car-fresheners" },
    { name: "Tank Wraps", link: "/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps" },
    { name: "Bonnet Wraps", link: "/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps" },
  ];

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardRow}>
        {cardData.map((item, index) => (
          <Link href={item.link} key={index} className={styles.cardLink}>
            <div className={ styles.card} style={{paddingLeft:item.image && 0}}>
{    item.image &&  <Image src={`${baseImageUrl}${item.image}`} alt={item.name} width={100} height={100} className={styles.cardImg} />
        }             
 <span className={styles.cardText}>{item.name}</span>

            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ProductCategorySlider;

