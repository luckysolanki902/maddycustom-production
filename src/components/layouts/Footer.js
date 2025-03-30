'use client';

import React, { useState } from "react";
import axios from "axios";
import styles from "./styles/footer.module.css";
import Image from "next/image";
import Link from "next/link";

// MUI imports
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { usePathname, useRouter } from "next/navigation";

const Footer = () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isMobile = useMediaQuery("(max-width:600px)");
  const pathname = usePathname();

  const router = useRouter()

  // Subscription state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    // Basic validation: Ensure 10 digits
    if (!/^\d{10}$/.test(phoneNumber)) {
      setSubscriptionMessage("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    setSubscriptionMessage("");
    try {
      const response = await axios.post("/api/user/create", {
        phoneNumber,
        source: "footer-subscribe",
      });

      if (response.data.message === "User already exists") {
        setSubscriptionMessage("Already subscribed!");
        setPhoneNumber("");

      } else if (response.data.message === "User exists and name updated") {
        setSubscriptionMessage("Already subscribed!");
        setPhoneNumber("");

      } else if (response.data.message === "User created successfully") {
        setSubscriptionMessage("Thank you for subscribing!");
        setPhoneNumber("");
      }
      else {
        setSubscriptionMessage("Subscription failed. Please try again.");
      }
    } catch (error) {
      console.error("Subscription error:", error.message);
      setSubscriptionMessage("Could not subscribe. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // MOBILE ACCORDIONS
  const mobileAccordionForCategories = (
    <Accordion
      disableGutters
      sx={{
        backgroundColor: "transparent",
        color: "#fff",
        boxShadow: "none",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: "#fff" }} />}
        sx={{
          minHeight: "48px",
          "&.Mui-expanded": { minHeight: "48px" },
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: "bold", textTransform: "uppercase" }}
        >
          Categories
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ paddingTop: 0 }}>
        <ul className={styles.categoryList}>
          <li>
            <Link href="/shop/accessories/car-care/car-air-freshners/hanging-bottle-car-fresheners">
              Car Fresheners
            </Link>
          </li>
          <li>
            <Link href="/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps">
              Bonnet Wrap
            </Link>
          </li>
          <li>
            <Link href="/shop/wraps/car-wraps/window-pillar-wraps/win-wraps">
              Car Pillar Wrap
            </Link>
          </li>
          <li>
            <Link href="/shop/accessories/safety/graphic-helmets/helmet-store">
              Helmet Wrap
            </Link>
          </li>
          <li>
            <Link href="/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps">
              Tank Wrap
            </Link>
          </li>
          <li>
            <Link href="#">More to come</Link>
          </li>
        </ul>
      </AccordionDetails>
    </Accordion>
  );

  const mobileAccordionForLinks = (
    <Accordion
      disableGutters
      sx={{
        backgroundColor: "transparent",
        color: "#fff",
        boxShadow: "none",
        marginTop: '-1rem',
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: "#fff" }} />}
        sx={{
          minHeight: "48px",
          "&.Mui-expanded": { minHeight: "48px" },
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: "bold", textTransform: "uppercase" }}
        >
          Useful Links
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ paddingTop: 0 }}>
        <ul className={styles.usefulLinks}>
          {/* <li>
            <Link href="#">My Account</Link>
          </li> */}
          <li>
            <Link href={"/about-us"}>About Us</Link>
          </li>

          <li>
            <Link href={"/termsandconditions"}>Terms And Conditions</Link>
          </li>

          <li>
            <Link href={"/orders/track"}>Track Your Order</Link>
          </li>

        </ul>
      </AccordionDetails>
    </Accordion>
  );

  // DESKTOP STATIC CONTENT
  const desktopCategories = (
    <div className={styles.desktopColumn}>
      <h3>Categories</h3>
      <ul className={styles.categoryList}>
        <li>
          <Link href="#">All Product</Link>
        </li>
        <li>
          <Link href="shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps">
            Bonnet Wrap
          </Link>
        </li>
        <li>
          <Link href="/shop/wraps/car-wraps/window-pillar-wraps/win-wraps">
            Car Pillar Wrap
          </Link>
        </li>
        <li>
          <Link href="/shop/accessories/safety/graphic-helmets/helmet-store">
            Helmet Wrap
          </Link>
        </li>
        <li>
          <Link href="/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps">
            Tank Wrap
          </Link>
        </li>
        <li>
          <Link href="#">More to come</Link>
        </li>
      </ul>
    </div>
  );

  const desktopLinks = (
    <div className={styles.desktopColumn}>
      <h3>Useful Links</h3>
      <ul className={styles.usefulLinks}>

        <li>
          <Link href={"/about-us"}>About Us</Link>
        </li>

        <li>
          <Link href={"/termsandconditions"}>Terms And Conditions</Link>
        </li>

        <li>
          <Link href={"/orders/track"}>Track Your Order</Link>
        </li>
      </ul>
    </div>
  );
  if (pathname === '/viewcart') {
    return null;
  }
  else {
    return (
      <footer className={styles.footer} id='homecontactdiv'>
        <div className={styles.footerGrid}>
          {/* Brand & Subscribe (Column 1) */}
          <div className={`${styles.brandSection} ${styles.desktopColumn}`}>
            <div className={styles.logoContainer}>
              <Image
                onClick={() => router.push('/')}
                className={styles.logoImg}
                src={`${baseImageUrl}/assets/logos/maddy_custom3_main_logo.png`}
                alt="maddylogo"
                title="maddylogo"
                width={150}
                height={70}
                priority={true}

              />
              <div className={styles.contactIcons}>
                <Link href="https://wa.me/8112673988">
                  <Image
                    width={25}
                    height={25}
                    alt="icon"
                    src={`${baseImageUrl}/assets/icons/whatsappwhite.png`}
                    priority={true}
                    style={{ verticalAlign: "middle", marginRight: "10px" }}
                  />
                </Link>
                <Link href="mailto:contact.maddycustoms@gmail.com">
                  <Image
                    width={25}
                    height={25}
                    alt="icon"
                    src={`${baseImageUrl}/assets/icons/mail.png`}
                    priority={true}
                    style={{ verticalAlign: "middle", marginRight: "10px" }}
                  />
                </Link>
                <Link href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==">
                  <Image
                    width={25}
                    height={25}
                    alt="icon"
                    src={`${baseImageUrl}/assets/icons/instagram.png`}
                    priority={true}
                    style={{ verticalAlign: "middle", marginRight: "10px" }}
                  />
                </Link>
              </div>
            </div>
            <p className={styles.tagline}>
              {/* Timelessly inspired, {isMobile ? <br /> : ""} endlessly enhanced, we customize rides for you */}
              Drive what defines you!
            </p>
            <form className={styles.subscribe} onSubmit={handleSubscribe}>
              <input
                type="tel"
                placeholder="Enter your 10-digit mobile number"
                className={styles.subscribeInput}
                value={phoneNumber}
                onChange={(e) => {
                  // Allow only digits
                  const numeric = e.target.value.replace(/\D/g, "");
                  setPhoneNumber(numeric);
                }}
                maxLength={10}
                required
              />
              <button
                type="submit"
                className={styles.subscribeButton}
                disabled={loading}
              >
                {loading ? "Submitting..." : "SUBSCRIBE"}
              </button>
            </form>
            {subscriptionMessage && (
              <p style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.9rem" }}>
                {subscriptionMessage}
              </p>
            )}
          </div>

          {/* Categories (Column 2) */}
          {isMobile && <Link style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }} href="">
            <LocationOnIcon
              sx={{
                color: "white",
                fontSize: "25px",
                verticalAlign: "middle",
              }}
            />
            <span>
              {`   VIP Rd, Kasimpur Patri, Tiwaripur, Lucknow, UP (226005) `}
            </span>
          </Link>}
          {isMobile ? mobileAccordionForCategories : desktopCategories}

          {/* Useful Links (Column 3) */}
          {isMobile ? mobileAccordionForLinks : desktopLinks}

          {/* Contact (Column 4, hidden on mobile via CSS) */}
          <div className={`${styles.contactSection} ${styles.desktopColumn}`}>
            <h3>Contact</h3>
            <ul className={styles.contactList}>
              <li>
                <Link href="mailto:contact.maddycustoms@gmail.com">
                  <Image
                    width={25}
                    height={25}
                    alt="icon"
                    src={`${baseImageUrl}/assets/icons/mail.png`}
                    priority={true}
                  />
                  <span>contact.maddycustoms@gmail.com</span>
                </Link>
              </li>
              <li>
                <Link href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==">
                  <Image
                    width={25}
                    height={25}
                    alt="icon"
                    src={`${baseImageUrl}/assets/icons/instagram.png`}
                    priority={true}
                  />
                  <span>@maddycustom</span>
                </Link>
              </li>
              <li>
                <Link href="https://wa.me/8112673988">
                  <Image
                    width={25}
                    height={25}
                    alt="icon"
                    src={`${baseImageUrl}/assets/icons/whatsappwhite.png`}
                    priority={true}
                  />
                  <span>8112673988</span>
                </Link>
              </li>
              <li>
                <Link href="">
                  <LocationOnIcon
                    sx={{
                      color: "white",
                      fontSize: "25px",
                      verticalAlign: "middle",
                    }}
                  />
                  <span>
                    VIP Rd, Kasimpur Patri, Tiwaripur, Lucknow, UP 226005
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* <div className={styles.footerBottom}>
        <p>©MaddyCustom since 2021. All Rights Reserved</p>
      </div> */}
      </footer>
    );
  }
};

export default Footer;
