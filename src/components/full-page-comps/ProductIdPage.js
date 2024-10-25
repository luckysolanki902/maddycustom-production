// @models/full-page-comps/ProductIdPage.js
import React from 'react';
import ProductCard from '../cards/ProductCard';

export default function ProductIdPage({ product }) {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>{product.name}</h1>
        <p>{product.title}</p>
      </header>
      <section style={styles.productDetails}>
        <p>{product.description}</p>
        <h3>Price: ${product.price}</h3>
        <h4>Tags:</h4>
        <ul style={styles.tagList}>
          {product.tags.map((tag, index) => (
            <li key={index}>{tag}</li>
          ))}
        </ul>
        <ProductCard product={product}/>
      </section>

    
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  header: { marginBottom: '20px' },
  productDetails: { marginTop: '20px' },
  tagList: { listStyleType: 'none', padding: 0 },
};
