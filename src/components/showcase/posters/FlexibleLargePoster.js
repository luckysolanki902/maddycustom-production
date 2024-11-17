"use client"
import { useMediaQuery } from '@mui/material';
import Image from 'next/image'
import React from 'react'
import styles from './styles/flexiblelargeposter.module.css'
import Link from 'next/link';


export default function FlexibleLargePoster({imageSlugForPc, imageSlugForPhone, link}) {
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    const isSmallScreen = useMediaQuery('(max-width: 600px)');
    return (
        <div className={styles.bigPoster}>
            <Link href={link}>
                {!isSmallScreen ?
                    <Image src={`${baseImageUrl}/assets/posters/${imageSlugForPc}.jpg`} alt="image1" width={1242} height={547} style={{ width: '100%', height: 'auto' }} />
                    :
                    <Image src={`${baseImageUrl}/assets/posters/${imageSlugForPhone}.jpg`} alt="image1" width={1242} height={547} style={{ width: '100%', height: 'auto' }} />

                }
            </Link>
        </div>)
}
