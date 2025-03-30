import React from 'react';
import styles from './styles/chatwithus.module.css';
import Image from 'next/image';
import Link from 'next/link';

const ChatwithusFloater = () => {
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <div className={styles.parent}>
      <Link href={'/faqs'}>
        <Image className={styles.chatwithus} src={`${baseImageUrl}/assets/icons/chatwithus.png`} width={700} height={200} alt='chat with us' />
      </Link>
    </div>
  );
};

export default ChatwithusFloater;
