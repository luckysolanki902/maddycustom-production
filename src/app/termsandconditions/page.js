import React from 'react';
import Link from 'next/link';
import { createMetadata } from '@/lib/metadata/create-metadata';
import styles from './tnc.module.css';
import GavelIcon from '@mui/icons-material/Gavel';
import SecurityIcon from '@mui/icons-material/Security';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import BlockIcon from '@mui/icons-material/Block';

export async function generateMetadata() {
    return createMetadata({
        title: 'Terms and Conditions - MaddyCustom',
        description: 'Read the terms and conditions for using MaddyCustom website and purchasing our custom vehicle accessories. Learn about our policies, user responsibilities, and legal information.',
        canonical: 'https://www.maddycustom.com/termsandconditions',
    });
}

const Section = ({ icon, title, children }) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <div className={styles.sectionIcon}>{icon}</div>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
    <div className={styles.sectionContent}>
      {children}
    </div>
  </section>
);

const TermsAndConditionsPage = () => {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Terms and Conditions</h1>
          <p className={styles.lastUpdated}>Last Updated: December 1, 2025</p>
          <p className={styles.intro}>
            Welcome to MaddyCustom. By accessing or using our website at <strong>www.maddycustom.com</strong> and purchasing our products, you agree to be bound by these Terms and Conditions. Please read them carefully before proceeding.
          </p>
        </header>

        <div className={styles.content}>
          <Section icon={<GavelIcon fontSize="inherit" />} title="1. General Terms">
            <ul className={styles.list}>
              <li>These Terms and Conditions govern your use of the MaddyCustom website and all purchases made through it.</li>
              <li>By placing an order, you confirm that you are at least 18 years of age or have parental/guardian consent.</li>
              <li>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting on the website.</li>
              <li>Your continued use of the website after changes constitutes acceptance of the modified terms.</li>
            </ul>
          </Section>

          <Section icon={<LocalShippingIcon fontSize="inherit" />} title="2. Products and Orders">
            <ul className={styles.list}>
              <li>All products displayed on our website are subject to availability.</li>
              <li>We strive to ensure accurate product descriptions, images, and pricing. However, minor variations may occur due to the customized nature of our products.</li>
              <li>Orders are confirmed only after successful payment processing.</li>
              <li>We reserve the right to cancel or refuse any order at our discretion, with a full refund provided if payment was already made.</li>
              <li>Custom/personalized products are made-to-order and may have specific processing times as mentioned on the product page.</li>
            </ul>
          </Section>

          <Section icon={<PaymentIcon fontSize="inherit" />} title="3. Pricing and Payment">
            <ul className={styles.list}>
              <li>All prices are displayed in Indian Rupees (INR) and include applicable taxes unless otherwise stated.</li>
              <li>We accept payments through various methods including UPI, credit/debit cards, net banking, and wallets via our secure payment gateway.</li>
              <li>Payment must be completed at the time of placing the order.</li>
              <li>We are not responsible for any additional charges levied by your bank or payment provider.</li>
              <li>In case of payment failure, please retry or contact our support team.</li>
            </ul>
          </Section>

          <Section icon={<LocalShippingIcon fontSize="inherit" />} title="4. Shipping and Delivery">
            <ul className={styles.list}>
              <li>We ship across India. Delivery timelines vary based on location and product type.</li>
              <li>Estimated dispatch time is within 7 business days for customized products.</li>
              <li>Shipping charges, if applicable, will be displayed at checkout.</li>
              <li>Once dispatched, tracking information will be shared via email/SMS.</li>
              <li>We are not liable for delays caused by courier partners, natural calamities, or circumstances beyond our control.</li>
              <li>Please ensure accurate delivery address and contact information to avoid delivery issues.</li>
            </ul>
          </Section>

          <Section icon={<SecurityIcon fontSize="inherit" />} title="5. Refunds and Replacements">
            <ul className={styles.list}>
              <li>Our detailed Refund and Replacement Policy can be found on our <Link href="/refunds-and-replacements" className={styles.inlineLink}>Refunds & Replacements</Link> page.</li>
              <li>Damaged products are eligible for free replacement if reported within 48 hours of delivery with photographic evidence.</li>
              <li>Size mismatch replacements are available with a nominal reshipping fee of ₹100.</li>
              <li>Custom/personalized products cannot be returned unless defective or damaged.</li>
              <li>Refunds, where applicable, will be processed within 7-10 business days to the original payment method.</li>
            </ul>
          </Section>

          <Section icon={<VerifiedUserIcon fontSize="inherit" />} title="6. User Responsibilities">
            <ul className={styles.list}>
              <li>You agree to provide accurate and complete information when placing orders or creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree not to use the website for any unlawful or prohibited activities.</li>
              <li>Any content you upload (such as custom designs) must not infringe on third-party intellectual property rights.</li>
              <li>We reserve the right to refuse orders containing inappropriate or copyrighted content.</li>
            </ul>
          </Section>

          <Section icon={<SecurityIcon fontSize="inherit" />} title="7. Privacy and Data Protection">
            <ul className={styles.list}>
              <li>Your personal information is collected and processed in accordance with applicable data protection laws.</li>
              <li>We use your data solely for order processing, customer support, and improving our services.</li>
              <li>We do not sell or share your personal information with third parties for marketing purposes.</li>
              <li>Our website uses cookies to enhance user experience. By using the site, you consent to cookie usage.</li>
            </ul>
          </Section>

          <Section icon={<BlockIcon fontSize="inherit" />} title="8. Limitation of Liability">
            <ul className={styles.list}>
              <li>MaddyCustom shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services.</li>
              <li>Our total liability is limited to the purchase price of the product(s) in question.</li>
              <li>We do not guarantee uninterrupted or error-free website operation.</li>
              <li>Product images are representative; actual products may vary slightly in color or appearance due to screen settings and manufacturing processes.</li>
            </ul>
          </Section>

          <Section icon={<GavelIcon fontSize="inherit" />} title="9. Intellectual Property">
            <ul className={styles.list}>
              <li>All content on this website, including logos, images, designs, and text, is the property of MaddyCustom and protected by intellectual property laws.</li>
              <li>You may not reproduce, distribute, or use any content without our prior written consent.</li>
              <li>The MaddyCustom name, logo, and taglines are registered trademarks.</li>
            </ul>
          </Section>

          <Section icon={<GavelIcon fontSize="inherit" />} title="10. Governing Law and Disputes">
            <ul className={styles.list}>
              <li>These Terms and Conditions are governed by the laws of India.</li>
              <li>Any disputes arising from these terms or your use of the website shall be subject to the exclusive jurisdiction of courts in Lucknow, Uttar Pradesh.</li>
              <li>We encourage resolving any issues through our customer support before initiating legal proceedings.</li>
            </ul>
          </Section>
        </div>

        <section className={styles.contactCard}>
          <h3 className={styles.contactTitle}>Questions?</h3>
          <p className={styles.contactCopy}>
            If you have any questions about these Terms and Conditions, please reach out to us through our{' '}
            <Link href="/contact-us" className={styles.inlineLink}>Contact Us</Link> page or visit our{' '}
            <Link href="/faqs" className={styles.inlineLink}>FAQs</Link> for quick answers.
          </p>
        </section>

        <div className={styles.taglineWrap}>
          <div className={styles.tagline}>#OwnUniqueness</div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditionsPage;