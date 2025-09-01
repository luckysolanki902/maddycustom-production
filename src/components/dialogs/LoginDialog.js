"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, Box, IconButton, Button, Typography, CircularProgress, alpha } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setUserDetails, setUserExists, setLoginDialogShown } from "../../store/slices/orderFormSlice";
import { sendOTP, verifyOTP, resetAuthError, decrementOtpTimer, resetOtpState } from "@/store/slices/authSlice";
import CustomSnackbar from "../notifications/CustomSnackbar";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";
import OtpInput from "../auth/OtpInput";

const LoginDialog = () => {
  const dispatch = useDispatch();
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const userExists = useSelector(state => state.orderForm.userExists);
  const loginDialogShown = useSelector(state => state.orderForm.loginDialogShown);
  const isCartDrawerOpen = useSelector(state => state.ui.isCartDrawerOpen);
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector(state => state.userBehavior);

  const { isLoading, error, otpDetails = { waitTime: 0 } } = useSelector(state => state.auth);

  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  const showSnackbar = (message, severity = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  useEffect(() => {
    let timerId;
    if (otpDetails && otpDetails.waitTime > 0) {
      timerId = setInterval(() => {
        dispatch(decrementOtpTimer());
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [dispatch, otpDetails]);

  useEffect(() => {
    if (
        timeSpentOnWebsite >= 30 &&
        scrolledMoreThan60Percent &&
        !loginDialogShown &&
        // !isUserPhoneNumberValid &&
        !userExists &&
        !isCartDrawerOpen 
        // !pathname.startsWith("/orders/myorder/")
    ) {
      setOpen(true);
      dispatch(setLoginDialogShown(true));
    }
  }, [dispatch, loginDialogShown, userExists, isCartDrawerOpen, timeSpentOnWebsite, scrolledMoreThan60Percent]);

  const handleClose = () => {
    setOpen(false);
    dispatch(setLoginDialogShown(true));
  };

  const handleSendOtp = async () => {
    if (phoneNumber.length !== 10) {
      showSnackbar("Please enter a valid 10-digit number", "error");
      return;
    }
    dispatch(resetAuthError());
    dispatch(resetOtpState());
    const result = await dispatch(sendOTP({ phoneNumber }));
    if (result.meta.requestStatus === "fulfilled") {
      setShowOtpInput(true);
      showSnackbar("OTP sent successfully", "success");
    } else {
      showSnackbar(result.payload?.message || "Failed to send OTP", "error");
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    const result = await dispatch(verifyOTP({ phoneNumber, otp: otpValue }));
    if (result.meta.requestStatus === "fulfilled") {
      handleAuthenticationSuccess(result.payload.user);
    } else {
      showSnackbar(result.payload?.message || "Invalid OTP", "error");
    }
  };

  const handleAuthenticationSuccess = useCallback(
    user => {
      dispatch(
        setUserDetails({
          name: user.name,
          phoneNumber: user.phoneNumber,
          email: user.email || "",
          userId: user.id,
        })
      );
      dispatch(setUserExists(true));
      showSnackbar("Welcome to MaddyCustom!", "success");
      setOpen(false);
    },
    [dispatch]
  );

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

          {!showOtpInput ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.2rem", width: "100%" }}>
              <input
                value={phoneNumber}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhoneNumber(value);
                }}
                type="tel"
                placeholder="Enter Mobile Number"
                style={{
                  borderRadius: "1rem",
                  border: "1px solid rgba(0,0,0,0.1)",
                  padding: "0.9rem 1.2rem",
                  fontSize: "1rem",
                  fontFamily: "Jost",
                  background: "rgba(255, 255, 255, 0.7)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                  transition: "all 0.3s",
                  color: "black"
                }}
              />

              <Button
                variant="contained"
                onClick={handleSendOtp}
                disabled={isLoading}
                sx={{
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
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : "Get OTP"}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.2rem", width: "100%" }}>
              <Typography variant="body2" align="center" sx={{ fontFamily: "Jost", fontWeight: 500 }}>
                Enter the 6-digit code sent to <strong>{phoneNumber}</strong>
              </Typography>

              <OtpInput length={6} value={otpValue} onChange={setOtpValue} disabled={isLoading} />

              {error && (
                <Typography color="error" variant="body2" align="center">
                  {error}
                </Typography>
              )}

              <Button
                variant="contained"
                onClick={handleVerifyOtp}
                disabled={otpValue.length !== 6 || isLoading}
                sx={{
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
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : "Verify & Continue"}
              </Button>

              <Button
                variant="text"
                onClick={async () => {
                  if (otpDetails?.waitTime > 0) return;
                  await dispatch(sendOTP({ phoneNumber }));
                  setOtpValue("");
                  showSnackbar("OTP resent", "info");
                }}
                disabled={otpDetails?.waitTime > 0 || isLoading}
                sx={{
                  fontFamily: "Jost",
                  textTransform: "none",
                  color: "#555",
                  "&:hover": {
                    color: "#000",
                    textDecoration: "underline",
                  },
                }}
              >
                {otpDetails?.waitTime > 0 ? `Resend OTP in ${otpDetails.waitTime}s` : "Resend OTP"}
              </Button>
            </Box>
          )}
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
