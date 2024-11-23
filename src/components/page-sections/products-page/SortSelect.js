// components/SortSelect.js

'use client';

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const SortSelect = ({ sortBy, setSortBy }) => {
  const handleChange = (event) => {
    setSortBy(event.target.value);
  };

  return (
    <FormControl variant="outlined" >
      <InputLabel id="sort-select-label">Sort By</InputLabel>
      <Select
        labelId="sort-select-label"
        id="sort-select"
        value={sortBy}
        onChange={handleChange}
        label="Sort By"
      >
        <MenuItem value="default">Default</MenuItem>
        <MenuItem value="priceLowToHigh">Price: Low to High</MenuItem>
        <MenuItem value="priceHighToLow">Price: High to Low</MenuItem>
        <MenuItem value="latestFirst">Latest First</MenuItem>
        <MenuItem value="oldestFirst">Oldest First</MenuItem>
      </Select>
    </FormControl>
  );
};

export default SortSelect;
