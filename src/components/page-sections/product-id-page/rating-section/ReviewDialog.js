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
import { useSelector, useDispatch } from "react-redux";
import { useDropzone } from "react-dropzone";
import { green } from "@mui/material/colors";
import { setUserDetails } from "@/store/slices/orderFormSlice";

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
    const [fileErrors, setFileErrors] = useState([]);
    const dispatch = useDispatch();

    const {
      getRootProps,
      getInputProps,
      acceptedFiles,
      fileRejections, // Contains files that were rejected (e.g., due to size)
    } = useDropzone({
      accept: {
        'image/*': [],
      },
      maxSize: 10 * 1024 * 1024, // 10 MB in bytes
      onDrop: (files) => {
        setSelectedFiles(files);
        setFileErrors([]); // Reset any previous errors
      },
      onDropRejected: (rejections) => {
        // Handle rejected files (e.g., due to exceeding maxSize)
        setFileErrors(rejections.map(rejection => rejection.errors));
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
        formData.append("categoryId", categoryId);
        formData.append("variantId", variantId);
        formData.append("rating", rating);
        formData.append("comment", review);
        formData.append("reviewTitle", reviewTitle);

        // Append extra fields from the verified purchase response
        formData.append("receiverName", receiverName);
        formData.append("userId", userId);


        // generate presigned url can be done this way but i dont this is esfficeint  
        // Image Upload Handlers

        // const fileName = `${Date.now()}-${file.name}`;
        //     const fullPath = `reviews/${Date.now()}-${file.name}`;
        //     const fileType = file.type;
        // // app/api/aws/generate-presigned-url/route.js
        //     try {
        //       // Request presigned URL from the backend
        //       const res = await fetch('/api/aws/generate-presigned-url', {
        //         method: 'POST',
        //         headers: {
        //           'Content-Type': 'application/json',
        //         },
        //         body: JSON.stringify({ fullPath, fileType }),
        //       });
        //       if (!res.ok) {
        //         const errorData = await res.json();
        //         throw new Error(errorData.message || 'Failed to get presigned URL.');
        //       }

        //       const { presignedUrl } = await res.json();
        //      const url = fullPath; // Use the full path as the image URL
        //       // Upload the file directly to S3 using the presigned URL
        //       const uploadRes = await fetch(presignedUrl, {
        //         method: 'PUT',
        //         headers: {
        //           'Content-Type': fileType,
        //         },
        //         body: file,
        //       });

        //       if (!uploadRes.ok) {
        //         throw new Error('Failed to upload image to S3.');
        //       }

        //       // Update the currentReview's images array with the new image URL
        //       setCurrentReview((prev) => ({
        //         ...prev,
        //         images: [...prev.images, url],
        //       }));
        //     } catch (error) {
        //       console.error('Error uploading image:', error);
        //       setUploadError(error.message);
        //     } finally {
        //       setUploading(false);
        //     }
        //   }, []);

        const fullPath = `${folder}/${Array(10)
          .fill('')
          .map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
          .join('')}${Math.floor(Math.random() * 10)}`;

        const fileType = file.type;

        const preSignedImageUploaderResponse = await fetch("/api/aws/generate-presigned-url", {
          method: "POST",
          body: {
            fullPath,
            fileType
          },
        });

        const preSignedUrldata = await preSignedImageUploaderResponse.json();

        if (!preSignedImageUploaderResponse.ok) {
          console.error("Error generating presigned URL:", data.message); 
          return;
        }

        const { presignedUrl, url } = preSignedUrldata;

        // Upload the file directly to S3 using the presigned URL
        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": fileType,
          },
          body: file,
        });

        if (!uploadResponse.ok) { 
          console.error("Error uploading image to S3:", data.message);
          return;
        }

        const response = await fetch("/api/upload-review", {
          method: "POST",
          body: {...formData, imagePath: fullPath},
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Error submitting review:", data.message);
          alert(data.message || "Failed to submit review.");
          return;
        }
        dispatch(setUserDetails({ phoneNumber: phoneNumber }));


        alert("Review submitted successfully!");
        onClose(); // Close the dialog on success
      } catch (error) {
        console.error("Error submitting review:", error);
      }
    };

    return (
      <Box component="form" sx={{ mt: 2 }} onSubmit={handleSubmit} alignItems="center" alignContent="center">
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
          Picture (Optional)
        </Typography>
        {/* React Dropzone area */}
        <DropzoneBox {...getRootProps()}>
          <input {...getInputProps()} />
          <UploadFileIcon fontSize="large" />
          <Typography variant="body2">
            Drag & drop your photo here, or click to select file
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
