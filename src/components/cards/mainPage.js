"use client";
import React, { useState, useEffect } from 'react';
import CategorySection from './CategorySection';
// import productsData from '/public/json/products.json';
// import categoriesData from '/public/json/specific_categories.json';
// import variantsData from '/public/json/specific_category_variants.json';
// import styles from './styles/mainpage.module.css';

const MainPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variants, setVariants] = useState([]);

//   useEffect(() => {
//     setProducts(productsData);
//     setCategories(categoriesData);
//     setVariants(variantsData);
//   }, []);
useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await fetch('/json/specific_categories.json');
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);

        const variantsRes = await fetch('/json/specific_category_variants.json');
        const variantsData = await variantsRes.json();
        setVariants(variantsData);

        const productsRes = await fetch('/json/products.json');
        const productsData = await productsRes.json();
        setProducts(productsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    }
    fetchData();
},[products]);

  return (
    <div >
      {categories.map((category) => {
        const categoryVariants = variants.filter(
          (variant) => variant.parentSpecificCategory.$oid === category._id.$oid
        );
        return (
          <CategorySection
            key={category._id.$oid}
            category={category}
            variants={categoryVariants}
            products={products}
          />
        );
      })}
    </div>
  );
};

export default MainPage;
