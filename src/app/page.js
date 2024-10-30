import HeroSection from '@/components/page-sections/homepage/HeroSection'
import React from 'react'
import styles from '@/styles/page-styles/home.module.css'
import CategorySearchBox from '@/components/page-sections/utilities/CategorySearchBox'
import ChooseCategory from '@/components/page-sections/utilities/ChoseCategory'
import Sidebar from '@/components/page-sections/utilities/Sidebar'
import ProductCard from '@/components/cards/ProductCard'
import MainPage from '@/components/cards/mainPage'
export default function page() {
  return (
    <>
    <Sidebar/>
      <main>
        {/* Logo and Main Carousel */}
        <HeroSection />
        {/* SearchBox */}
        <div className={styles.chooseDiv}>CHOOSE</div>
        <CategorySearchBox />
        {/* Category cards like Helmet, Tank, Bonnet to choose from */}
        <ChooseCategory />
    <MainPage/>

      </main>
    </>
  )
}
