// File: src/components/page-sections/product-id-page/rating-section/ReviewDialog.js
"use client";

import React, { useEffect, useState } from "react";
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
// --- IMPORT IMAGE COMPRESSION ---
import imageCompression from "browser-image-compression";

// A helper TabPanel component (per MUI docs)
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

function a11yProps(index) {
  return {
    id: `review-tab-${index}`,
    "aria-controls": `review-tabpanel-${index}`,
  };
}

// A styled component for the dropzone area
const DropzoneBox = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.primary.main}`,
  borderRadius: "8px",
  padding: theme.spacing(2),
  textAlign: "center",
  cursor: "pointer",
  transition: "background-color 0.3s ease",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

// The combined component
export default function ReviewDialog({ open, onClose, productId, categoryId, variantId }) {
  // Grab phone number and name from Redux (order form details)
  const reduxUserDetails = useSelector((state) => state.orderForm.userDetails);
  const initialPhone = reduxUserDetails?.phoneNumber || "";
  const userName = reduxUserDetails?.name || "";

  // Local state for purchase verification
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Tab state: 0 = Verify Purchase, 1 = Write a Review
  const [tabValue, setTabValue] = useState(0);

  // Data returned from the check-purchase API
  const [receiverName, setReceiverName] = useState("");
  const [userId, setUserId] = useState("");

  // Handle tab change (only allow switching to review form if verified)
  const handleTabChange = (event, newValue) => {
    if (newValue === 1 && !hasPurchased) {
      return;
    }
    setTabValue(newValue);
  };

  // Check purchase when user clicks the button
  const handleCheckPurchase = async () => {
    try {
      setErrorMessage("");
      const response = await fetch(
        `/api/checkpurchase?productId=${productId}&phoneNumber=${phoneNumber}`
      );
      const data = await response.json();

      if (response.ok && data?.hasPurchased) {
        setHasPurchased(true);
        // Save extra data from the response to pass to the upload API
        setReceiverName(data.receiverName);
        setUserId(data.userId);
        setTabValue(1);
      } else {
        setErrorMessage(data?.message || "You must purchase this product first.");
      }
    } catch (err) {
      setErrorMessage("An error occurred while verifying your purchase.");
      console.error(err);
    }
  };

  const handleClose = () => {
    // Reset states when closing the dialog
    setHasPurchased(false);
    setErrorMessage("");
    setTabValue(0);
    onClose();
  };

  // The review form component with react-dropzone integration
  const ReviewForm = ({
    productId,
    phoneNumber,
    userName,
    receiverName,
    userId,
    onClose,
  }) => {
    const dispatch = useDispatch();

    const [rating, setRating] = useState(0);
    const [reviewTitle, setReviewTitle] = useState("");
    const [review, setReview] = useState("");

    // Files the user selected (no immediate upload)
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [fileErrors, setFileErrors] = useState([]);

    const {
      getRootProps,
      getInputProps,
      fileRejections,
    } = useDropzone({
      accept: { "image/*": [] },
      multiple: true,
      maxSize: 10 * 1024 * 1024, // 10 MB
      onDrop: (files) => {
        setSelectedFiles((prev) => [...prev, ...files]);
        setFileErrors([]);
      },
      onDropRejected: (rejections) => {
        setFileErrors(rejections.map((rej) => rej.errors));
      },
    });

    // Handle form submission -> compress & upload, then send data
    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        // 1. For each file, compress and upload using a presigned URL
        const uploadedImagePaths = [];
        for (const file of selectedFiles) {
          // Compress file
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 0.6,
            maxWidthOrHeight: 1920/2,
            useWebWorker: true,
          });

          // Generate a random path/filename
          // e.g. "reviews/1693412345-abcxyz-somefile.jpg"
          const folder = "reviews";
          const randomStr = Math.random().toString(36).substring(2, 10);
          const fullPath = `${folder}/${Date.now()}-${randomStr}-${file.name}`;
          const fileType = compressedFile.type;

          // Request a presigned URL from your API
          const presignRes = await fetch("/api/aws/generate-presigned-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullPath, fileType }),
          });
          const presignData = await presignRes.json();
          if (!presignRes.ok) {
            console.error("Error generating presigned URL:", presignData?.message);
            throw new Error(presignData?.message || "Failed to get presigned URL.");
          }

          const { presignedUrl } = presignData;

          // Upload the compressed file to S3
          const uploadRes = await fetch(presignedUrl, {
            method: "PUT",
            headers: { "Content-Type": fileType },
            body: compressedFile,
          });
          if (!uploadRes.ok) {
            console.error("Error uploading to S3");
            throw new Error("Failed to upload image to S3.");
          }

          // If successful, push the S3 key (fullPath) or final URL
          uploadedImagePaths.push(fullPath);
        }

        // 2. Send the rest of the review data + array of image paths to your API
        // (Here we use JSON, but if you need multipart/form-data, adapt accordingly)
        const finalPayload = {
          phoneNumber,
          name: userName,
          productId,
          categoryId,
          variantId,
          rating,
          comment: review,
          reviewTitle,
          receiverName,
          userId,
          images: uploadedImagePaths, // array of S3 keys
        };

        const response = await fetch("/api/upload-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        });
        const data = await response.json();

        if (!response.ok) {
          console.error("Error submitting review:", data.message);
          alert(data.message || "Failed to submit review.");
          return;
        }

        // Store phoneNumber back to Redux for convenience
        dispatch(setUserDetails({ phoneNumber }));

        alert("Review submitted successfully!");
        onClose(); // Close the dialog on success
      } catch (error) {
        console.error("Error submitting review:", error);
        alert(error.message || "Error submitting review.");
      }
    };

    return (
      <Box component="form" sx={{ mt: 2 }} onSubmit={handleSubmit}>
        <Typography variant="body1" align="center" gutterBottom>
          Rating
        </Typography>
        <Rating
          value={rating}
          onChange={(event, newValue) => setRating(newValue)}
          precision={0.5}
          size="large"
          sx={{
            "& .MuiRating-iconFilled": {
              color: "green", // Filled star color
            },
            "& .MuiRating-iconEmpty": {
              color: "green", // Empty star color
            },
          }}
        />

        <TextField
          label="Review Title"
          variant="outlined"
          fullWidth
          value={reviewTitle}
          onChange={(e) => setReviewTitle(e.target.value)}
          sx={{ my: 2 }}
        />

        <TextField
          label="Review"
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" sx={{ mb: 1 }}>
          {receiverName}
        </Typography>

        <Typography variant="body2" sx={{ mb: 1 }}>
          Picture (Optional)
        </Typography>

        {/* React Dropzone area */}
        <DropzoneBox {...getRootProps()}>
          <input {...getInputProps()} />
          <UploadFileIcon fontSize="large" />
          <Typography variant="body2">
            Drag &amp; drop your photo(s) here, or click to select file(s)
          </Typography>
        </DropzoneBox>

        {/* List chosen files */}
        {selectedFiles.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption">Files:</Typography>
            <ul>
              {selectedFiles.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          </Box>
        )}

        {/* Display file errors if any */}
        {fileErrors.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {fileErrors.map((errors, idx) => (
              <Typography key={idx} color="error" variant="body2">
                {errors.map((err) => err.message).join(", ")}
              </Typography>
            ))}
          </Box>
        )}

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Button
            type="submit"
            variant="contained"
            sx={{
              backgroundColor: "gray",
              "&:hover": {
                backgroundColor: "darkgray",
              },
            }}
          >
            Submit
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500],
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent dividers>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          {tabValue === 0 ? (
            <Typography variant="body1" gutterBottom>
              Verify your number
            </Typography>
          ) : (
            <Typography variant="body1" gutterBottom>
              Write a Review
            </Typography>
          )}
        </Box>

        {/* Tab Panel for Verify Purchase */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              Enter your phone number to verify purchase:
            </Typography>
            <TextField
              label="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            {errorMessage && (
              <Typography color="error" sx={{ mb: 2 }}>
                {errorMessage}
              </Typography>
            )}
            <Button variant="contained" onClick={handleCheckPurchase}>
              Check Purchase
            </Button>
          </Box>
        </TabPanel>

        {/* Tab Panel for Write a Review */}
        <TabPanel value={tabValue} index={1}>
          <ReviewForm
            productId={productId}
            phoneNumber={phoneNumber}
            userName={userName}
            receiverName={receiverName}
            userId={userId}
            onClose={handleClose}
          />
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
}
