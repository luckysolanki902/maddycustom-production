'use client';

import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import TopBoughtProducts from '@/components/showcase/products/TopBoughtProducts';
import styles from './about.module.css';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

const slideInRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

// Pillar card animation (stagger via custom index)
const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut', delay: i * 0.12 }
  })
};

const pillars = [
  {
    title: 'The Vision',
    body: [
      'MaddyCustom was born from a simple yet powerful vision: to transform vehicle customization into a cohesive act of storytelling.',
      'We don\'t just sell accessories; we build narratives. We meticulously design and curate themed collections where every exterior wrap perfectly complements the interior accessories.',
      'From a bold bonnet design to a matching steering cover, each product is a chapter in a single story.'
    ]
  },
  {
    title: 'The Craft',
    body: [
      'Each piece is crafted with premium materials to ensure your vision lasts and your statement is clear.',
      'Quality isn\'t just a promise— it\'s woven into every product we create.',
      'We push the boundaries of design so you can create a ride that is unmistakably, authentically yours.'
    ]
  },
  {
    title: 'The Community',
    body: [
      'Our brand is for the creators, the trendsetters, and the rebels who refuse to drive a stock story.',
      'We exist for those who see their car or bike not just as transport, but as a bold extension of who they are.',
      'We empower every driver and rider to turn their vehicle into a masterpiece of personal expression.'
    ]
  }
];

const AboutPage = () => {
  return (
    <Box className={styles.container}>
      {/* Hero Section */}
      <Box className={styles.heroSection}>
        <Container maxWidth="lg">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <Typography className={styles.heroTitle}>
              MaddyCustom
            </Typography>
            <Typography className={styles.heroSubtitle}>
              Your Story. Your Ride.
            </Typography>
            <Box className={styles.heroDivider} />
          </motion.div>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxWidth="lg" className={styles.mainContent}>
        
        {/* Philosophy Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className={styles.philosophySection}
        >
          <Typography className={styles.philosophyText}>
            We believe a vehicle is more than just metal and mechanics—it&apos;s a <span className={styles.highlight}>canvas for your identity</span>. 
            But for too long, personalization has been a scattered puzzle of mismatched parts.
          </Typography>
        </motion.div>

        {/* Storytelling Pillars (Refreshed Monochrome Layout) */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          className={styles.pillarsSection}
        >
          <motion.h2
            className={styles.pillarsHeading}
            variants={fadeInUp}
          >
            Why We Exist
          </motion.h2>
          <div className={styles.pillarsGrid}>
            {pillars.map((pillar, i) => (
              <motion.article
                key={pillar.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={cardVariants}
                className={styles.pillarCard}
                data-number={`0${i + 1}`}
              >
                <div className={styles.pillarAccent} />
                <header className={styles.pillarHeader}>
                  <span className={styles.pillarIndex}>0{i + 1}</span>
                  <h3 className={styles.pillarTitle}>{pillar.title}</h3>
                </header>
                <div className={styles.pillarBody}>
                  {pillar.body.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </motion.article>
            ))}
          </div>
        </motion.section>

        {/* Mission Panel (Updated creative minimal) */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className={styles.missionPanel}
          aria-label="Mission Statement"
        >
          <div className={styles.missionInner}>
            <h2 className={styles.missionHeading}>
              <span className={styles.missionLead}>Our ultimate vision is to</span>
              <span className={styles.missionFocus}>empower every driver and rider</span>
            </h2>
            <p className={styles.missionCopy}>to turn their vehicle into a masterpiece of personal expression. We are committed to pushing the boundaries of design and providing you with the tools to create a ride that is unmistakably, authentically yours.</p>
          </div>
          <div className={styles.missionFrame} aria-hidden="true" />
        </motion.section>

        {/* Closing Module (Updated) */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className={styles.closingModule}
          aria-label="Closing Brand Statement"
        >
          <div className={styles.closingTopLines}>
            <p className={styles.closingLead}>Your journey is unique.</p>
            <p className={styles.closingLead}>Your vehicle should be too.</p>
          </div>
          <div className={styles.closingDivider} />
            <div className={styles.brandLockup}>
              <h3 className={styles.brandNameLarge}>Welcome to <span>MaddyCustom</span></h3>
              <p className={styles.brandTaglineSmall}>where your story hits the road.</p>
            </div>
          <div className={styles.closingDivider} />
        </motion.section>

        {/* Social Showcase (Updated Minimal) */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className={styles.socialShowcase}
          aria-labelledby="social-heading"
        >
          <motion.h2 variants={fadeInUp} id="social-heading" className={styles.socialHeading}>Join Our Community</motion.h2>
          <div className={styles.socialGrid}>
            <motion.a
              variants={scaleIn}
              href="https://www.instagram.com/maddycustom/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.socialMinimal} ${styles.instagramMinimal}`}
              aria-label="Follow us on Instagram"
            >
              <div className={styles.socialIconShell}><InstagramIcon fontSize="inherit" /></div>
              <div className={styles.socialTextBlock}>
                <span className={styles.socialLabel}>Instagram</span>
                <span className={styles.socialHandle}>@maddycustom</span>
                <span className={styles.socialDesc}>Stories • Collections • Transformations</span>
              </div>
            </motion.a>
            <motion.a
              variants={scaleIn}
              href="https://www.youtube.com/@maddycustom"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.socialMinimal} ${styles.youtubeMinimal}`}
              aria-label="Subscribe on YouTube"
            >
              <div className={styles.socialIconShell}><YouTubeIcon fontSize="inherit" /></div>
              <div className={styles.socialTextBlock}>
                <span className={styles.socialLabel}>YouTube</span>
                <span className={styles.socialHandle}>@maddycustom</span>
                <span className={styles.socialDesc}>Installs • Showcases • Guides</span>
              </div>
            </motion.a>
          </div>
        </motion.section>

        {/* Products Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className={styles.productsSection}
        >
          <Typography className={styles.productsTitle}>
            Customer Favorites
          </Typography>
          <Typography className={styles.productsSubtext}>
            Ready to transform your ride? Explore our most popular designs that have captivated thousands 
            of customers. These bestsellers aren&apos;t just accessories—they&apos;re statements.
          </Typography>
          <Box className={styles.productsWrapper}>
            <TopBoughtProducts hideHeading={true} />
          </Box>
        </motion.div>

        {/* Final CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className={styles.finalCTA}
        >
          <Typography className={styles.ctaHashtag}>
            #OwnUniqueness
          </Typography>
        </motion.div>

      </Container>
    </Box>
  );
};

export default AboutPage;
