import React from 'react'
import styles from './tnc.module.css'
import ContactUs from '@/components/layouts/ContactUs'
import { createMetadata } from '@/lib/metadata/create-metadata';


export async function generateMetadata() {
    return createMetadata({
        title: 'Terms & Conditions - Maddy Custom',
        canonical: 'https://www.maddycustom.com/termsandconditions',
    });
}


const index = () => {
    return (
        <div>
            <div style={{ minHeight: '100vh', display: "flex", flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className={styles.mainC}>
                    <h1 className={styles.mainH}>Replacement Policy</h1>
                    <section className={styles.sec}>
                        <p>
                            At Maddycustom, we stand by the quality of our motorcycle decals. If you encounter any wear, tear, or physical defects within 2-3 days of receiving your order, our replacement process ensures a swift resolution. Simply contact our customer support team, provide details and, upon verification, we&apos;ll authorize a hassle-free replacement. Your satisfaction is paramount, and we&apos;re here to ensure your ride with our decals is nothing short of perfection.
                            Thank you for choosing Maddycustom, where quality meets satisfaction on the road.
                            Maddycustom Team
                        </p>

                    </section>
                    <h2 className={styles.hashtag}>#OWN UNIQUENESS</h2>
                </div>
                {/* <ContactUs /> */}
            </div>
        </div>
    )
}

export default index