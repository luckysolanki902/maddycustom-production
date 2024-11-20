import React from 'react';
import styles from '@/styles/about.module.css';
import ContactUs from '@/components/layouts/ContactUs';
import Sidebar from '@/components/layouts/Sidebar';
import { createMetadata } from '@/lib/metadata/create-metadata';

export async function generateMetadata() {
    return createMetadata({
      title: 'About | Maddy Custom',
      canonical: 'https://www.maddycustom.com/about',
    });
  }
  

const AboutPage = () => {
  return (
    <div>
      <Sidebar />
      <div className={styles.mainC}>
        <h1 className={styles.mainH}>About Us</h1>
        <section className={styles.sec}>
          <p>
            Welcome to Maddycustom, where we turn helmets into personalized works of art, making every ride uniquely yours.
          </p>
          <p>
            <span className={styles.bolder}>Our Journey:</span> At Maddycustom, we&apos;re riders and creators. Our passion led us to a simple idea – transforming helmets into personalized masterpieces.
          </p>
          <p>
            <span className={styles.bolder}>What Sets Us Apart:</span> Unlike traditional manufacturers, we don&apos;t build helmets. Instead, we source quality helmets in bulk from various shops, allowing us to offer unique designs at affordable prices.
          </p>
          <p>
            <span className={styles.bolder}>Transparency Matters:</span> We believe in openness. Maddycustom is not a helmet brand; we enhance existing helmets with carefully crafted wraps, ensuring safety while riding in style.
          </p>
          <p>
            <span className={styles.bolder}>Our Process:</span> From bulk helmet acquisition to precise wrap application, our meticulous process ensures each helmet meets the highest standards of quality and individuality.
          </p>
          <p>
            <span className={styles.bolder}>Join the Maddycustom Experience:</span> Explore our gallery, find the perfect wrap for your helmet, and join the Maddycustom community. Ride confidently, ride uniquely – that&apos;s the Maddycustom way.
          </p>
        </section>
        <h2 className={styles.hashtag}>#OWN UNIQUENESS</h2>
      </div>
      <ContactUs />
    </div>
  );
};

export default AboutPage;
