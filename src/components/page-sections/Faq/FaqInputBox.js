'use client';
import React, { useState } from 'react';
import styles from './styles/Faq.module.css';

const categories = {
  "Order Related": ["Did not receive order ID", "Can't track order", "Shipping delay", "Other"],
  "Product Related": ["Size doubts", "Material queries", "Installation help", "Other"],
  Other: [],
};

const FaqInputBox = ({ onChatResponse, onReopenChat }) => {
  const [issue, setIssue] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // A simple regex-based validation for a 10-digit mobile number
  const validateMobile = (number) => {
    return /^\d{10}$/.test(number);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate mobile number here
    if (!validateMobile(mobile)) {
      alert("Please enter a valid 10-digit mobile number.");
      return; // Stop submission
    }

    setLoading(true);
    try {
      // Deprecated endpoint replaced by /api/assistant/chat
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // adapt to assistant route: combine structured fields into message
          message: `[Category: ${category}] [Sub: ${subcategory}] [Mobile: ${mobile}] [Email: ${email || 'N/A'}] Issue: ${issue}`,
          userId: mobile || 'guest',
        }),
      });
      const data = await res.json();
      const reply = data?.reply || 'No response.';
      onChatResponse(reply, data.threadId || null);

      // Once submitted, hide the submit button
      setSubmitted(true);
    } catch (error) {
      console.error('Error fetching chat response', error);
    }
    setLoading(false);
  };

  return (
    <div
      className={styles.mainContainer}
      style={{ marginBottom: category ? '25rem' : '10rem' }}
    >
      <div className={styles.headingContainer}>
        <h2 className={styles.heading}>How can we help you?</h2>
      </div>
      <div className={styles.inputContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Category Dropdown */}
          <select
            className={styles.dropdown}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSubcategory('');
            }}
            required
          >
            <option value="" disabled>
              Select Category
            </option>
            {Object.keys(categories).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Subcategory Dropdown or Input */}
          {category && category !== "Other" && (
            <select
              className={styles.dropdown}
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              required
            >
              <option value="" disabled>
                Select Subcategory
              </option>
              {categories[category].map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          )}

          {category === "Other" && (
            <div className={styles.mobileFieldContainer}>
              <input
                type="text"
                className={styles.mobileField}
                placeholder="Subject"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                required
              />
            </div>
          )}

          {/* Issue Textarea */}
          {subcategory && (
            <textarea
              className={styles.messageField}
              placeholder="Please enter your issue here"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              required
            />
          )}

          {/* Mobile Number Input */}
          {issue && (
            <div className={styles.mobileFieldContainer}>
              <input
                type="text"
                className={styles.mobileField}
                placeholder="Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
            </div>
          )}

          {/* Email Input */}
          {mobile && (
            <div className={styles.mobileFieldContainer}>
              <input
                type="email"
                className={styles.mobileField}
                placeholder="Email Address (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {/* Submit button OR Reopen dialog */}
          {!submitted ? (
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Resolving...' : 'Resolve'}
            </button>
          ) : (
            <button
              type="button"
              className={styles.submitButton}
              onClick={onReopenChat}
            >
              Reopen Chat
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default FaqInputBox;
