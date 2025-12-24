'use client';

import React from 'react';
import styles from './styles/viewcartDialogFooter.module.css';
import Image from 'next/image';
import Link from 'next/link';
import EmailIcon from '@mui/icons-material/Email';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const MAPS_URL = "https://www.google.com/maps/place/Maddy+Custom/@26.8033211,80.8977335,15z/data=!3m1!4b1!4m6!3m5!1s0x399bfd95dee6ba27:0xbc08f60a46635e84!8m2!3d26.8010803!4d80.9116381!16s%2Fg%2F11jz2q73s6?entry=ttu&g_ep=EgoyMDI1MTAwMS4wIKXMDSoASAFQAw%3D%3D";

export default function ViewCartDialogFooter() {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <div className={styles.wrapper}>
      {/* Full-width brand strip - no padding */}
      <div className={styles.accentStrip}>
        <span className={styles.accentStripText}>THE BRAND OF INDIAN CAR CULTURE</span>
      </div>

      {/* Happy customers - styled like Souled Store */}
      <div className={styles.happyStrip}>
        <span className={styles.happyStripText}>
          Over <strong className={styles.happyCount}>10,000+</strong> Happy Customers
        </span>
      </div>

      {/* Main content area */}
      <div className={styles.contentArea}>
        {/* Logo centered */}
        <div className={styles.logoSection}>
          <Image
            className={styles.logo}
            src={(() => {
              const now = new Date();
              const month = now.getMonth();
              const day = now.getDate();
              const isChristmasSeason = (month === 11 && day >= 20) || (month === 0 && day <= 2);
              return isChristmasSeason ? '/images/assets/logos/logo_christmas.png' : `${baseUrl}/assets/logos/maddy_custom3_main_logo.png`;
            })()}
            alt="Maddy Custom"
            width={100}
            height={46}
            priority={false}
          />
          <p className={styles.tagline}>Drive what defines you!</p>
        </div>

        {/* Follow Us row */}
        <div className={styles.followSection}>
          <span className={styles.followLabel}>Follow Us:</span>
          <div className={styles.socialRow}>
            <Link className={styles.socialLink} href="mailto:contact.maddycustoms@gmail.com" title="Email us">
              <EmailIcon className={styles.socialIcon} />
            </Link>
            <Link className={styles.socialLink} href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==" title="Instagram">
              <InstagramIcon className={styles.socialIcon} />
            </Link>
            <Link className={styles.socialLink} href="https://www.facebook.com/p/Maddycustom-61555047164387/" title="Facebook">
              <FacebookIcon className={styles.socialIcon} />
            </Link>
            <Link className={styles.socialLink} href={MAPS_URL} title="Location">
              <LocationOnIcon className={styles.socialIcon} />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar - full width, no container padding */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomSection}>
          <span className={styles.bottomLabel}>100% Secure Payments</span>
          <div className={styles.partnerLogos}>
            <span className={styles.partnerLogoWrap}>
              <Image
                src="/images/assets/partners/payut.png"
                alt="PayU"
                fill
                sizes="50px"
                style={{ objectFit: 'contain' }}
              />
            </span>
            <span className={styles.partnerLogoWrap}>
              <Image
                src="/images/assets/partners/razorpay.png"
                alt="Razorpay"
                fill
                sizes="70px"
                style={{ objectFit: 'contain' }}
              />
            </span>
          </div>
        </div>

        <div className={styles.bottomDivider} />

        <div className={styles.bottomSection}>
          <span className={styles.bottomLabel}>Shipping Partner</span>
          <div className={styles.partnerLogos}>
            <span className={styles.partnerLogoWrap}>
              <Image
                src="/images/assets/partners/shiprocket_logo.png"
                alt="Shiprocket"
                fill
                sizes="70px"
                style={{ objectFit: 'contain', transform: 'scale(1.1)' }}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
