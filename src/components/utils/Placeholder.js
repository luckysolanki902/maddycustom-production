import React from 'react';
import styles from './styles/placeh.module.css';
import Image from 'next/image';

const Placeholder = () => {
    return (
        <div>

            <div className={styles.placeCont}>
                <div className={styles.placeholder}>
                    <Image src='/images/assets/gifs/helmetloadinggif.gif' width={2000/10} height={2000/10} style={{width:'50%', height:'auto', objectFit:'cover'}} loop={true} alt='loading' />
                </div>
                <div className={styles.orderPlaceh1}>
                </div>
                <div className={styles.orderPlaceh2}>
                </div>
            </div>
        </div>
    )
}

export default Placeholder
