// pages/faq.js
'use client';
import React from 'react';
import FaqHeader from '../page-sections/Faq/FaqHeader';
import styles from '../page-sections/Faq/styles/Faq.module.css';
import FaqInputBox from '../page-sections/Faq/FaqInputBox';
import FaqAccordionSection from '../page-sections/Faq/FaqAccordionSection';

// Import the JSON data from your JSON file
import faqData from '../../lib/faq/faqData.json';
const FaqPage = () => {
  return (
    <div className={styles.main}>
      <FaqHeader />
      <FaqInputBox />
      <div className={styles.faqPage}>
        <h1 className={styles.faqHeading}>FAQ s</h1>
        <div className={styles.faqRow}>
          {faqData.faqSections.map((section, index) => (
            <FaqAccordionSection
              key={index}
              productTitle={section.productTitle}
              faqData={section.faqs}
            
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FaqPage;

