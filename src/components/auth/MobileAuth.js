"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Box, Button, Typography, CircularProgress } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setUserDetails, setUserExists } from "../../store/slices/orderFormSlice";
import { sendOTP, verifyOTP, resetAuthError, decrementOtpTimer, resetOtpState } from "@/store/slices/authSlice";
import OtpInput from "./OtpInput";

const MobileAuth = ({ 
  onSuccess,
  onError,
  onClose,
  showCloseButton = false,
  title,
  subtitle,
  buttonStyle = {},
  containerStyle = {},
  showSnackbar
}) => {
  const dispatch = useDispatch();
  
  const { isLoading, error, otpDetails = { waitTime: 0 } } = useSelector(state => state.auth);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);

  // Handle OTP timer countdown
  useEffect(() => {
    let timerId;
    if (otpDetails && otpDetails.waitTime > 0) {
      timerId = setInterval(() => {
        dispatch(decrementOtpTimer());
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [dispatch, otpDetails]);

  const handleSendOtp = async () => {
    if (phoneNumber.length !== 10) {
      const message = "Please enter a valid 10-digit number";
      if (showSnackbar) {
        showSnackbar(message, "error");
      } else if (onError) {
        onError(message);
      }
      return;
    }
    
    dispatch(resetAuthError());
    dispatch(resetOtpState());
    const result = await dispatch(sendOTP({ phoneNumber }));
    
    if (result.meta.requestStatus === "fulfilled") {
      setShowOtpInput(true);
      const message = "OTP sent successfully";
      if (showSnackbar) {
        showSnackbar(message, "success");
      }
    } else {
      const message = result.payload?.message || "Failed to send OTP";
      if (showSnackbar) {
        showSnackbar(message, "error");
      } else if (onError) {
        onError(message);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    
    const result = await dispatch(verifyOTP({ phoneNumber, otp: otpValue }));
    
    if (result.meta.requestStatus === "fulfilled") {
      handleAuthenticationSuccess(result.payload.user);
    } else {
      const message = result.payload?.message || "Invalid OTP";
      if (showSnackbar) {
        showSnackbar(message, "error");
      } else if (onError) {
        onError(message);
      }
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
      
      const message = "Welcome to MaddyCustom!";
      if (showSnackbar) {
        showSnackbar(message, "success");
      }
      
      if (onSuccess) {
        onSuccess(user);
      }
    },
    [dispatch, onSuccess, showSnackbar]
  );

  const handleResendOtp = async () => {
    if (otpDetails?.waitTime > 0) return;
    
    await dispatch(sendOTP({ phoneNumber }));
    setOtpValue("");
    const message = "OTP resent";
    if (showSnackbar) {
      showSnackbar(message, "info");
    }
  };

  // Handle Enter key for phone number input
  const handlePhoneKeyDown = (e) => {
    if (e.key === 'Enter' && phoneNumber.length === 10) {
      e.preventDefault();
      handleSendOtp();
    }
  };

  // Handle Enter key for OTP input
  const handleOtpKeyDown = (e) => {
    if (e.key === 'Enter' && otpValue.length === 6) {
      e.preventDefault();
      handleVerifyOtp();
    }
  };

  const defaultButtonStyle = {
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
    ...buttonStyle
  };

  const defaultInputStyle = {
    borderRadius: "1rem",
    border: "1px solid rgba(0,0,0,0.1)",
    padding: "0.9rem 1.2rem",
    fontSize: "1rem",
    fontFamily: "Jost",
    background: "rgba(255, 255, 255, 0.7)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
    transition: "all 0.3s",
    color: "black",
    width: "100%",
    outline: "none",
    "&:focus": {
      borderColor: "#222",
      boxShadow: "0 0 0 2px rgba(34, 34, 34, 0.1)"
    }
  };

  return (
    <Box 
      sx={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "1.2rem", 
        width: "100%",
        ...containerStyle
      }}
    >
      {title && (
        <Typography 
          variant="h6" 
          align="center" 
          sx={{ 
            fontFamily: "Jost", 
            fontWeight: 600,
            mb: 1
          }}
        >
          {title}
        </Typography>
      )}
      
      {subtitle && (
        <Typography 
          variant="body2" 
          align="center" 
          sx={{ 
            fontFamily: "Jost", 
            color: "rgba(0,0,0,0.7)",
            mb: 1
          }}
        >
          {subtitle}
        </Typography>
      )}

      {!showOtpInput ? (
        <>
          <input
            value={phoneNumber}
            onChange={e => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 10);
              setPhoneNumber(value);
            }}
            onKeyDown={handlePhoneKeyDown}
            type="tel"
            placeholder="Enter Mobile Number"
            style={defaultInputStyle}
            autoFocus
          />

          <Button
            variant="contained"
            onClick={handleSendOtp}
            disabled={isLoading || phoneNumber.length !== 10}
            sx={defaultButtonStyle}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : "Get OTP"}
          </Button>
        </>
      ) : (
        <>
          <Typography 
            variant="body2" 
            align="center" 
            sx={{ 
              fontFamily: "Jost", 
              fontWeight: 500 
            }}
          >
            Enter the 6-digit code sent to <strong>{phoneNumber}</strong>
          </Typography>

          <Box onKeyDown={handleOtpKeyDown}>
            <OtpInput 
              length={6} 
              value={otpValue} 
              onChange={setOtpValue} 
              disabled={isLoading} 
            />
          </Box>

          {error && (
            <Typography color="error" variant="body2" align="center">
              {error}
            </Typography>
          )}

          <Button
            variant="contained"
            onClick={handleVerifyOtp}
            disabled={otpValue.length !== 6 || isLoading}
            sx={defaultButtonStyle}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : "Verify & Continue"}
          </Button>

          <Button
            variant="text"
            onClick={handleResendOtp}
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

          <Button
            variant="text"
            onClick={() => {
              setShowOtpInput(false);
              setOtpValue("");
              setPhoneNumber("");
            }}
            sx={{
              fontFamily: "Jost",
              textTransform: "none",
              color: "#888",
              fontSize: "0.9rem",
              "&:hover": {
                color: "#666",
              },
            }}
          >
            Change Phone Number
          </Button>
        </>
      )}

      {showCloseButton && onClose && (
        <Button
          variant="text"
          onClick={onClose}
          sx={{
            fontFamily: "Jost",
            textTransform: "none",
            color: "#999",
            fontSize: "0.9rem",
            mt: 1,
            "&:hover": {
              color: "#666",
            },
          }}
        >
          Skip for now
        </Button>
      )}
    </Box>
  );
};

export default MobileAuth;
