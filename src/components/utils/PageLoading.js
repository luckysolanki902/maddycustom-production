// @/app/components/utils/PageLoading.js
'use client';

import Image from 'next/image';
import React from 'react';

export default function PageLoading() {
    return (
        <div
            style={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: '99999',
                position: 'fixed',
                top: '0',
                left: '0',
                backgroundColor: 'white',
            }}
        >
            <Image
                src={'/images/assets/gifs/helmetloadinggif.gif'}
                width={667}
                height={667}
                priority
                loading='eager'
                style={{
                    width: '350px',
                    height: 'auto',
                    objectFit: 'cover',
                }}
                alt={'loading'}
            />
        </div>
    );
}
