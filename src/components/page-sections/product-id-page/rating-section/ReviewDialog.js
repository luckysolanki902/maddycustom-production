// File: src/components/page-sections/product-id-page/rating-section/ReviewDialog.js
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
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { styled } from "@mui/material/styles";
import { useSelector, useDispatch } from "react-redux";
import { useDropzone } from "react-dropzone";
import { setUserDetails } from "@/store/slices/orderFormSlice";
import imageCompression from "browser-image-compression";
import { ArrowBack } from "@mui/icons-material";

// ---------------- Helper Components ----------------

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

// ---------------- Styled Components ----------------

// A styled component for the dropzone area with an elevated look and black accents
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

// ---------------- Main Component ----------------

export default function ReviewDialog({
  open,
  onClose,
  productId,
  categoryId,
  variantId,
}) {
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

  const handleTabChange = (event, newValue) => {
    // Only allow switching to review form if purchase is verified
    if (newValue === 1 && !hasPurchased) {
      return;
    }
    setTabValue(newValue);
  };

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

  // ---------------- Review Form Component ----------------

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

    // For a single file upload
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileErrors, setFileErrors] = useState([]);

    const { getRootProps, getInputProps } = useDropzone({
      accept: { "image/*": [] },
      multiple: false, // Allow only one file
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
      try {
        // 1. If a file is selected, compress and upload using a presigned URL
        const uploadedImagePaths = [];
        if (selectedFile) {
          // Compress file
          const compressedFile = await imageCompression(selectedFile, {
            maxSizeMB: 0.6,
            maxWidthOrHeight: 960,
            useWebWorker: true,
          });

          // Generate a random path/filename (e.g., "reviews/1693412345-abcxyz-somefile.jpg")
          const folder = "reviews";
          const randomStr = Math.random().toString(36).substring(2, 10);
          const fullPath = `${folder}/${Date.now()}-${randomStr}-${selectedFile.name}`;
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
          images: uploadedImagePaths, // array of S3 keys (empty if no file selected)
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
      <Box
        component="form"
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
        onSubmit={handleSubmit}
      >
        <Typography variant="h6" align="center" sx={{ fontWeight: 600 }}>
          How was your experience?
        </Typography>

        <Box sx={{ textAlign: "center" }}>
          <Rating
            value={rating}
            onChange={(event, newValue) => setRating(newValue)}
            precision={0.5}
            size="large"
            sx={{
              "& .MuiRating-iconFilled": { color: "#00C853" },
              "& .MuiRating-iconEmpty": { color: "#00C853" },
            }}
          />
        </Box>

        <TextField
          label="Review Title"
          variant="outlined"
          fullWidth
          value={reviewTitle}
          onChange={(e) => setReviewTitle(e.target.value)}
          sx={{
            "& .MuiInputLabel-root": { color: "text.secondary" },
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&.Mui-focused fieldset": { borderColor: "#00C853" },
            },
          }}
        />

        <TextField
          label="Review"
          variant="outlined"
          fullWidth
          multiline
          rows={4}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          sx={{
            "& .MuiInputLabel-root": { color: "text.secondary" },
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&.Mui-focused fieldset": { borderColor: "#00C853" },
            },
          }}
        />

        <Typography variant="body2" align="center">
          Upload a picture (Optional)
        </Typography>

        {!selectedFile && <DropzoneBox {...getRootProps()}>
          <input {...getInputProps()} />
          <UploadFileIcon fontSize="large" style={{ color: "#000" }} />
          <Typography variant="body2">
            Drag &amp; drop your photo here, or click to select a file
          </Typography>
        </DropzoneBox>}

        {/* Display selected file (if any) with a remove option */}
        {selectedFile && (
          <Box
            sx={{
              mt: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              overflow: "hidden", // Hides any scrollbar if present
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
            {fileErrors.map((errors, idx) => (
              <Typography key={idx} color="error" variant="body2">
                {errors.map((err) => err.message).join(", ")}
              </Typography>
            ))}
          </Box>
        )}

        <Button
          type="submit"
          variant="contained"
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
          Submit Review
        </Button>
      </Box>
    );
  };

  // ---------------- Dialog Markup ----------------

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
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: "grey.500",
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent>
        {/* When the review form is open (tabValue === 1), show a back button */}
        {tabValue === 1 && (
          <IconButton
            aria-label="back"
            onClick={() => setTabValue(0)}
            sx={{
              position: "absolute",
              left: 8,
              top: 8,
              color: "grey.500",
            }}
          >
            <ArrowBack />
          </IconButton>
        )}

        {/* Tab Panel for Verify Purchase */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Please enter your phone number
            </Typography>
            {/* <Typography variant="body1" sx={{ mb: 2, color: "text.secondary" }}>
              Please enter your phone number to verify your purchase.
            </Typography> */}
            <TextField
              label="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              fullWidth
              sx={{
                mb: 2,
                "& .MuiInputLabel-root": { color: "text.secondary" },
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  "&.Mui-focused fieldset": { borderColor: "#00C853" },
                },
              }}
            />
            {errorMessage && (
              <Typography color="error" sx={{ mb: 2 }}>
                {errorMessage === 'phoneNumber and productId are required' ? 'Phone number is required!' : errorMessage}
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={handleCheckPurchase}
              sx={{
                background: "linear-gradient(45deg, #00C853, #B2FF59)",
                color: "#fff",
                boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
                borderRadius: 2,
                textTransform: "none",
                padding:'0.5rem 3rem',
                "&:hover": {
                  background: "linear-gradient(45deg, #00E676, #CCFF90)",
                },
              }}
            >
              Verify
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
