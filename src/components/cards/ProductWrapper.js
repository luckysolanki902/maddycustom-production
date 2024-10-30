// import React from 'react';
// import Image from 'next/image';

// const ProductCardWrapper = ({ product, isZoomed, onOtherClick }) => {
    
//   return (
//     <div
//       style={{
//         display: 'flex',
//         position: 'relative',
//         minHeight: '220px',
//       }}
//     >
//       {product.isVideoAvailable ? (
//         <video
//           style={{
//             width: '100%',
//             height: '100%',
//             objectFit: 'cover',
//             borderRadius: '10px',
//           }}
//           autoPlay
//           loop
//           onClick={onOtherClick}
//         >
//           <source src={product.videoUrl} type="video/mp4" />
//           Your browser does not support the video tag.
//         </video>
//       ) : (
//         <Image
//           className={isZoomed ? 'rotated' : ''}
//           src={
//             product.images && product.images.length > 0
//               ? product.images[0]
//               : '/images/placeholder/imagep2.jpg'
//           }
//           alt={product.name}
//           width={1076}
//           height={683}
//           loading="lazy"
//           placeholder="blur"
//           blurDataURL="/images/placeholder/imagep2.jpg"
//           title={product.title}
//           aria-describedby={product.description}
//         />
//       )}
//     </div>
//   );
// };

// export default React.memo(ProductCardWrapper);
import React from 'react';
import ProductCard from './ProductCard';
import styles from './styles/categorysection.module.css';

const CategorySection = ({ category, variants, products }) => {
  return (
    <div className={styles.categorySection}>
      <h2 className={styles.categoryTitle}>{category.name}</h2> {/* Apply class */}
      {variants.map((variant) => (
        <div key={variant._id.$oid} className={styles.variantSection}>
          <h3 className={styles.variantTitle}>{variant.name}</h3> {/* Apply class */}
          <div className={styles.productsGrid}>
          {variant.showCase?.mainVideo?.available && (
            <div className={styles.videoCard}>
              <video
                autoPlay
                muted
                playsInline
                loop
                controls
                style={{
                  width: '100%',
                  height: '333px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                }}
              >
                <source src={variant.showCase.mainVideo.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <div style={{textAlign:'center', height:'auto', display:'flex', justifyContent:'center', alignContent: 'center'}}><h1>Maddy Customs</h1></div>
            </div>
          )}
      
            {products
              .filter(
                (product) =>
                  product.specificCategory.$oid === category._id.$oid &&
                  product.specificCategoryVariant.$oid === variant._id.$oid
              )
              .map((product) => (
                <ProductCard key={product._id.$oid} product={product} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategorySection;
