"uses client"
import React from 'react';
import styles from './styles/contact.module.css';
import Image from 'next/image';
import Link from 'next/link';
import { contactFbq } from '@/lib/metadata/facebookPixels';

const ContactUs = () => {
    // const handleContact = async () => {
    //     await contactFbq(); // Call the contact function
    // };
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    return (
        <div id='homecontactdiv'>
            <div className={styles.contactContainer} >
                <div className={styles.contactHeading}>
                    Contact Us
                </div>
                <div className={styles.contactContent}>
                    <span>
                        <Image width={95} height={89} alt='icon' src={`${baseImageUrl}/assets/icons/whatsappwhite.png`} priority={true} />
                    </span>
                    <span style={{ cursor: 'pointer' }} 
                    // onClick={handleContact}
                    >
                        <a className={styles.contactLink} style={{ color: 'white' }} href="tel:8112673988">8112673988</a>
                        {/* <a className={styles.contactLink} style={{ color: 'white' }} href="tel:9027495997">9027495997</a> */}
                    </span>
                </div>
                <div className={styles.contactContent}>
                    <span>
                        <Image width={95} height={89} alt='icon' src={`${baseImageUrl}/assets/icons/mail.png`} priority={true} />
                    </span>
                    <span style={{ cursor: 'pointer' }} 
                    // onClick={handleContact}
                    >
                        <a className={styles.contactLink} style={{ color: 'white' }} href="mailto:contact.maddycustoms@gmail.com">contact.maddycustoms@gmail.com</a>
                    </span>
                </div>
                <div className={styles.contactContent}>
                    <span>
                        <Image width={95} height={89} alt='icon' src={`${baseImageUrl}/assets/icons/instagram.png`} priority={true} />
                    </span>
                    <span style={{ cursor: 'pointer' }} 
                    // onClick={handleContact}
                    >
                        <a className={styles.contactLink} style={{ color: 'white' }} href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==">@maddycustom</a>
                    </span>
                </div>

                <div className={styles.tnc}>
                    <Link href={'/about-us'} style={{ color: 'white', textDecoration: 'none' }} className={styles.contactLink}>About Us</Link> | 
                    <Link href={'/termsandconditions'} style={{ color: 'white', textDecoration: 'none' }} className={styles.contactLink}>Terms and Conditions</Link>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
