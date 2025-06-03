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

// Define the links in one place
const categories = [
  {
    href: "/shop/accessories/car-care/car-air-freshners/hanging-bottle-car-fresheners",
    label: "Car Fresheners",
  },
  {
    href: "/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps",
    label: "Bonnet Wrap",
  },
  {
    href: "/shop/wraps/car-wraps/window-pillar-wraps/win-wraps",
    label: "Car Pillar Wrap",
  },
  {
    href: "#",
    label: "More to come",
  },
];

const usefulLinks = [
  { href: "/about-us", label: "About Us" },
  { href: "/termsandconditions", label: "Refunds and Replacements" },
  { href: "/orders/track", label: "Track Your Order" },
  { href: "/faqs", label: "FAQs and Support" },
  { href: "/contact-us", label: "Contact Us" },
];

const mapUserInBackground = (userId, phoneNumber, email) => {
  // Fire and forget - won't block UI
  fetch('http://tracker.wigzopush.com/rest/v1/learn/identify?token=966a282624127d21db2e233493a&org_token=JWF0V4pWQtjrX52Qg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: userId || phoneNumber, // Use phoneNumber as fallback ID if no userId
      phone: phoneNumber,
      email: email || undefined,
      is_active: true,
      source: 'web'
    }),
    signal: AbortSignal.timeout(5000) // 5-second timeout
  }).then(response => {
  }).catch(error => {
    console.error('Background user mapping failed for footer:', error);
    // Silent fail - won't impact user experience
  });
};

const Footer = () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isMobile = useMediaQuery("(max-width:600px)");
  const pathname = usePathname();
  const router = useRouter();

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

      if (
        response.data.message === "User already exists" ||
        response.data.message === "User exists and name updated" ||
        response.data.message === "User exists and userId assigned"
      ) {
        setSubscriptionMessage("Already subscribed!");
        setPhoneNumber("");
        if (response.data.user && response.data.user.userUuid) {
        mapUserInBackground(
          response.data.user.userUuid,
          phoneNumber,
          response.data.user.email
        );
      }
      } else if (response.data.message === "User created successfully") {
        setSubscriptionMessage("Thank you for subscribing!");
        setPhoneNumber("");
        if (response.data.user && response.data.user.userUuid) {
        mapUserInBackground(
          response.data.user.userUuid,
          phoneNumber,
          response.data.user.email
        );
      }
      } else {
        setSubscriptionMessage("Subscription failed. Please try again.");
      }
    } catch (error) {
      setSubscriptionMessage("Could not subscribe. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to render lists
  const renderLinkList = (linksArray, listClass) => (
    <ul className={listClass}>
      {linksArray.map((link, index) => (
        <li key={index}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );

  // Mobile accordions for categories and useful links
  const mobileAccordion = (title, linksArray, listClass) => (
    <Accordion
      disableGutters
      sx={{
        backgroundColor: "transparent",
        color: "#fff",
        boxShadow: "none",
        "&:before": { display: "none" },
        marginTop: title === "Useful Links" ? "-1rem" : undefined,
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
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ paddingTop: 0 }}>
        {renderLinkList(linksArray, listClass)}
      </AccordionDetails>
    </Accordion>
  );

  // Desktop static content for categories and useful links
  const desktopSection = (title, linksArray, listClass) => (
    <div className={styles.desktopColumn}>
      <h3>{title}</h3>
      {renderLinkList(linksArray, listClass)}
    </div>
  );

  if (pathname === "/viewcart") {
    return null;
  } else {
    return (
      <footer className={styles.footer} id="homecontactdiv">
        <div className={styles.footerGrid}>
          {/* Brand & Subscribe (Column 1) */}
          <div className={`${styles.brandSection} ${styles.desktopColumn}`}>
            <div className={styles.logoContainer}>
              <Image
                onClick={() => router.push("/")}
                className={styles.logoImg}
                src={`${baseImageUrl}/assets/logos/maddy_custom3_main_logo.png`}
                alt="maddylogo"
                title="maddylogo"
                width={150}
                height={70}
                priority={true}
              />
              <div className={styles.contactIcons}>
                <Link href="https://www.facebook.com/p/Maddycustom-61555047164387/">
                  <Image
                    width={25}
                    height={25}
                    alt="facebook icon"
                    src={`${baseImageUrl}/assets/icons/facebook.png`}
                    priority={true}
                    style={{
                      verticalAlign: "middle",
                      marginRight: "10px",
                    }}
                  />
                </Link>
                <Link href="mailto:contact.maddycustoms@gmail.com">
                  <Image
                    width={25}
                    height={25}
                    alt="mail icon"
                    src={`${baseImageUrl}/assets/icons/mail.png`}
                    priority={true}
                    style={{
                      verticalAlign: "middle",
                      marginRight: "10px",
                    }}
                  />
                </Link>
                <Link href="https://instagram.com/maddycustom?igshid=NGVhN2U2NjQ0Yg==">
                  <Image
                    width={25}
                    height={25}
                    alt="instagram icon"
                    src={`${baseImageUrl}/assets/icons/instagram.png`}
                    priority={true}
                    style={{
                      verticalAlign: "middle",
                      marginRight: "10px",
                    }}
                  />
                </Link>
              </div>
            </div>
            <p className={styles.tagline}>Drive what defines you!</p>
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
              <p
                style={{
                  marginTop: "0.5rem",
                  color: "#fff",
                  fontSize: "0.9rem",
                }}
              >
                {subscriptionMessage}
              </p>
            )}
          </div>

          {/* Categories (Column 2) */}
          {isMobile && (
            <Link
              style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
              href=""
            >
              <LocationOnIcon
                sx={{
                  color: "white",
                  fontSize: "25px",
                  verticalAlign: "middle",
                }}
              />
              <span>
                VIP Rd, Kasimpur Patri, Tiwaripur, Lucknow, UP (226005)
              </span>
            </Link>
          )}

          {/* Useful Links (Column 3) */}
          {isMobile
            ? mobileAccordion("Need Help?", usefulLinks, styles.usefulLinks)
            : desktopSection("Need Help?", usefulLinks, styles.usefulLinks)}

          {isMobile
            ? mobileAccordion("Categories", categories, styles.categoryList)
            : desktopSection("Categories", categories, styles.categoryList)}



          {/* Contact (Column 4, hidden on mobile via CSS) */}
          <div className={`${styles.contactSection} ${styles.desktopColumn}`}>
            <h3>Contact</h3>
            <ul className={styles.contactList}>
              <li>
                <Link href="mailto:contact.maddycustoms@gmail.com">
                  <Image
                    width={25}
                    height={25}
                    alt="mail icon"
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
                    alt="instagram icon"
                    src={`${baseImageUrl}/assets/icons/instagram.png`}
                    priority={true}
                  />
                  <span>@maddycustom</span>
                </Link>
              </li>
              <li>
                <Link href="https://www.facebook.com/p/Maddycustom-61555047164387/">
                  <Image
                    width={25}
                    height={25}
                    alt="whatsapp icon"
                    src={`${baseImageUrl}/assets/icons/facebook.png`}
                    priority={true}
                  />
                  <span>@Maddycustom</span>
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
      </footer>
    );
  }
};

export default Footer;
