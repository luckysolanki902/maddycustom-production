'use client';

import React from 'react';
import styles from './styles/viewcartDialogFooter.module.css';
import Image from 'next/image';
import Link from 'next/link';
import InstagramIcon from '@mui/icons-material/Instagram';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const MAPS_URL = "https://www.google.com/maps/place/Maddy+Custom/@26.8033211,80.8977335,15z/data=!3m1!4b1!4m6!3m5!1s0x399bfd95dee6ba27:0xbc08f60a46635e84!8m2!3d26.8010803!4d80.9116381!16s%2Fg%2F11jz2q73s6?entry=ttu&g_ep=EgoyMDI1MTAwMS4wIKXMDSoASAFQAw%3D%3D";

export default function ViewCartDialogFooter() {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const partnerLogos = {
    shiprocket: '/images/assets/partners/shiprocket.png',
    payu: '/images/assets/partners/payu.png',
    razorpay: '/images/assets/partners/razorpay.png',
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.accentStrip}>
          <span className={styles.accentStripText}>THE BRAND OF INDIAN CAR CULTURE</span>
        </div>
        <div className={styles.happyStrip}>
          <span className={styles.happyStripText}>10,000+ happy customers</span>
        </div>

        <div className={styles.topRow}>
          <div className={styles.brand}>
            <div className={styles.logoRow}>
              <Image
                className={styles.logo}
                src={`${baseImageUrl}/assets/logos/maddy_custom3_main_logo.png`}
                alt="Maddy Custom"
                width={120}
                height={56}
                priority={false}
              />
            </div>
          </div>

          <div className={styles.contact}>
            <Link className={styles.contactRow} href="mailto:contact.maddycustoms@gmail.com">
              <EmailIcon className={styles.icon} />
              <span>contact.maddycustoms@gmail.com</span>
            </Link>

            <Link className={styles.contactRow} href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==">
              <InstagramIcon className={styles.icon} />
              <span>@maddycustom</span>
            </Link>

            <Link className={styles.contactRow} href={MAPS_URL}>
              <LocationOnIcon className={styles.icon} />
              <span>VIP Rd, Kasimpur Patri, Tiwaripur, Lucknow, UP 226005</span>
            </Link>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.partnersRow}>
          <div className={styles.partnerGroup}>
            <span className={styles.partnerLabel}>Shipping partner</span>
            <span className={styles.partnerPill}>
              <span className={styles.partnerLogoWrap}>
                <Image
                  src={partnerLogos.shiprocket}
                  alt="Shiprocket"
                  fill
                      sizes="44px"
                  style={{ objectFit: 'contain' }}
                />
              </span>
              <span>Shiprocket</span>
            </span>
          </div>

          <div className={styles.partnerGroup}>
            <span className={styles.partnerLabel}>Payment partners</span>
            <span className={styles.partnerPills}>
              <span className={styles.partnerPill}>
                <span className={styles.partnerLogoWrap}>
                  <Image
                    src={partnerLogos.payu}
                    alt="PayU"
                    fill
                      sizes="44px"
                    style={{ objectFit: 'contain' }}
                  />
                </span>
                <span>PayU</span>
              </span>
              <span className={styles.partnerPill}>
                <span className={styles.partnerLogoWrap}>
                  <Image
                    src={partnerLogos.razorpay}
                    alt="Razorpay"
                    fill
                      sizes="44px"
                    style={{ objectFit: 'contain' }}
                  />
                </span>
                <span>Razorpay</span>
              </span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
