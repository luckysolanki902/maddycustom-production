// File: src/components/page-sections/product-id-page/rating-section/ReviewDialog.js
"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
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
import { useSelector } from "react-redux";
import { useDropzone } from "react-dropzone";

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
export default function ReviewDialog({ open, onClose, productId }) {
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

  // New states to capture data returned from the check-purchase API
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
    console.log({ productId, phoneNumber });
    try {
      setErrorMessage("");
      const response = await fetch(
        `/api/checkpurchase?productId=${productId}&phoneNumber=${phoneNumber}`,
        {
          method: "GET",
        }
      );
      const data = await response.json();

      if (response.ok && data?.hasPurchased) {
        setHasPurchased(true);
        // Save extra data from the response to pass to the upload API
        setReceiverName(data.receiverName);
        setUserId(data.userId);
        console.log("Purchase verified – switching to review form");
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
  const ReviewForm = ({ productId, phoneNumber, userName, receiverName, userId, onClose }) => {
    const [rating, setRating] = useState(0);
    const [reviewTitle, setReviewTitle] = useState("");
    const [review, setReview] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);

    // Set up react-dropzone
    const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
      accept: {
        "image/*": [],
        "video/*": [],
      },
      onDrop: (files) => {
        setSelectedFiles(files);
      },
    });

    // Handle form submission
    const handleSubmit = async (e) => {
      e.preventDefault();

      try {
        // Prepare form data for file upload and other fields
        const formData = new FormData();
        formData.append("phoneNumber", phoneNumber);
        formData.append("name", userName);
        formData.append("productId", productId);
        formData.append("rating", rating);
        formData.append("comment", review);
        formData.append("reviewTitle", reviewTitle);

        // Append extra fields from the verified purchase response
        formData.append("receiverName", receiverName);
        formData.append("userId", userId);

        // Append files (all files are sent under the field name "images")
        selectedFiles.forEach((file) => {
          formData.append("images", file);
        });

        const response = await fetch("/api/upload-review", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Error submitting review:", data.message);
          alert(data.message || "Failed to submit review.");
          return;
        }

        console.log("Review Submitted:", data);
        alert("Review submitted successfully!");
        onClose(); // Close the dialog on success
      } catch (error) {
        console.error("Error submitting review:", error);
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
            "& .MuiRating-iconEmpty": {
              color: "green", // empty star color
              
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
          Pictures/Videos (Optional)
        </Typography>
        {/* React Dropzone area */}
        <DropzoneBox {...getRootProps()}>
          <input {...getInputProps()} />
          <UploadFileIcon fontSize="large" />
          <Typography variant="body2">
            Drag & drop some files here, or click to select files
          </Typography>
        </DropzoneBox>

        {/* Optionally list selected file names */}
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
