import React from 'react';
import styles from './styles/productfeaturehighlights.module.css';
import VerifiedIcon from '@mui/icons-material/Verified';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

export default function ProductFeatureHighlights() {
  const features = [
    {
      icon: <VerifiedIcon sx={{ fontSize: 40, color: '#4caf50' }} />,
      title: 'Premium',
      subtitle: 'Quality'
    },
    {
      icon: <SupportAgentIcon sx={{ fontSize: 40, color: '#4caf50' }} />,
      title: '24/7 Customer',
      subtitle: 'Support'
    },
    {
      icon: <LocalShippingIcon sx={{ fontSize: 40, color: '#4caf50' }} />,
      title: 'Free',
      subtitle: 'Shipping'
    }
  ];

  return (
    <div className={styles.container}>
      {features.map((feature, index) => (
        <div key={index} className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            {feature.icon}
          </div>
          <div className={styles.textWrapper}>
            <div className={styles.title}>{feature.title}</div>
            <div className={styles.subtitle}>{feature.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
