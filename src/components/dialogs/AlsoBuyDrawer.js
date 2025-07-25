// src/components/dialogs/AlsoBuyDrawer.js
'use client';

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Drawer, IconButton, Button, CircularProgress, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './styles/alsobuydrawer.module.css';
import AddToCartButton from '../utils/AddToCartButton';
import { closeAlsoBuyDrawer, openCartDrawer } from '@/store/slices/uiSlice';
import Image from 'next/image';

const AlsoBuyDrawer = () => {
  const dispatch = useDispatch();
  const { isAlsoBuyDrawerOpen, alsoBuyDrawerProductId, alsoBuyDrawerDesignGroupId } = useSelector((state) => state.ui);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  useEffect(() => {
    if (isAlsoBuyDrawerOpen && alsoBuyDrawerDesignGroupId) {
      setLoading(true);
      fetch(`/api/products/recommendations?designGroupId=${alsoBuyDrawerDesignGroupId}&productId=${alsoBuyDrawerProductId}`)
        .then((res) => res.json())
        .then((data) => {
          setRecommendations(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch recommendations", err);
          setLoading(false);
        });
    }
  }, [isAlsoBuyDrawerOpen, alsoBuyDrawerDesignGroupId, alsoBuyDrawerProductId]);

  const handleClose = () => {
    dispatch(closeAlsoBuyDrawer());
  };

  const handleGoToCart = () => {
    handleClose();
    dispatch(openCartDrawer());
  };

  const drawerVariants = {
    hidden: { y: '100%' },
    visible: { y: '0%' },
    exit: { y: '100%' },
  };

  return (
    <Drawer
      anchor="bottom"
      open={isAlsoBuyDrawerOpen}
      onClose={handleClose}
      PaperProps={{ className: styles.drawer }}
    >
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={drawerVariants}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <IconButton onClick={handleClose} className={styles.closeButton}>
          <CloseIcon />
        </IconButton>
        <div className={styles.header}>
          <motion.h2
            className={styles.heading}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            You might also like...
          </motion.h2>
          <motion.p
            className={styles.subheading}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Customers who bought this also bought these
          </motion.p>
        </div>

        {loading ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : (
          <AnimatePresence>
            {recommendations.length > 0 && (
              <motion.div
                className={styles.productList}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1, delayChildren: 0.4 }}
              >
                {recommendations.map((product, index) => (
                  <motion.div
                    key={product._id}
                    className={styles.productCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <Image
                      src={`${imageBaseUrl}/${product.images[0]}`}
                      alt={product.name}
                      width={150}
                      height={120}
                      className={styles.productImage}
                    />
                    <h3 className={styles.productName}>{product.name}</h3>
                    <p className={styles.categoryName}>{product.specificCategory?.name}</p>
                    <div className={styles.actions}>
                      <AddToCartButton product={product} smaller={true} />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <motion.div
          className={styles.actions}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={handleGoToCart}
            className={styles.goToCartButton}
            variant="contained"
          >
            Go to Cart
          </Button>
        </motion.div>
      </motion.div>
    </Drawer>
  );
};

export default AlsoBuyDrawer;
