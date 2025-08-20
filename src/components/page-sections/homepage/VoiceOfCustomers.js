"use client";

import React from "react";
import Image from "next/image";
import styles from "./styles/VoiceOfCustomers.module.css";
import InstagramIcon from "@mui/icons-material/Instagram";
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';

const testimonials = [


  {

    handle: "@the_venom_4.0",

    avatar: "6fkITk9WjM.jpg",

    comment: "Great wrap quality and my bike looks amazing now. Really happy with the work!",

    name: 'Sandeep Kumar'

  },


  {

    handle: "@rider_4u_",

    avatar: "58nzGUw7Z7.jpg",

    comment: "Super happy with how my bike looks. The team did a great job!",

    name: 'Khilan Nathwani'

  },


  {

    handle: "@iam_v.jay",

    avatar: "jK5eub3DcY.jpg",

    comment: "My car looks brand new! Everyone asks where I got it wrapped.",

    name: 'Vijay Jangid'

  },


  {

    handle: "@riderkundan07",

    avatar: "ob4uxJDsHS.jpg",

    comment: "They really understood what I wanted and made it look awesome.",

    name: 'Kundan Gupta'

  },


  {

    handle: "@the_mudaccer_",

    avatar: "p9WK0DM78c.jpg",

    comment: "My ride looks so much better now. Totally worth it!",

    name: 'Mudasir Mushtaq'

  },


  {

    handle: "@jr_kulkarni_",

    avatar: "rEoO9kH68s.jpg",

    comment: "Very professional and the wrap quality is top notch.",

    name: 'Prathamesh Kulkarni'

  },


  {

    handle: "@pixomonk",

    avatar: "ZKWgUDAT8m.jpg",

    comment: "The wrap looks cool and I get a lot of compliments!",

    name: 'Shivanshu Mishra'

  },


];

export default function VoiceOfOurCustomers() {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>The Voice Of Our Customers</h2>
      <div className={styles.sliderContainer}>
        <Swiper
          modules={[Pagination, Autoplay]}
          spaceBetween={30}
          slidesPerView={1}
          breakpoints={{
            640: {
              slidesPerView: 1,
              spaceBetween: 20,
            },
            768: {
              slidesPerView: 2,
              spaceBetween: 30,
            },
            1024: {
              slidesPerView: 3,
              spaceBetween: 30,
            },
          }}
          pagination={{
            clickable: true,
            dynamicBullets: true,
            dynamicMainBullets: 2,
          }}
          loop={true}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
          }}
          className={styles.mySwiper}
        >
          {testimonials.map((t, i) => {
            // strip leading '@' for the URL
            const instaUser = t.handle.replace(/^@/, "");

            return (
              <SwiperSlide key={i} className={styles.slideWrapper}>
                <div className={styles.card}>
                  <div className={styles.quoteIconTop}>
                    <FormatQuoteIcon />
                  </div>

                  <div className={styles.avatar}>
                    <Image
                      src={`${baseImageUrl}/assets/happy-customers/${t.avatar}`}
                      alt={t.handle}
                      width={80}
                      height={80}
                      className={styles.avatarImg}
                    />
                  </div>

                  <h2 className={styles.CompanyName}>{t.name}</h2>
                  <p className={styles.comment}>{t.comment}</p>

                  <div className={styles.quoteIconBottom}>
                    <FormatQuoteIcon />
                  </div>

                  <div className={styles.iconRow}>
                    <InstagramIcon
                      className={styles.instagramIcon}
                      fontSize="medium"
                    />
                    <a
                      href={`https://instagram.com/${instaUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.handle}
                    >
                      {t.handle}
                    </a>
                  </div>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
}
