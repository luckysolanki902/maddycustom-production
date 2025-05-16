"use client";
import React, { useEffect, useState } from "react";
import { useSpring, animated } from "react-spring";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useSelector } from "react-redux";
const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false); // For button visibility
  const [triggerAnimation, setTriggerAnimation] = useState(false); // Animation trigger
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);

  // Listen for scroll changes to control button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 500 && !isCartDrawerOpen) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isCartDrawerOpen]);

  const springProps = useSpring({
    transform: triggerAnimation ? "translateY(-40px)" : "translateY(0px)",
    config: { tension: 200, friction: 20 },
    onRest: () => setTriggerAnimation(false), // Reset animation after it's done
  });

  const scrollToTop = () => {
    setTriggerAnimation(true); // Trigger the animation
    window.scrollTo({ top: 0, behavior: "auto" }); // Instantly scroll to the top
  };

  // Hide button if not visible
if (!isVisible || isCartDrawerOpen) return null;

  return (
    <animated.div
      style={{
        ...springProps,
        position: "fixed",
        right: "2rem",
        bottom: "8rem",
        zIndex: 99999,
        cursor: "pointer",
      }}
      onClick={scrollToTop}
    >
      <div style={{backgroundColor:'white', borderRadius:'50%', width:'40px', height:'40px', display:'flex', justifyContent:'center', alignItems:'center'
        ,boxShadow:"0px 4px 4px rgba(0, 0, 0, 0.25)"
      }}>

      <KeyboardArrowUpIcon style={{ color: "black", fontSize: "2rem" }} />
      </div>
    </animated.div>
  );
};

export default ScrollToTop;
