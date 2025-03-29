'use client';
import React, { useState } from 'react';
import FaqHeader from '../page-sections/Faq/FaqHeader';
import FaqInputBox from '../page-sections/Faq/FaqInputBox';
import FaqAccordionSection from '../page-sections/Faq/FaqAccordionSection';
import faqData from '@/lib/faq/faqData.json';
import ChatDialog from '../page-sections/Faq/ChatDialog';
import styles from '../page-sections/Faq/styles/Faq.module.css';

const FaqPage = () => {
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [requestId, setRequestId] = useState(null);

  const handleChatResponse = (responseText, reqId) => {
    setChatResponse(responseText);
    setRequestId(reqId);
    setChatDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setChatDialogOpen(false);
  };

  const handleReopenChat = () => {
    // Reopens the same dialog with the existing response & request ID
    setChatDialogOpen(true);
  };

  return (
    <div className={styles.main}>
      <FaqHeader />
      
      <FaqInputBox
        onChatResponse={handleChatResponse}
        onReopenChat={handleReopenChat}
      />
      
      <div className={styles.faqPage}>
        <h1 className={styles.faqHeading}>FAQs</h1>
        <div className={styles.faqRow}>
          {faqData.faqSections.map((section, index) => (
            <FaqAccordionSection
              key={index}
              productTitle={section.productTitle}
              faqData={section.faqs}
            />
          ))}
        </div>
      </div>

      <ChatDialog
        open={chatDialogOpen}
        onClose={handleCloseDialog}
        message={chatResponse}
        requestId={requestId}
      />
    </div>
  );
};

export default FaqPage;
