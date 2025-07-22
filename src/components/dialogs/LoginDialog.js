"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, Box, IconButton, alpha } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setLoginDialogShown } from "../../store/slices/orderFormSlice";
import CustomSnackbar from "../notifications/CustomSnackbar";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";
import MobileAuth from "../auth/MobileAuth";
import { usePathname } from "next/navigation";

const LoginDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const userExists = useSelector(state => state.orderForm.userExists);
  const loginDialogShown = useSelector(state => state.orderForm.loginDialogShown);
  const isCartDrawerOpen = useSelector(state => state.ui.isCartDrawerOpen);
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector(state => state.userBehavior);
  const isUserPhoneNumberValid = useSelector(state => state.orderForm.userDetails?.phoneNumber?.length === 10);

  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  const showSnackbar = (message, severity = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Show dialog based on user behavior conditions
  useEffect(() => {
    if (
        timeSpentOnWebsite >= 30 &&
        scrolledMoreThan60Percent &&
        !loginDialogShown &&
        !isUserPhoneNumberValid &&
        !userExists &&
        !isCartDrawerOpen &&
        !pathname.startsWith("/orders/myorder/")
    ) {
      setOpen(true);
      dispatch(setLoginDialogShown(true));
    }
  }, [dispatch, loginDialogShown, userExists, isCartDrawerOpen, timeSpentOnWebsite, scrolledMoreThan60Percent, isUserPhoneNumberValid, pathname]);

  const handleClose = () => {
    setOpen(false);
    dispatch(setLoginDialogShown(true));
  };

  const handleAuthSuccess = (user) => {
    setOpen(false);
  };

  const handleAuthError = (message) => {
    showSnackbar(message, "error");
  };

  // Don't render if cart drawer is open
  if (isCartDrawerOpen) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown") {
            return;
          }
          handleClose();
        }}
        disableEscapeKeyDown
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: "1.5rem",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            overflow: "hidden",
          },
        }}
      >
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            p: 3,
          }}
        >
          <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              aria-label="close"
              onClick={handleClose}
              sx={{
                color: theme => theme.palette.grey[700],
                backdropFilter: "blur(8px)",
                border: `1px solid ${alpha("#ccc", 0.3)}`,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Image
            src={`${imageBaseUrl}/assets/logos/maddy_custom3_main_logo.png`}
            alt="Maddy Logo"
            title="Maddy Logo"
            width={120}
            height={50}
            style={{ marginBottom: "1.5rem" }}
          />

          <MobileAuth
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            onClose={handleClose}
            showCloseButton={true}
            showSnackbar={showSnackbar}
            title="Welcome Back!"
            subtitle="Sign in to access your personalized experience"
            containerStyle={{ 
              width: "100%", 
              maxWidth: "400px" 
            }}
            buttonStyle={{
              borderRadius: "2rem",
              py: 1.2,
              fontWeight: 600,
              textTransform: "none",
              background: "#222",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
              "&:hover": {
                background: "#000",
              },
            }}
          />
        </DialogContent>
      </Dialog>

      <CustomSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        handleClose={() => setSnackbarOpen(false)}
      />
    </>
  );
};

export default LoginDialog;
