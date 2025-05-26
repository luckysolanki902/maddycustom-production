import React, { useState } from "react";
import Image from "next/image";
import styles from "./OptionSelector.module.css";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

const OptionSelector = ({
  options,
  selectedOption,
  handleOptionChange,
  optionLabel,
  colorMap,
  imageBaseUrl,
  isMobile
}) => {
  const [showOptions, setShowOptions] = useState(false);

  // Toggle options dropdown (for mobile)
  const toggleOptions = () => {
    setShowOptions(prev => !prev);
  };

  // Get option name from option details
  const getOptionName = (opt) => {
    if (!opt.optionDetails) return "Option";
    
    // Try to get the value from color key first
    if (opt.optionDetails.color) {
      return opt.optionDetails.color;
    }

    // Otherwise get the first value
    const firstValue = Object.values(opt.optionDetails)[0];
    return firstValue || "Option";
  };

  // Function to compute the style for each option rectangle
  const getOptionStyle = (opt) => {
    const isSelected = selectedOption && selectedOption._id === opt._id;
    
    let backgroundColor = "#f0f0f0";
    let backgroundImage = '';

    if (opt.thumbnail) {
      // If thumbnail exists, use it
      backgroundImage = `url(${imageBaseUrl}/${opt.thumbnail})`;
    } else {
      // Try to get color based on option value
      const optionValue = opt.optionDetails && opt.optionDetails.color
        ? opt.optionDetails.color.toLowerCase()
        : opt.optionDetails
          ? Object.values(opt.optionDetails)[0]?.toLowerCase()
          : null;

      if (optionValue) {
        backgroundColor = colorMap[optionValue] || optionValue;
      }
    }

    return {
      backgroundImage: backgroundImage || 'none',
      backgroundColor: !backgroundImage ? backgroundColor : 'transparent',
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  };

  if (options.length === 0) return null;

  if (isMobile) {
    return (
      <div className={styles.container}>
        <div 
          className={styles.mobileToggle}
          onClick={toggleOptions}
        >
          <div className={styles.toggleHeader}>
            <span className={styles.optionTitle}>{optionLabel}</span>
            <div className={styles.selectedPreview}>
              {selectedOption && (
                <>
                  <div 
                    className={styles.colorSwatch} 
                    style={getOptionStyle(selectedOption)}
                  ></div>
                  <span className={styles.selectedName}>
                    {getOptionName(selectedOption)}
                  </span>
                </>
              )}
            </div>
            {showOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </div>
        </div>

        {showOptions && (
          <div className={styles.optionsDropdown}>
            {options.map(opt => (
              <div 
                key={opt._id}
                className={`${styles.optionItem} ${selectedOption && selectedOption._id === opt._id ? styles.selected : ''}`}
                onClick={() => {
                  handleOptionChange(opt);
                  setShowOptions(false);
                }}
              >
                <div 
                  className={styles.optionSwatch} 
                  style={getOptionStyle(opt)}
                ></div>
                <div className={styles.optionInfo}>
                  <span className={styles.optionName}>{getOptionName(opt)}</span>
                </div>
                {selectedOption && selectedOption._id === opt._id && (
                  <div className={styles.checkmark}>✓</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{optionLabel}</h3>
      <div className={styles.optionsGrid}>
        {options.map(opt => (
          <div 
            key={opt._id}
            className={`${styles.optionItem} ${selectedOption && selectedOption._id === opt._id ? styles.selected : ''}`}
            onClick={() => handleOptionChange(opt)}
          >
            <div 
              className={styles.optionSwatch} 
              style={getOptionStyle(opt)}
            ></div>
            <div className={styles.optionInfo}>
              <span className={styles.optionName}>{getOptionName(opt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OptionSelector;
