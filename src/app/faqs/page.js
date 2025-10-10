// Minimal FAQ showcase page (chat bubble still globally available)
'use client';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import FaqShowcaseSection from '@/components/page-sections/Faq/FaqShowcaseSection';
import SupportChatDialog from '@/components/Chat/SupportChatDialog';
import useBackButtonToClose from '@/components/Chat/useBackButtonToClose';

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
  const orderUserId = useSelector(s => s.orderForm.userDetails?.userId);
  const [open, setOpen] = useState(false);
  useBackButtonToClose(open, () => setOpen(false));

  const openChat = () => setOpen(true);
  const closeChat = () => setOpen(false);

  return (
    <main style={{ paddingTop: 10 }}>
      {/* Chat CTA section */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 16px 10px' }}>
        <div style={{
          borderRadius: 28,
          border: '1px solid rgba(45,45,45,0.12)',
          background: 'linear-gradient(180deg, #ffffff, #fafafa)',
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 18px 44px -16px rgba(0,0,0,0.18)'
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2d2d2d', marginBottom: 6 }}>Need more help?</div>
            <div style={{ fontSize: 13.5, color: 'rgba(45,45,45,0.66)', fontWeight: 500 }}>Chat with our assistant for sizing, compatibility and order support.</div>
          </div>
          <button
            onClick={openChat}
            style={{
              background: '#2d2d2d', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 16,
              fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 26px -10px rgba(0,0,0,0.45)'
            }}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            Open Chat
          </button>
        </div>
      </section>

      <FaqShowcaseSection title="FAQs" faqs={faqs} />

      <SupportChatDialog open={open} onClose={closeChat} userId={orderUserId} />
    </main>
  );
}
