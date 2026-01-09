"use client"
import React from 'react';
import styles from './styles/orderspecifications.module.css';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SecurityIcon from '@mui/icons-material/Security';

const OrderSpecifications = ({ justContStart }) => {
    const newFeatures = [
        {
            name: "Premium Quality",
            icon: VerifiedIcon,
            color: "#5f8df2"
        },
        {
            name: "Free Delivery",
            icon: LocalShippingIcon,
            color: "#5f8df2"
        },
        {
            name: "Secure Payment",
            icon: SecurityIcon,
            color: "#5f8df2"
        }
    ]
    
    return (
        <div className={`${styles.main} ${justContStart ? styles.justContStart : ''}`}>
            {newFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                
                return (
                    <div 
                        key={index} 
                        className={styles.item} 
                    >
                        <div className={styles.iconWrapper}>
                            <IconComponent 
                                className={styles.icon}
                                style={{ color: feature.color }}
                            />
                        </div>
                        <div className={styles.word}>{feature.name}</div>
                    </div>
                );
            })}
        </div>
    );
};


export default OrderSpecifications;
