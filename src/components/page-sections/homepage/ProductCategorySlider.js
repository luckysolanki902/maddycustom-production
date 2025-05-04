"use client";

import React from "react";
import Link from "next/link";
import { useMediaQuery } from "@mui/material";
import styles from "./styles/ProductCategorySlider.module.css";
import Image from "next/image";
const ProductCategorySlider = ({ position = "default" }) => {
  // Use 1000px as the breakpoint.
  const isMobile = useMediaQuery("(max-width: 1000px)");
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  // If position is "aboveHero" and screen is 1000px or below, hide this instance.
  if (position === "aboveHero" && isMobile) return null;
  // If position is "belowHero" and screen is above 1000px, hide this instance.
  if (position === "belowHero" && !isMobile) return null;

  const cardData = [
    { name: "Wraps", link: "/shop/wraps/car-wraps/window-pillar-wraps/win-wraps" ,image:"/assets/icons/half_helmet.png" },
    { name: "Key Chains", link: "/shop/accessories/minimal-personalization/keychains/realistic-functional-keychains" },
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

