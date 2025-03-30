"use client";
import React, { useState } from 'react';
import styles from './styles/Faq.module.css';
import FaqAccordionCard from './FaqAccordionCard';

const FaqAccordionSection = ({ productTitle, faqData }) => {
  // State to control whether to show all FAQs or only the first 4
  const [showAll, setShowAll] = useState(false);

  // Show all if showAll is true; otherwise, show only the first 4 items
  const visibleFaqData = showAll ? faqData : faqData.slice(0, 4);

  return (
    <div className={styles.faqSection}>
      {/* Dark heading bar */}
      <div className={styles.faqSectionHeader}>
        <h2 className={styles.productTitle}>{productTitle}</h2>
      </div>

      {/* Accordion items */}
      <div className={styles.accordionContainer}>
        {visibleFaqData.map((item, index) => (
          <FaqAccordionCard
            key={index}
            title={item.title}
            content={item.content}
          />
        ))}
      </div>

      {/* Only show the "More" button if there are more than 4 items */}
      
      {!showAll && faqData.length > 4 && (
        <div style={{display:'flex', justifyContent: 'center', marginBottom:'1rem'}}>

        <button className={styles.submitButton} onClick={() => setShowAll(true)}>
          More
        </button>
        </div>
      )}
    </div>
  );
};

export default FaqAccordionSection;




