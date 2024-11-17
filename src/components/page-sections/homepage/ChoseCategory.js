"use client"

import styles from './styles/chooseCategory.module.css';
import Image from 'next/image';
import Link from 'next/link';
const ChooseCategory = () => {
    const baseurl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    return (
        <>
            <div className={styles.chooseContainer}>

                <div className={styles.mainCard}>

                    <Link href={'/shop/accessories/safety/graphic-helmets/helmet-store'} className={styles.chooseCard}>
                        <div >
                            <Image className={styles.chooseImage} src={`${baseurl}/assets/category-cards/helmetcatalog.jpg`} alt='bike' width={1500 * 2} height={1500 * 2}></Image>
                        </div>
                    </Link>
                    <div className={styles.name}>Graphic helmets</div>
                </div>

                <div className={styles.mainCard}>

                    <Link href={'/shop/wraps/car-wraps/window-pillar-wraps/win-wraps'} className={styles.chooseCard}>
                        <div >
                            <Image className={styles.chooseImage} src={`${baseurl}/assets/category-cards/win_wrap_category.jpg`} alt='bike' width={1500 * 2} height={1500 * 2}></Image>
                        </div>
                    </Link>
                    <div className={styles.name}>Car pillar
                        wrap</div>

                </div>

                {/* <div className={styles.mainCard}>

                    <Link href={'/bike/tvs-apache'} className={styles.chooseCard}>
                        <div >
                            <Image className={styles.chooseImage} src={`${baseurl}/assets/category-cards/tank_wrap_category.jpg`} alt='bike' width={1500 * 2} height={1500 * 2}></Image>
                        </div>
                    </Link>
                    <div className={styles.name}>Bike venyle wrap</div>

                </div> */}

                <div className={styles.mainCard}>

                    <Link href={'/shop/wraps/bike-wraps/tank-wraps/slim'} className={styles.chooseCard}>
                        <div >
                            <Image className={styles.chooseImage} src={`${baseurl}/assets/category-cards/tank_wrap_category.jpg`} alt='bike' width={1500 * 2} height={1500 * 2}></Image>
                        </div>
                    </Link>
                    <div className={styles.name}>Tank wraps</div>

                </div>

                <div className={styles.mainCard}>

                    <Link href={'/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps'} className={styles.chooseCard}>
                        <div >
                            <Image className={styles.chooseImage} src={`${baseurl}/assets/category-cards/bonnet_wrap_category.jpg`} alt='bike' width={1500 * 2} height={1500 * 2}></Image>
                        </div>
                    </Link>
                    <div className={styles.name}>Bonnet wraps</div>

                </div>

                <div className={styles.mainCard}>

                    <div href={'#'} className={styles.chooseCard} id={styles.pcid}>
                        <div >
                            <Image className={styles.chooseImage} src={`${baseurl}/assets/category-cards/more-coming-soom.jpg`} alt='bike' width={1500 * 2} height={1500 * 2}></Image>
                        </div>
                    </div>
                    <div className={styles.name}>More Products</div>

                </div>

            </div>
        </>
    )
}
export default ChooseCategory;
