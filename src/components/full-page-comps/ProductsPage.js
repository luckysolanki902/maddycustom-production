// @models/full-page-comps/ProductsPage.js
import React from 'react';

export default function ProductsPage({ variant, products }) {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>{variant.name}</h1>
        <p>{variant.description}</p>
      </header>
      <section style={styles.productsSection}>
        <h2>Products:</h2>
        {products.length === 0 ? (
          <p>No products found for this category variant.</p>
        ) : (
          <ul style={styles.productList}>
            {products.map((product) => (
              <li key={product._id} style={styles.productItem}>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  header: { marginBottom: '40px' },
  productsSection: { marginTop: '20px' },
  productList: { listStyleType: 'none', padding: 0 },
  productItem: { borderBottom: '1px solid #ddd', padding: '10px 0' },
};
