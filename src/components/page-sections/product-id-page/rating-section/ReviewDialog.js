"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  TextField,
  Button,
  Box,
  Rating,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { styled } from "@mui/material/styles";
import { useSelector, useDispatch } from "react-redux";
import { useDropzone } from "react-dropzone";
import { setUserDetails } from "@/store/slices/orderFormSlice";
import imageCompression from "browser-image-compression";
import { ArrowBack } from "@mui/icons-material";

// A helper TabPanel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`review-tabpanel-${index}`}
      aria-labelledby={`review-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// Styled dropzone
const DropzoneBox = styled(Box)(({ theme }) => ({
  border: "2px dashed black",
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  textAlign: "center",
  cursor: "pointer",
  transition: "background-color 0.3s ease, border-color 0.3s ease",
  backgroundColor: theme.palette.background.default,
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    borderColor: "black",
  },
}));

export default function ReviewDialog({
  open,
  onClose,
  productId,
  categoryId,
  variantId,
}) {
  // Redux user details
  const reduxUserDetails = useSelector((state) => state.orderForm.userDetails);
  const initialPhone = reduxUserDetails?.phoneNumber || "";
  const userName = reduxUserDetails?.name || "";

  // Local states
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tabValue, setTabValue] = useState(0);

  // Data from check-purchase
  const [receiverName, setReceiverName] = useState("");
  const [userId, setUserId] = useState("");
  const [orderId, setOrderId] = useState(""); // <-- ADD orderId here

  // Loading states
  const [loadingVerify, setLoadingVerify] = useState(false);

  const handleTabChange = (event, newValue) => {
    if (newValue === 1 && !hasPurchased) return;
    setTabValue(newValue);
  };

  const handleCheckPurchase = async () => {
    setLoadingVerify(true);
    try {
      setErrorMessage("");
      const response = await fetch(
        `/api/checkpurchase?productId=${productId}&phoneNumber=${phoneNumber}`
      );
      const data = await response.json();

      if (response.ok && data?.hasPurchased) {
        setHasPurchased(true);
        setReceiverName(data.receiverName);
        setUserId(data.userId);
        setOrderId(data.orderId); // <-- Store orderId
        setTabValue(1);
      } else {
        setErrorMessage(data?.message || "You must purchase this product first.");
      }
    } catch (err) {
      setErrorMessage("An error occurred while verifying your purchase.");
      console.error(err);
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleClose = () => {
    setHasPurchased(false);
    setErrorMessage("");
    setTabValue(0);
    setReceiverName("");
    setUserId("");
    setOrderId("");
    onClose();
  };

  // Review Form sub-component
  const ReviewForm = ({
    productId,
    phoneNumber,
    userName,
    receiverName,
    userId,
    orderId, // <-- Accept it here
    onClose,
  }) => {
    const dispatch = useDispatch();

    const [rating, setRating] = useState(0);
    const [review, setReview] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileErrors, setFileErrors] = useState([]);
    const [submittingReview, setSubmittingReview] = useState(false);

    const { getRootProps, getInputProps } = useDropzone({
      accept: { "image/*": [] },
      multiple: false,
      maxSize: 10 * 1024 * 1024, // 10 MB
      onDrop: (files) => {
        if (files && files.length) {
          setSelectedFile(files[0]);
          setFileErrors([]);
        }
      },
      onDropRejected: (rejections) => {
        setFileErrors(rejections.map((rej) => rej.errors));
      },
    });

    const handleRemoveFile = () => {
      setSelectedFile(null);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmittingReview(true);
      try {
        let uploadedImagePath = null;

        // If there's an image, compress + S3 upload now
        if (selectedFile) {
          const compressedFile = await imageCompression(selectedFile, {
            maxSizeMB: 0.6,
            maxWidthOrHeight: 960,
            useWebWorker: true,
          });

          const folder = "reviews";
          const randomStr = Math.random().toString(36).substring(2, 10);
          const fullPath = `${folder}/${Date.now()}-${randomStr}-${selectedFile.name}`;
          const fileType = compressedFile.type;

          // Generate presigned URL
          const presignRes = await fetch("/api/aws/generate-presigned-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullPath, fileType }),
          });
          const presignData = await presignRes.json();
          if (!presignRes.ok) {
            throw new Error(presignData?.message || "Failed to get presigned URL.");
          }

          const { presignedUrl } = presignData;

          // Upload to S3
          const uploadRes = await fetch(presignedUrl, {
            method: "PUT",
            headers: { "Content-Type": fileType },
            body: compressedFile,
          });
          if (!uploadRes.ok) {
            throw new Error("Failed to upload image to S3.");
          }

          uploadedImagePath = fullPath;
        }

        // Prepare the final payload
        const finalPayload = {
          phoneNumber,
          name: userName,
          productId,
          categoryId,
          variantId,
          rating,
          comment: review,
          receiverName,
          userId,
          orderId, // <-- attach orderId
          imagePath: uploadedImagePath || null,
        };

        // POST to /api/upload-review
        const response = await fetch("/api/upload-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.message || "Failed to submit review.");
          return;
        }

        dispatch(setUserDetails({ phoneNumber }));
        alert("Review submitted successfully!");
        onClose();
      } catch (err) {
        console.error("Error submitting review:", err);
        alert(err.message || "Error submitting review.");
      } finally {
        setSubmittingReview(false);
      }
    };

    return (
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h6" align="center" sx={{ fontWeight: 600 }}>
          How was your experience?
        </Typography>

        <Box sx={{ textAlign: "center" }}>
          <Rating
            value={rating}
            onChange={(e, newValue) => setRating(newValue)}
            precision={0.5}
            size="large"
            sx={{
              "& .MuiRating-iconFilled": { color: "#00C853" },
              "& .MuiRating-iconEmpty": { color: "#00C853" },
            }}
          />
        </Box>

        <TextField
          label="Review"
          variant="outlined"
          fullWidth
          multiline
          rows={4}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&.Mui-focused fieldset": { borderColor: "#00C853" },
            },
          }}
        />

        <Typography variant="body2" align="center">
          Upload a picture (Optional)
        </Typography>

        {!selectedFile && (
          <DropzoneBox {...getRootProps()}>
            <input {...getInputProps()} />
            <UploadFileIcon fontSize="large" style={{ color: "#000" }} />
            <Typography variant="body2">
              Drag & drop your photo here, or click to select a file
            </Typography>
          </DropzoneBox>
        )}

        {selectedFile && (
          <Box
            sx={{
              mt: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              overflow: "hidden",
            }}
          >
            <Typography variant="caption" noWrap>
              {selectedFile.name}
            </Typography>
            <Button onClick={handleRemoveFile} size="small">
              Remove
            </Button>
          </Box>
        )}

        {fileErrors.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {fileErrors.map((errArr, idx) => (
              <Typography key={idx} color="error" variant="body2">
                {errArr.map((err) => err.message).join(", ")}
              </Typography>
            ))}
          </Box>
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={submittingReview}
          sx={{
            mt: 2,
            background: "linear-gradient(45deg, #00C853, #B2FF59)",
            color: "#fff",
            boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
            borderRadius: 2,
            textTransform: "none",
            "&:hover": {
              background: "linear-gradient(45deg, #00E676, #CCFF90)",
            },
          }}
        >
          {submittingReview ? "Submitting..." : "Submit Review"}
        </Button>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          padding: 2,
          boxShadow: "0px 8px 20px rgba(0, 0, 0, 0.2)",
        },
      }}
    >
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{ position: "absolute", right: 8, top: 8, color: "grey.500" }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent>
        {tabValue === 1 && (
          <IconButton
            aria-label="back"
            onClick={() => setTabValue(0)}
            sx={{ position: "absolute", left: 8, top: 8, color: "grey.500" }}
          >
            <ArrowBack />
          </IconButton>
        )}

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Please enter your phone number
            </Typography>

            <TextField
              label="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              fullWidth
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  "&.Mui-focused fieldset": { borderColor: "#00C853" },
                },
              }}
            />
            {errorMessage && (
              <Typography color="error" sx={{ mb: 2 }}>
                {errorMessage === "phoneNumber and productId are required"
                  ? "Phone number is required!"
                  : errorMessage}
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={handleCheckPurchase}
              disabled={loadingVerify}
              sx={{
                background: "linear-gradient(45deg, #00C853, #B2FF59)",
                color: "#fff",
                boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
                borderRadius: 2,
                textTransform: "none",
                padding: "0.5rem 3rem",
                "&:hover": {
                  background: "linear-gradient(45deg, #00E676, #CCFF90)",
                },
              }}
            >
              {loadingVerify ? "Verifying..." : "Verify"}
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ReviewForm
            productId={productId}
            phoneNumber={phoneNumber}
            userName={userName}
            receiverName={receiverName}
            userId={userId}
            orderId={orderId} // pass it in
            onClose={handleClose}
          />
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
}
