"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './styles/happycustomers.module.css';

export default function HappyCustomers({ parentSpecificCategoryVariantId, noShadow, noHeading }) {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const [happyCustomers, setHappyCustomers] = useState([]);

  const getFirstLetter = (name) => (name ? name[0] : '');

  useEffect(() => {
    async function fetchHappyCustomers() {
      try {
        const response = await fetch(`/api/showcase/happy-customers?parentSpecificCategoryVariantId=${parentSpecificCategoryVariantId}`);
        const data = await response.json();

        if (data?.happyCustomers) {
          setHappyCustomers(data.happyCustomers);
        } else {
          console.warn('No happy customers found');
        }
      } catch (error) {
        console.error("Error fetching happy customers:", error);
      }
    }

    if (parentSpecificCategoryVariantId) {
      fetchHappyCustomers();
    }
  }, [parentSpecificCategoryVariantId]);

  if (!happyCustomers.length) return null;

  return (
    <div className={`${styles.main} ${!noShadow && styles.shadow}`}>
      <div className={styles.pastOrdersMain}>
        {!noHeading && <div className={styles.pastOrdersH}>Happy Customers</div>}
      </div>
      <div className={styles.slider}>
        {happyCustomers.map((customer, index) => (
          <div className={styles.slide} key={index}>
            <Image
              src={`${baseImageUrl}${customer.photo}`}
              alt={`${customer.name}'s photo`}
              width={500}
              height={500}
              className={styles.image}
            />
            <div className={styles.details}>
              <div className={styles.circle}>{getFirstLetter(customer.name)}</div>
              <span className={styles.name}>{customer.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
