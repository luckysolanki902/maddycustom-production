"use client";
import React, { useState } from 'react';
import styles from './styles/Faq.module.css';

const FaqInputBox = () => {
  const [issue, setIssue] = useState('');
  const [mobile, setMobile] = useState('');

  // Temporary submit handler for demonstration
  // Replace or extend this to connect with your backend
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Issue:', issue);
    console.log('Mobile:', mobile);

    // Example of how you'd call a backend endpoint:
    // fetch('/api/submit-issue', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ issue, mobile }),
    // })
    //   .then((res) => res.json())
    //   .then((data) => {
    //     console.log('Response from server:', data);
    //   })
    //   .catch((err) => {
    //     console.error('Error submitting:', err);
    //   });
  };

  return (
    <div className={styles.mainContainer}>
      {/* Heading section */}
      <div className={styles.headingContainer}>
        <h2 className={styles.heading}>How can we help you?</h2>
      </div>

      {/* Overlapping input box section */}
      <div className={styles.inputContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            className={styles.messageField}
            placeholder="Please enter your issue here"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
          />
          
          <div className={styles.mobileFieldContainer}>
            <input
              type="text"
              className={styles.mobileField}
              placeholder="Mobile Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.submitButton}>
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};

export default FaqInputBox;


