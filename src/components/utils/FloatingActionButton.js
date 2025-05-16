"use client";
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useSpring, useTransition, animated } from "react-spring";
import { usePathname } from "next/navigation";
import styles from "./styles/floatingactionbar.module.css";
import Image from "next/image";
import Badge from "@mui/material/Badge";
import { openCartDrawer } from "@/store/slices/uiSlice";

const FloatingActionBar = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const items = useSelector((state) => state.cart.items);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

  const [firstItemAdded, setFirstItemAdded] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  useEffect(() => {
    if (totalQuantity > 0 && !firstItemAdded) setFirstItemAdded(true);
  }, [totalQuantity, firstItemAdded]);

  // Handle cart click - open from bottom
  const handleCartClick = (e) => {
    e.preventDefault();
    dispatch(openCartDrawer({ source: "bottom" }));
  };

  // Cart animation
  const cartAnimation = useSpring({
    opacity: 1,
    transform: "translateY(0px)",
    config: { tension: 200, friction: 20 },
  });

  // Determine whether to show the bar
  const pathParts = pathname.split("/").filter(Boolean);
  const hideForProductPage = pathParts[0] === "shop" && pathParts.length === 6;
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);

  const showBar = !hideForProductPage && !isCartDrawerOpen && totalQuantity > 0;

  // Faster, cleaner transitions
  const transitions = useTransition(showBar, {
    from: {
      opacity: 0,
      transform: "translateY(100%)",
    },
    enter: {
      opacity: 1,
      transform: "translateY(0%)",
    },
    leave: {
      opacity: 0,
      transform: "translateY(100%)",
    },
    config: { mass: 0.8, tension: 400, friction: 30 }, // faster with minimal bounce
  });

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
              <div
                onClick={handleCartClick}
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
            </animated.div>

            {/* Divider */}
            <div className={styles.divider} />

            {/* Home button */}
            <a href="/">
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
            </a>
          </div>
        </animated.div>
      )
  );
};

export default FloatingActionBar;
