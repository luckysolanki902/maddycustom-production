// Minimal FAQ showcase page (chat bubble still globally available)
'use client';
import React from 'react';
import FaqShowcaseSection from '@/components/page-sections/Faq/FaqShowcaseSection';
import FaqPageChat from '@/components/Chat/FaqPageChat';

// Example FAQ data (could be sourced from existing faqData util or CMS)
const faqs = [
  { title: 'How long does shipping typically take?', content: 'Most orders dispatch within 48h. Transit is 5–7 days pan India; remote zones can extend to ~10 days.' },
  { title: 'Will the wrap fit my specific car model?', content: 'We design with generous safe bleed regions so trimming makes it adaptable to most hatchbacks & sedans. For rare body lines, chat with us.' },
  { title: 'Bike tank wrap sizing guidance?', content: 'Slim = café / commuter, Medium = Classic / mid-size cruisers, Wide = large cruisers & adventure. Send a photo in chat if unsure.' },
  { title: 'How durable are your wraps?', content: 'With proper surface prep + post heat, life expectancy is 5+ years. UV-stable inks & laminate resist typical fading.' },
  { title: 'Can I remove the wrap without damaging paint?', content: 'Yes. Gentle heat and a low, consistent peel angle preserves OEM clear coat when paint is original & healthy.' },
  { title: 'Aftercare best practices?', content: 'Hand wash after 7 days cure. pH-neutral shampoo, no abrasive pads. Avoid pressure jet closer than 12–14 inches.' },
  { title: 'Order tracking not updating?', content: 'Sometimes courier scans lag 12–24h. If still stale, drop the order ID in chat—we escalate directly.' },
  { title: 'What if I received a damaged item?', content: 'Photograph packaging + product on arrival and reach us within 48h; we prioritize swift replacements.' },
];

export default function FaqsPage() {
  return (
    <main style={{ paddingTop: 10 }}>
      <FaqPageChat />
      <FaqShowcaseSection title="FAQs" faqs={faqs} />
    </main>
  );
}
