'use client';

import React from 'react';
import { motion } from 'framer-motion';
import CarIntExt from './CarIntExt';
import { useCarIntExtProducts } from '@/hooks/useCarIntExtProducts';

export default function CarIntExtWrapper({ assets = [] }) {
  const { data, loading, error } = useCarIntExtProducts(6);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.3
      }
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={containerVariants}
    >
      {/* Interior Section */}
      <motion.div variants={sectionVariants}>
        <CarIntExt 
          type="interior"
          assets={assets}
          products={data.interior}
          loading={loading}
          error={error}
        />
      </motion.div>

      {/* Exterior Section */}
      <motion.div variants={sectionVariants}>
        <CarIntExt 
          type="exterior"
          assets={assets}
          products={data.exterior}
          loading={loading}
          error={error}
        />
      </motion.div>
    </motion.div>
  );
}
