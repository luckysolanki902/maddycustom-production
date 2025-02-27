"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import styles from "./styles/topbar.module.css";
import { ShoppingCart, Search } from "@mui/icons-material";
import { useSelector } from "react-redux";
import Badge from "@mui/material/Badge";

const Topbar = () => {
  const [search, setSearch] = useState("");
  const pathname = usePathname(); 
  const router = useRouter(); 
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Get total quantity from Redux
  const items = useSelector((state) => state.cart.items);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className={styles.topbar}>
      {/* Left Side - Logo & Links */}
      <div className={styles.leftSection}>
        {/* Logo */}
        <div className={styles.logo}>
          <Image
            className={styles.logoImg}
            src={`${baseUrl}/assets/logos/maddy_custom3_main_logo.png`}
            alt="maddylogo"
            title="maddylogo"
            width={150}
            height={70}
            priority
          />
        </div>

        {/* Navigation Links */}
        <div className={styles.navLinks}>
          {[
            { text: "Home", href: "/" },
            { text: "Contact Us", href: "/#homecontactdiv" },
            { text: "Track Your Order", href: "/orders/track" },
          ].map((item) => (
            <Link
              key={item.text}
              href={item.href}
              className={`${styles.navItem} ${
                pathname === item.href ? styles.active : ""
              }`}
            >
              {item.text}
            </Link>
          ))}
        </div>
      </div>

      {/* Middle - Search Bar */}
      <div className={styles.searchBox}>
        <Search className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search on MaddyCustom"
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Right Side - Cart Icon with Badge */}
      <div
        className={styles.cartContainer}
        onClick={() => router.push("/viewcart")}
      >
        <Badge badgeContent={totalQuantity} color="info">
          <ShoppingCart className={styles.cartIcon} />
        </Badge>
      </div>
    </nav>
  );
};

export default Topbar;



