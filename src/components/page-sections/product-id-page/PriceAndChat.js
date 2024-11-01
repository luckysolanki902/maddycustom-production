"use client"
import { contactFbq } from '@/lib/metadata/faceboookPixels';
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import styles from './styles/priceandchat.module.css'



export default function PriceAndChat({price}) {
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const handleChatClick = async () => {
        await contactFbq(); // Call the contact function
    };
    return (
        <div className={styles.priceContainer} >
            {/* Price */}
            <div className={styles.price}>
                <span className={styles.rupee}>₹</span>
                {price}
            </div>
            {/* Chat with us */}
            <div className={styles.chatwithusMain}>
                <Link href={'https://wa.me/8112673988'} onClick={handleChatClick}>
                    <Image className={styles.chatwithus} src={`${imageBaseUrl}/assets/icons/chatwithus.png`} width={1400} height={400} alt='chat with us'></Image>
                </Link>
            </div>
        </div>
    )
}
