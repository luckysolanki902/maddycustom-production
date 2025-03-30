import React from 'react';
import styles from '@/styles/contact-us.module.css';
import { createMetadata } from '@/lib/metadata/create-metadata';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

export async function generateMetadata() {
  return createMetadata({
    title: 'Contact Us | Maddy Custom',
    canonical: 'https://www.maddycustom.com/contact-us',
  });
}

const ContactUsPage = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Contact Us</h1>
      <p className={styles.text}>
        Have questions about our products, orders, or customizations? We’re here to help! 
        Feel free to reach out, and we’ll be happy to assist you.
      </p>
      <p className={styles.text}>
        Before contacting us, please check our <a href="/faq" className={styles.link}>FAQ section</a>, 
        where you might find quick answers to common queries. If you still need help, 
        email us at{' '}
        <a href="mailto:contact.maddycustoms@gmail.com" className={styles.link}>
          contact.maddycustoms@gmail.com
        </a>.
      </p>
      <p className={styles.text}>
        Customer satisfaction is our priority. We strive to provide the best service, 
        quick responses, and a smooth shopping experience for every customer.
      </p>

      {/* WhatsApp Link */}
      <div className={styles.whatsappContainer}>
        <a
          href="https://wa.me/8112673988"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappLink}
        >
          <WhatsAppIcon className={styles.whatsappIcon} style={{ fontSize: 30, margin: 0 }} />
       
        </a>
      </div>
    </div>
  );
};

export default ContactUsPage;

