"use client";

import React from "react";
import { Search } from "@mui/icons-material";
import { useMediaQuery } from "@mui/material";
import { useDispatch } from "react-redux";
import styles from "./styles/MobileSearchBox.module.css";
import { openSearchDialog } from "@/store/slices/uiSlice"; // Import openSearchDialog

export default function MobileSearchBox() {
  const dispatch = useDispatch();
  // This hook returns true on screens up to 1000px wide
  const isMobile = useMediaQuery("(max-width: 1000px)");

  // Hide component on larger screens
  if (!isMobile) return null;

  const handleSearchClick = () => {
    dispatch(openSearchDialog()); // Dispatch the openSearchDialog action
  };

  return (
    <div className={styles.searchBox}>
      <Search className={styles.searchIcon} />
      <input
        type="text"
        placeholder="Search on MaddyCustom"
        className={styles.searchInput}
        onClick={handleSearchClick}
        readOnly
      />
    </div>
  );
}

