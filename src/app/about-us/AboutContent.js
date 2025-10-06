'use client';

import Link from 'next/link';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import { AnimatedReveal } from './AnimatedReveal';
import styles from './about.module.css';

// Pillar data (The Vision / The Craft / The Community)
const pillars = [
  {
    id: 'vision',
    number: '01',
    title: 'The Vision',
    highlight: 'storytelling',
    paragraphs: [
      "MaddyCustom was born from a simple yet powerful vision: to transform vehicle customization into a cohesive act of storytelling.",
      "We don't just sell accessories; we build narratives. We meticulously design and curate themed collections where every exterior wrap perfectly complements the interior accessories.",
      "From a bold bonnet design to a matching steering cover, each product is a chapter in a single story." 
    ],
  },
  {
    id: 'craft',
    number: '02',
    title: 'The Craft',
    highlight: 'premium materials',
    paragraphs: [
      "Each piece is crafted with premium materials to ensure your vision lasts and your statement is clear.",
      "Quality isn't just a promise—it's woven into every product we create.",
      "We push the boundaries of design and give you tools to create a ride that's unmistakably, authentically yours." 
    ],
  },
  {
    id: 'community',
    number: '03',
    title: 'The Community',
    highlight: 'creators',
    paragraphs: [
      "Our brand is for the creators, the trendsetters, and the rebels who refuse to drive a stock story.",
      "We exist for those who see their car or bike not just as transport, but as a bold extension of who they are.",
      "We empower every driver and rider to turn their vehicle into a masterpiece of personal expression." 
    ],
  }
];

const mission = {
  lead: 'Our ultimate vision is to',
  focus: 'empower every driver and rider',
  tail: 'to turn their vehicle into a masterpiece of personal expression. We are committed to pushing the boundaries of design and providing you with the tools to create a ride that is unmistakably, authentically yours.'
};

export default function AboutContent() {
  return (
    <div className={styles.page}>
      {/* Ambient gradients */}
      <div className={styles.glowTop} aria-hidden="true" />
      <div className={styles.glowBottom} aria-hidden="true" />
      <div className={styles.inner}>
        {/* Hero */}
        <section className={styles.heroSection}>
          <AnimatedReveal>
            <span className={styles.sectionLabel}># About Us</span>
          </AnimatedReveal>
          <AnimatedReveal delay={0.1}>
            <h1 className={styles.heroTitle}>MaddyCustom: Your Story. Your Ride.</h1>
          </AnimatedReveal>
        </section>

        {/* Pillars Grid */}
        <section className={styles.pillarsSection} aria-labelledby="pillars-heading">
          <AnimatedReveal>
            <h2 id="pillars-heading" className={styles.pillarsHeading}>Our Core</h2>
          </AnimatedReveal>
          <div className={styles.pillarsGrid}>
            {pillars.map((pillar, index) => (
              <AnimatedReveal key={pillar.id} delay={0.12 * index}>
                <article className={styles.pillarCard} data-number={pillar.number}>
                  <header className={styles.pillarHeader}>
                    <div className={styles.pillarIndex}>{pillar.number}</div>
                    <h3 className={styles.pillarTitle}>{pillar.title}</h3>
                  </header>
                  <div className={styles.pillarBody}>
                    {pillar.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  <div className={styles.pillarAccent} />
                </article>
              </AnimatedReveal>
            ))}
          </div>
        </section>

        {/* Mission Panel (Minimal Creative) */}
        <AnimatedReveal delay={0.1}>
          <section className={styles.missionPanel} aria-label="Mission Statement">
            <div className={styles.missionInner}>
              <h2 className={styles.missionHeading}>
                <span className={styles.missionLead}>{mission.lead}</span>
                <span className={styles.missionFocus}>{mission.focus}</span>
              </h2>
              <p className={styles.missionCopy}>{mission.tail}</p>
            </div>
            <div className={styles.missionFrame} aria-hidden="true" />
          </section>
        </AnimatedReveal>

        {/* Closing Module */}
        <AnimatedReveal delay={0.18}>
          <section className={styles.closingModule} aria-label="Closing Brand Statement">
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
          </section>
        </AnimatedReveal>

        {/* Social (Refined Minimal Cards) */}
        <section className={styles.socialShowcase} aria-labelledby="social-heading">
          <AnimatedReveal delay={0.15}>
            <h2 id="social-heading" className={styles.socialHeading}>Join Our Community</h2>
          </AnimatedReveal>
          <div className={styles.socialGrid}>
            <AnimatedReveal delay={0.2}>
              <Link
                href="https://www.instagram.com/maddycustom/"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.socialMinimal} ${styles.instagramMinimal}`}
                aria-label="Follow us on Instagram"
              >
                <div className={styles.socialIconShell}>
                  <InstagramIcon fontSize="inherit" />
                </div>
                <div className={styles.socialTextBlock}>
                  <span className={styles.socialLabel}>Instagram</span>
                  <span className={styles.socialHandle}>@maddycustom</span>
                  <span className={styles.socialDesc}>Stories • Collections • Transformations</span>
                </div>
              </Link>
            </AnimatedReveal>
            <AnimatedReveal delay={0.3}>
              <Link
                href="https://www.youtube.com/@maddycustom"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.socialMinimal} ${styles.youtubeMinimal}`}
                aria-label="Subscribe on YouTube"
              >
                <div className={styles.socialIconShell}>
                  <YouTubeIcon fontSize="inherit" />
                </div>
                <div className={styles.socialTextBlock}>
                  <span className={styles.socialLabel}>YouTube</span>
                  <span className={styles.socialHandle}>@maddycustom</span>
                  <span className={styles.socialDesc}>Installs • Showcases • Guides</span>
                </div>
              </Link>
            </AnimatedReveal>
          </div>
        </section>
      </div>
    </div>
  );
}
