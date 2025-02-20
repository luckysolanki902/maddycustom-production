import React from 'react';
import styles from './styles/chatwithus.module.css';
import Image from 'next/image';
// import { contactFbq } from '@/utils/FacebookPixel'; // Adjust the import path as needed
import Link from 'next/link';

const Chatwithus = () => {
  const handleChatClick = async () => {
    // await contactFbq(); // Call the contact function
  };

  return (
    <div className={styles.parent}>
      <Link href={'https://wa.me/8112673988'} onClick={handleChatClick}>
        <Image className={styles.chatwithus} src={'/images/icons/chatwithus.png'} width={700} height={200} alt='chat with us' />
      </Link>
    </div>
  );
};

export default Chatwithus;
