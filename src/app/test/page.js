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
  const [debug, setDebug] = useState(null);

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
  setDebug(data.debug || data.dimensionsAndWeight?.debug || null);
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
            {dimensions.totals && (
              <Box sx={{ mt: 1, pl: 1, borderLeft: '3px solid #eee' }}>
                <Typography variant="subtitle2">Totals</Typography>
                <Typography>Gross Weight: {dimensions.totals.grossWeight} kg</Typography>
                <Typography>Tare (Box) Weight: {dimensions.totals.tareWeight} kg</Typography>
                <Typography>Product Weight: {dimensions.totals.productWeight} kg</Typography>
                <Typography>Freebie Weight: {dimensions.totals.freebieWeight} kg</Typography>
                <Typography>Volumetric Weight (total): {dimensions.totals.volumetricWeightKg} kg</Typography>
                <Typography>Boxes Used: {dimensions.boxesUsed}</Typography>
              </Box>
            )}
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

        {debug && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Calculation Log
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto', bgcolor: '#fafafa' }}>
              {/* Packaging by item */}
              {debug.packagingByItem && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">Packaging by Item</Typography>
                  {debug.packagingByItem.map((p, idx) => (
                    <Box key={idx} sx={{ pl: 1, mb: 1 }}>
                      <Typography>- {p.itemName} x{p.quantity}</Typography>
                      <Typography>  • Unit Weight: {p.productWeight} kg</Typography>
                      {p.hasFreebie && (
                        <Typography>  • Freebie: {p.freebieWeight} kg</Typography>
                      )}
                      {p.ids && (
                        <Typography>
                          {`  • IDs: product=${p.ids.productId || '—'} | variant=${p.ids.variantId || '—'} | specCat=${p.ids.specCategoryId || '—'}`}
                        </Typography>
                      )}
                      {p.selectionSource && (
                        <Typography>  • Selection: {p.selectionSource} ({p.selectionTrace?.[p.selectionTrace.length-1]?.reason || 'n/a'})</Typography>
                      )}
                      <Typography>  • Box: {p.box.name} (cap {p.box.capacity}, tare {p.box.tareWeight} kg)</Typography>
                      <Typography>  • Box Dim: {p.box.dimensions.length}x{p.box.dimensions.breadth}x{p.box.dimensions.height} cm</Typography>
                      <Typography>  • Priority: {p.box.priority ?? 'N/A'}, Tags: {Array.isArray(p.box.compatibleTags) ? p.box.compatibleTags.join(', ') : '—'}</Typography>
                      {Array.isArray(p.selectionWarnings) && p.selectionWarnings.length > 0 && (
                        <Box sx={{ pl: 2, mt: 0.5 }}>
                          {p.selectionWarnings.map((w, wi) => (
                            <Typography key={wi} color="warning.main">⚠ {w}</Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Merge decisions */}
              {debug.groupMergeDecisions && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">Group Merge Decisions</Typography>
                  {debug.groupMergeDecisions.map((g, idx) => (
                    <Box key={idx} sx={{ pl: 1, mb: 1 }}>
                      <Typography>
                        - {g.action === 'merged' ? `Merged ${g.source?.name} -> ${g.target?.name}` : `Standalone ${g.group?.name}`}
                      </Typography>
                      {g.reason && <Typography>  • Reason: {g.reason}</Typography>}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Packing details per boxId */}
              {debug.packingDetailsByBoxId && Object.entries(debug.packingDetailsByBoxId).map(([boxId, detail]) => (
                <Box key={boxId} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">Packing for Box ID {boxId}</Typography>
                  {detail?.boxSpec && (
                    <Box sx={{ pl: 1 }}>
                      <Typography>Box: {detail.boxSpec.name} | Capacity: {detail.boxSpec.capacity} | Tare: {detail.boxSpec.tareWeight} kg</Typography>
                      <Typography>Dims: {detail.boxSpec.dimensions.length}x{detail.boxSpec.dimensions.breadth}x{detail.boxSpec.dimensions.height} cm | Volumetric per box: {detail.boxSpec.perBoxVolumetricKg} kg</Typography>
                    </Box>
                  )}
                  {detail?.boxes?.map((b) => (
                    <Box key={b.index} sx={{ pl: 2, mt: 1 }}>
                      <Typography>Box #{b.index}: Gross {b.grossWeight} kg | Product {b.productWeight} kg | Freebie {b.freebieWeight} kg | Tare {b.tareWeight} kg | Volumetric {b.volumetricWeightKg} kg</Typography>
                      <Typography>Leftover Capacity: {b.leftoverCapacityEnd}</Typography>
                      {b.itemsPlaced?.length > 0 && (
                        <Box sx={{ pl: 2 }}>
                          {b.itemsPlaced.map((it, i2) => (
                            <Typography key={i2}>• {it.itemName}: x{it.placedQty} × {it.unitWeight} kg = {it.subtotalWeight} kg</Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              ))}

              {debug.finalDimensionAggregation && (
                <Box>
                  <Typography variant="subtitle1">Final Dimension Aggregation</Typography>
                  <Typography>Length: {debug.finalDimensionAggregation.length} | Breadth: {debug.finalDimensionAggregation.breadth} | Height: {debug.finalDimensionAggregation.height}</Typography>
                  <Typography>Rule: {debug.finalDimensionAggregation.rule}</Typography>
                </Box>
              )}
            </Paper>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default TestPage;
