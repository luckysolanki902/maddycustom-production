"use client";

import React, { useState } from "react";
import styles from "./styles/ReviewFullComp.module.css";
import { constReviews } from "./constReviews";

import { Box, Button } from "@mui/material";
import RatingsOverview from "./rating-section/RatingsOverview";

export default function ReviewFullComp() {
  // Example: average rating and total reviews
  const totalReviews = constReviews.length;
  const averageRating = constReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
    
  const starCounts = [5,4,3,2,1].map(star => ({
    star,
    count: constReviews.filter(r => r.rating === star).length,
  }));

  return (
    <div className={styles.reviewContainer}>
      {/* Overall Ratings & Star Distribution */}
      <RatingsOverview
        averageRating={averageRating}
        totalReviews={totalReviews}
        starCounts={starCounts}
      />

<Box sx={{width:'100%', display:'flex', justifyContent:'center', margin:'3rem 0'}}>
    <Button
      variant="outlined"
      sx={{
        borderColor: "black",
        fontSize:'1.1rem',
        fontFamily:'Jost',
        textTransform:'none',
        borderWidth : 2,
        padding:'0.5rem 4rem',
        color: "black",
        "&:hover": {
          borderColor: "black",
          color: "black",
        },
        "&:active": {
          borderColor: "black",
          color: "black",
        },
      }}
    >
      Write a review
    </Button>
</Box>

      




    </div>
  );
}
