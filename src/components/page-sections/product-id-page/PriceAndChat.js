"use client"
// import { contactFbq } from '@/lib/metadata/facebookPixels';
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import styles from './styles/priceandchat.module.css'
import { useMediaQuery } from '@mui/material'



export default function PriceAndChat({ price }) {
    const isSmallDevice = useMediaQuery('(max-width: 1000px)');
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    // const handleChatClick = async () => {
    //     await contactFbq(); // Call the contact function
    // };
    return (
        <div className={styles.priceContainer} >
            {/* Price */}
            <div className={styles.price}>
                <span className={styles.rupee}>₹</span>
                {price}
            </div>

            <div className={styles.flexRowOfferAndChat}>

                <div className={styles.offer5}>
                    <div className={styles.offer5Line1}>
                        5% off
                    </div>
                    <div className={styles.additionalOfferDetails}>

                        <div >valid</div>
                        <div style={{ fontWeight: '600' }}>till {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0))}</div>
                    </div>
                </div>

                {/* Chat with us */}
                {isSmallDevice && <div className={styles.chatwithusMain}>
                    <Link href={'https://wa.me/8112673988'} >
                        <Image className={styles.chatwithus} src={`${imageBaseUrl}/assets/icons/chatwithus.png`} width={1400} height={400} alt='chat with us'></Image>
                    </Link>
                </div>}

            </div>




        </div>
    )
}
