"use client";
import React, { useEffect, useState } from "react";
import { useSpring, animated } from "react-spring";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false); // For button visibility
  const [triggerAnimation, setTriggerAnimation] = useState(false); // Animation trigger

  // Listen for scroll changes to control button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.pageYOffset > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
  if (!isVisible) return null;

  return (
    <animated.div
      style={{
        ...springProps,
        position: "fixed",
        right: "2rem",
        bottom: "1rem",
        zIndex: 99999,
        cursor: "pointer",
      }}
      onClick={scrollToTop}
    >
      <KeyboardArrowUpIcon style={{ color: "gray", fontSize: "2rem" }} />
    </animated.div>
  );
};

export default ScrollToTop;
