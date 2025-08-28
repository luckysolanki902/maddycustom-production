import React from "react";
import styles from "./WrapFinishSelector.module.css";

const WrapFinishSelector = ({ selectedFinish, setSelectedFinish }) => {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Select Finish</h3>
      <div className={styles.options}>
        <div 
          className={`${styles.option} ${selectedFinish === 'Matte' ? styles.selected : ''}`}
          onClick={() => setSelectedFinish('Matte')}
        >
          <div className={styles.recommendedTag}>Recommended</div>
          <div className={styles.finishVisual}>
            <div className={styles.matteVisual}></div>
          </div>
          <div className={styles.finishInfo}>
            <span className={styles.finishName}>Matte</span>
            <span className={styles.finishDesc}>Textured</span>
          </div>
        </div>
        
        <div 
          className={`${styles.option} ${selectedFinish === 'Glossy' ? styles.selected : ''}`}
          onClick={() => setSelectedFinish('Glossy')}
        >
          <div className={styles.finishVisual}>
            <div className={styles.glossyVisual}></div>
          </div>
          <div className={styles.finishInfo}>
            <span className={styles.finishName}>Glossy</span>
            <span className={styles.finishDesc}>Shiny</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WrapFinishSelector;
