// components/SortBy.js
import React from 'react';
import styles from './styles/sortby.module.css';

const SortBy = ({ setSortBy }) => {
  const handleChange = (e) => {
    setSortBy(e.target.value);
  };

  return (
    <div className={styles.sortByContainer}>
      <label htmlFor="sortBy">Sort By: </label>
      <select id="sortBy" onChange={handleChange}>
        <option value="default">Default</option>
        <option value="priceLowToHigh">Price: Low to High</option>
        <option value="priceHighToLow">Price: High to Low</option>
        <option value="latestFirst">Latest First</option>
        <option value="oldestFirst">Oldest First</option>
      </select>
    </div>
  );
};

export default SortBy;
