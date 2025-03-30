// components/FaqAccordionCard.js 
// page-sections/Faq/FaqAccordionCard.js
"use client";
import React, { useState } from 'react';
import styles from './styles/Faq.module.css';

const FaqAccordionCard = ({ title, content }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAccordion = () => setIsOpen(!isOpen);

  return (
    <div className={styles.card}>
      <button onClick={toggleAccordion} className={styles.cardButton}>
        {/* FAQ question styled with .faqTitle */}
        <span className={styles.faqTitle}>{title}</span>
        {/* Arrow up/down */}
        <span>{isOpen ? '⮙' : '⮛'}</span>
      </button>

      {isOpen && (
        <div className={styles.cardContent}>
          {/* FAQ answer styled with .faqContent */}
          <p className={styles.faqContent}>{content}</p>
        </div>
      )}
    </div>
  );
};

export default FaqAccordionCard;


