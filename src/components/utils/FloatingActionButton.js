"use client";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useSpring, useTransition, animated } from "react-spring";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./styles/floatingactionbar.module.css";
import Image from "next/image";
import Badge from "@mui/material/Badge";

const FloatingActionBar = () => {
  const pathname = usePathname();
  const items = useSelector((state) => state.cart.items);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

  const [firstItemAdded, setFirstItemAdded] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  useEffect(() => {
    if (totalQuantity > 0 && !firstItemAdded) setFirstItemAdded(true);
  }, [totalQuantity, firstItemAdded]);

  /* ─────────────────────────────────────────────────────────
     1.  Your existing per-button spring (kept as-is)
  ──────────────────────────────────────────────────────────*/
  const cartAnimation = useSpring({
    opacity: 1,
    transform: "translateY(0px)",
    config: { tension: 200, friction: 20 },
  });

  /* ─────────────────────────────────────────────────────────
     2.  Decide whether the bar should be shown
  ──────────────────────────────────────────────────────────*/
  const pathParts = pathname.split("/").filter(Boolean);
  const hideForProductPage = pathParts[0] === "shop" && pathParts.length === 6;

  const showBar =
    !hideForProductPage && pathname !== "/viewcart" && totalQuantity > 0;

  /* ─────────────────────────────────────────────────────────
     3.  useTransition for mount / unmount *of the whole bar*
  ──────────────────────────────────────────────────────────*/
  const transitions = useTransition(showBar, {
    from: {
      opacity: 0,
      transform: "translateY(120%) scale(0.95)",
      scale: "0.1",
    },
    enter: {
      opacity: 1,
      transform: "translateY(0%) scale(1)",
      scale: "1",
    },
    leave: {
      opacity: 0,
      transform: "translateY(120%) scale(0.95)",
      scale: "0.1",
    },
    config: { mass: 1, tension: 280, friction: 26 }, // snappy but professional
  });

  /* ─────────────────────────────────────────────────────────
     4.  Render
  ──────────────────────────────────────────────────────────*/
  return transitions(
    (style, item) =>
      item && (
        <animated.div style={style} className={styles.container}>
          <div className={styles.actionBar}>
            {/* Cart button with badge */}
            <animated.div
              style={firstItemAdded ? cartAnimation : {}}
              className={styles.iconButton}
            >
              <Link href="/viewcart" passHref>
                <div
                  className={`${styles.iconButton} ${
                    totalQuantity > 0 ? styles.cartButtonActive : ""
                  }`}
                >
                  <Badge badgeContent={totalQuantity} color="info">
                    <Image
                      src={`${baseImageUrl}/assets/icons/cart.png`}
                      className={styles.icon}
                      width={200}
                      height={200}
                      alt="Cart Icon"
                    />
                  </Badge>
                  <span>Cart</span>
                </div>
              </Link>
            </animated.div>

            {/* Divider */}
            <div className={styles.divider} />

            {/* Home button */}
            <Link href="/" passHref>
              <div
                className={`${styles.iconButton} ${
                  pathname === "/" ? styles.cartButtonActive : ""
                }`}
              >
                <Image
                  src={`${baseImageUrl}/assets/icons/roundedhome.png`}
                  className={styles.icon}
                  width={200}
                  height={200}
                  alt="Home Icon"
                />
                <span>Home</span>
              </div>
            </Link>
          </div>
        </animated.div>
      )
  );
};

export default FloatingActionBar;
