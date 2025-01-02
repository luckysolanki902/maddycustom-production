// components/page-sections/products-page/Tags.js

import React, { useState, useEffect } from 'react';
import styles from './styles/tags.module.css';
import ClearIcon from '@mui/icons-material/Clear';

const Tags = ({ setTagFilter, tags }) => {
  const [activeTag, setActiveTag] = useState('');
  const [uniqueTags, setUniqueTags] = useState([]);

  useEffect(() => {
    // Assuming tags are already unique and lowercase from the API
    setUniqueTags(tags);
  }, [tags]);

  const handleSelectTag = (tag) => {
    if (tag === activeTag) {
      setActiveTag('');
      setTagFilter(null); // Clear the tag filter
    } else {
      setActiveTag(tag);
      setTagFilter(tag); // Set the tag filter
    }
  };

  return (
    <div className={styles.tagMainContainer}>
      <div className={styles.tagContainer}>
        {uniqueTags.map((tag) => (
          <div
            key={tag}
            className={`${styles.tags} ${activeTag === tag ? styles.activeTag : ''}`}
            onClick={() => handleSelectTag(tag)}
          >
            {tag}
            {activeTag === tag && <ClearIcon style={{ marginLeft: '5px', cursor: 'pointer' }} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tags;
