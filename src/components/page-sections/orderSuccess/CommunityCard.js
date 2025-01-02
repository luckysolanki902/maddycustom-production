'use client';
import React from 'react';
import styles from './styles/communitycard.module.css';
import Image from 'next/image';
import { useRouter } from 'next/navigation';


function CommunityCard() {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const router = useRouter();
  const handleJoinClick = () => {
    router.push('https://chat.whatsapp.com/JWNobG6xRj12apxysk0P7g')
  };

  return (
    <div className={styles.main}>

      <div className={styles.card} >
        {/* Left side with the image */}
        <Image
          width={400}
          height={400}
          src={`${baseImageUrl}/assets/illustrations/pink-car.png`}
          alt="Car Illustration"
          className={styles.cardImage}
        />
        {/* Right side with the text/content */}
        <div className={styles.cardContent}>
          <div className={styles.cardTitle}>
            
            <h2>🌟 Join Our Exclusive Riders Community!🌟</h2>

            <Image
              height={100}
              width={100}
              className={styles.waIcon}
              src={`${baseImageUrl}/assets/icons/whatsapp.png`}
              alt="WhatsApp Icon"
            />
          </div>
          <ul className={styles.cardBenefits}>
            <li>💬 Be the first to know about new launches &amp; discounts</li>
            <li>🎁 Get exclusive deals and rewards only for community members</li>
            <li>❤️ Connect with like-minded people</li>
          </ul>
          <button className={styles.joinButton} onClick={handleJoinClick}>
            Join Now!
          </button>
        </div>


      </div>
    </div>
  );
}

export default CommunityCard;
