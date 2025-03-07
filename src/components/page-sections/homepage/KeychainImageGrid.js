'use client'
import React from 'react'
import styles from './styles/keychainimagegrid.module.css'
import Image from 'next/image'
import { useMediaQuery } from '@mui/material'

const KeychainImageGrid = () => {
  // Sample data array; replace src with your actual image paths
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const keychainData = [
    {
      src: '/assets/posters/keychain1.png',
      alt: 'Metal Keychain',
    },
    {
      src: '/assets/posters/keychain2.png',
      alt: 'Disc Brake Keychain',
    },
    {
      src: '/assets/posters/keychain3.png',
      alt: 'Gear Box Keychain',
    },
  ]

  return (
    <div className={styles.gridContainer}>
      {isSmallDevice ? (
        keychainData.slice(0, 2).map((item, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.imageWrapper}>
              <Image
                src={`${imageBaseUrl}${item.src}`}
                alt={item.alt}
                fill
                className={styles.image}
                sizes="(max-width: 767px) 50vw, 33vw"
              />
            </div>
          </div>
        ))
      ) : (
        keychainData.map((item, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.imageWrapper}>
              <Image
                src={`${imageBaseUrl}${item.src}`}
                alt={item.alt}
                fill
                className={styles.image}
                sizes="(max-width: 767px) 50vw, 33vw"
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default KeychainImageGrid

