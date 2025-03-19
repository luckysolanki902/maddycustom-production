"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, IconButton, Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function VariantDialog({ open, onClose, imageUrl }) {
  useEffect(() => {
    // Handle the browser's Back button
    const handlePopState = (event) => {
      if (open) {
        // We only intercept the Back button when the dialog is open
        onClose();

        // Immediately push a fresh state so the user doesn't leave the current page
        // (preventing an actual navigation away).
        window.history.pushState(null, "", window.location.href);
      }
    };

    if (open) {
      // Push a dummy state when the dialog opens
      window.history.pushState(null, "", window.location.href);
    }

    window.addEventListener("popstate", handlePopState);

    // Clean up our event listener
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [open, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          backgroundColor: "transparent",
          boxShadow: "none",
          borderRadius: 0,
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          m: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box sx={{ position: "relative" }}>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              zIndex: 1,
              color: "#fff",
            }}
          >
            <CloseIcon />
          </IconButton>
          <Image
            src={imageUrl}
            alt="Popup image"
            width={800}
            height={800}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              width: "auto",
              height: "auto",
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
