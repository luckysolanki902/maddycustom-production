// /pages/test-page.jsx (Adjust the path as per your project structure)

"use client";

import React, { useState } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
  Paper,
} from "@mui/material";

const TestPage = () => {
  const [orderId, setOrderId] = useState("");
  const [dimensions, setDimensions] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setDimensions(null);

    try {
      const response = await fetch("/api/test/dimensions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch dimensions");
      }

      const data = await response.json();
      setDimensions(data.dimensionsAndWeight);
      setItems(data.items);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderId.trim() === "") {
      setError("Order ID cannot be empty.");
      return;
    }
    handleFetch();
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Calculate Order Dimensions & Weight
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
          <TextField
            label="Order ID"
            variant="outlined"
            fullWidth
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Get Dimensions & Weight"}
          </Button>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {dimensions && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Dimensions and Weight
            </Typography>
            <Typography>
              <strong>Length:</strong> {dimensions.length} cm
            </Typography>
            <Typography>
              <strong>Breadth:</strong> {dimensions.breadth} cm
            </Typography>
            <Typography>
              <strong>Height:</strong> {dimensions.height} cm
            </Typography>
            <Typography>
              <strong>Weight:</strong> {dimensions.weight} kg
            </Typography>
            {dimensions.freebieWeight && (
              <Typography>
                <strong>Freebie Weight:</strong> {dimensions.freebieWeight} kg
              </Typography>
            )}
          </Box>
        )}
        {items.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Order Items
            </Typography>
            {items.map((item, index) => (
              <Typography key={index}>
                {item.name} (Quantity: {item.quantity})
              </Typography>
            ))}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default TestPage;
