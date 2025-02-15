"use client";

import React, { useState } from "react";
import styles from "./styles/footer.module.css";
import Image from "next/image";
import Link from "next/link";
import LocationOnIcon from '@mui/icons-material/LocationOn';

const Footer = () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const [showCategories, setShowCategories] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Logo and Description */}
        <div className={styles.brandSection}>
            <div className={styles.logoContainer}>
        <Image
                    className={styles.logoImg}
                    // src={`${baseUrl}/assets/logos/maddycustom-old-full-logo-horizontal.png`}
                    src={`${baseImageUrl}/assets/logos/maddy_custom3_main_logo.png`}
                    alt='maddylogo'
                    title='maddylogo'
                    width={150}
                    height={70}
                    priority={true}
                />
              <div className={styles.contactIcons}>
    <Link href="tel:8112673988"><Image width={25} height={25}  alt='icon' src={`${baseImageUrl}/assets/icons/whatsappwhite.png`} priority={true} style={{verticalAlign: 'middle', marginRight: '10px'}} /></Link>
    <Link href="mailto:contact.maddycustoms@gmail.com">  <Image width={25} height={25}alt='icon' src={`${baseImageUrl}/assets/icons/mail.png`} priority={true} style={{verticalAlign: 'middle', marginRight: '10px'}}/>  </Link>
    <Link href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg=="> <Image width={25} height={25} alt='icon' src={`${baseImageUrl}/assets/icons/instagram.png`} priority={true} style={{verticalAlign: 'middle', marginRight: '10px'}} /></Link>
    <Link href="#"> <LocationOnIcon sx={{color: 'white',fontSize: '25px',verticalAlign: 'middle', marginRight: '10px'}}/></Link>
  </div>
  </div>
          <p className={styles.tagline}>
            Timelessly inspired, endlessly enhanced - we customize wraps for you
          </p>
          <div className={styles.subscribe}>
            <input
              type="email"
              placeholder="Subscribe to get latest product arrivals"
              className={styles.subscribeInput}
            //   style={{ placeholder: { color: "#fff" } }}
            />
            
            <button className={styles.subscribeButton}>SUBSCRIBE</button>
          </div>
        </div>


        <div className={`${styles.sectionContainer}`}>
        {/* Categories Section */}
        
        <div className={styles.section}>
        <h3 onClick={() => setShowCategories(!showCategories)} className={styles.dropdownTitle}
>

  Categories <span className={styles.dropdownIcon}>{showCategories ? "▲" : "▼"}</span>
</h3>
<ul className={`${styles.categoryList} ${showCategories ? styles.show : ""}`}>
  <li><Link href="#">All Product</Link></li>
  <li><Link href="shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps">Bonnet Wrap</Link></li>
  <li><Link href="/shop/wraps/car-wraps/window-pillar-wraps/win-wraps">Car Pillar Wrap</Link></li>
  <li><Link href="/shop/accessories/safety/graphic-helmets/helmet-store">Helmet Wrap</Link></li>
  <li><Link href="/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps">Tank Wrap</Link></li>
  <li><Link href="#">More to come</Link></li>
</ul>

          
        </div>

        {/* Useful Links Section */}
        <div className={styles.section}>
          <h3 onClick={() => setShowLinks(!showLinks)} className={styles.dropdownTitle}>
            Useful Links <span className={styles.dropdownIcon}>{showLinks ? "▲" : "▼"}</span>
          </h3>
          
            <ul className={`${styles.usefulLinks} ${showLinks ? styles.show : ""}` } >
              <li><Link href="#">My Account</Link></li>
              <li><Link href={'/about-us'} >Contact Us</Link></li>
              <li><Link href={'/termsandconditions'}>Terms of Service</Link></li>
              <li><Link href={'/termsandconditions'}>Terms And Conditions</Link></li>
              <li><Link href={'/termsandconditions'}>Privacy Policy</Link></li>
            </ul>
          
        </div>
        </div>

        {/* Contact Section - Hidden on Mobile */}
        <div className={`${styles.section} ${styles.contactSection}`}>
          <h3>Contact</h3>
          <ul>
            <li><span>
                <Image width={25} height={25}alt='icon' src={`${baseImageUrl}/assets/icons/mail.png`} priority={true} style={{verticalAlign: 'middle', marginRight: '10px'}}/>  
            <a className={styles.contactLink} style={{ color: 'white' }} href="mailto:contact.maddycustoms@gmail.com">contact.maddycustoms@gmail.com</a></span></li>
<li> <span>
                        <Image width={25} height={25} alt='icon' src={`${baseImageUrl}/assets/icons/instagram.png`} priority={true} style={{verticalAlign: 'middle', marginRight: '10px'}} />
                     <a className={styles.contactLink} style={{ color: 'white' }} href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==">@maddycustom</a></span></li>
            <li> <span>
                        <Image width={25} height={25}  alt='icon' src={`${baseImageUrl}/assets/icons/whatsappwhite.png`} priority={true} style={{verticalAlign: 'middle', marginRight: '10px'}} />
                        <a className={styles.contactLink} style={{ color: 'white', verticalAlign: 'middle' }} href="tel:8112673988">8112673988</a> </span></li>
            <li> <a className={styles.contactLink} style={{ color: 'white' }} href=""> <LocationOnIcon sx={{color: 'white',fontSize: '25px',verticalAlign: 'middle', marginRight: '10px'}}/> VIP Rd, Kasimpur Patri, Tiwaripur, Lucknow, UP 226005</a> </li>
          </ul>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>©MaddyCustom since 2021. All Rights Reserved</p>
      </div>
    </footer>
  );
};

export default Footer;
