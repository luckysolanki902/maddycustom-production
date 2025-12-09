import React from 'react';
import Link from 'next/link';
import { createMetadata } from '@/lib/metadata/create-metadata';
import styles from './refunds.module.css';
import SecurityIcon from '@mui/icons-material/Security';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

export async function generateMetadata() {
    return createMetadata({
        title: 'Refund & Replacement Policy - Maddy Custom',
        description: 'Learn about our refund and replacement policy at MaddyCustom. We stand behind the quality of our products with our damaged product protection and size mismatch policy.',
        canonical: 'https://www.maddycustom.com/refunds-and-replacements',
    });
}

const PolicyCard = ({ icon, title, items }) => (
  <article className={styles.card}>
    <header className={styles.cardHeader}>
      <div className={styles.cardIcon}>{icon}</div>
      <h3 className={styles.cardTitle}>{title}</h3>
    </header>
    <ul className={styles.list}>
      {items.map((t, i) => (
        <li key={i} className={styles.item}>
          <div className={styles.itemIndex}>{String(i + 1).padStart(2,'0')}</div>
          <p className={styles.itemCopy}>{t}</p>
        </li>
      ))}
    </ul>
  </article>
);

const RefundsAndReplacementsPage = () => {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.policyTitle}>Refund & Replacement Policy</h1>
          <p className={styles.policyIntro}>At MaddyCustom, we stand behind the quality of our products and the experience we deliver. This policy outlines how we support you in cases of damage, size mismatch, or logistics needs.</p>
        </header>

        {/* Return Policy Summary for Google Merchant Center compliance */}
        <section className={styles.returnSummary} aria-label="Return Policy Summary">
          <h2 className={styles.returnSummaryTitle}>Return Policy (India)</h2>
          <div className={styles.returnSummaryGrid}>
            <div className={styles.returnSummaryItem}>
              <strong>Return Window:</strong> 3 days from delivery
            </div>
            <div className={styles.returnSummaryItem}>
              <strong>Return/Replacement Fee:</strong> ₹100 (flat restocking fee)
            </div>
            <div className={styles.returnSummaryItem}>
              <strong>Return Method:</strong> By mail / courier pickup
            </div>
            <div className={styles.returnSummaryItem}>
              <strong>Refund Processing:</strong> Within 10 business days
            </div>
          </div>
          <p className={styles.returnSummaryNote}>
            <strong>Note:</strong> Custom/personalized products are eligible for returns only if they arrive damaged or defective. Standard (non-custom) products can be returned for any reason within the return window.
          </p>
        </section>

        <section className={styles.grid} aria-label="Policy Sections">
          <PolicyCard
            title="Damaged Product Protection"
            icon={<SecurityIcon fontSize="inherit" />}
            items={[
              'If your order arrives damaged, we will replace it at no additional cost to you.',
              'Report the issue within 3 days of delivery with clear photos of the product and packaging.',
              'Once verified by our quality team, we dispatch a replacement within 2-3 business days.'
            ]}
          />
          <PolicyCard
            title="Size Mismatch / Exchange Policy"
            icon={<SwapHorizIcon fontSize="inherit" />}
            items={[
              'If an incorrect size is received, we provide a hassle-free replacement.',
              'A restocking fee of ₹100 applies to cover logistics and handling.',
              'Requests must be made within 3 days of delivery. The original product must be unused and in pristine condition.'
            ]}
          />
          <PolicyCard
            title="How Returns Work"
            icon={<LocalShippingIcon fontSize="inherit" />}
            items={[
              'Contact us within 3 days of delivery to initiate a return request.',
              'We will arrange a courier pickup from your address (by mail). A ₹100 restocking fee applies.',
              'Once we receive and inspect the returned item, your refund will be processed within 10 business days.'
            ]}
          />
        </section>

        <section className={styles.missionPanel} aria-label="Delivery Promise">
          <h2 className={styles.missionHeading}><span className={styles.missionLead}>Fast Fulfilment:</span><span className={styles.missionFocus}>7 Days Dispatch Commitment</span></h2>
          <p className={styles.missionCopy}>We aim to get your customized products prepared and dispatched within 7 days. Precision production + efficient logistics = a smoother experience for you.</p>
        </section>

        <section className={styles.contactCard} aria-label="Support">
          <h3 className={styles.contactTitle}>Need Help?</h3>
          <p className={styles.contactCopy}>
            Have a concern or need to raise a claim? Reach out immediately—our team is ready to assist and make things right. You can also browse quick answers in our{' '}
            <Link href="/faqs" className={styles.inlineLink}>FAQs</Link>.
          </p>
        </section>

        <div className={styles.taglineWrap}>
          <div className={styles.tagline}>#OwnUniqueness</div>
        </div>
      </div>
    </div>
  );
};

export default RefundsAndReplacementsPage;
