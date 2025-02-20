// components/full-page-comps/ChooseCategory.js

'use client';

import { useSelector } from 'react-redux';
import styles from './styles/chooseCategory.module.css';
import Image from 'next/image';
import Link from 'next/link';

const ChooseCategory = () => {
    const baseurl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    // Define the categoryId for "Tank Wraps"
    const TANK_WRAP_CATEGORY_ID = '673aea6778c57ec01acae635'; // Replace with the actual category ID

    // Get the pageSlug for "Tank Wraps" from Redux
    const tankWrapPreference = useSelector((state) => state.variantPreference[TANK_WRAP_CATEGORY_ID]);
    const tankWrapPageSlug = tankWrapPreference?.pageSlug || '/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps';

    return (
        <>
            <div className={styles.chooseContainer}>

                {/* Graphic Helmets */}
                <div className={styles.mainCard}>
                    <Link href={'/shop/accessories/safety/graphic-helmets/helmet-store'} className={styles.chooseCard}>
                        <div>
                            <Image
                                className={styles.chooseImage}
                                src={`${baseurl}/assets/category-cards/helmetcatalog.jpg`}
                                alt='Graphic Helmets'
                                width={3000}
                                height={3000}
                            />
                        </div>
                    </Link>
                    <div className={styles.name}>Graphic Helmets</div>
                </div>

                {/* Car Pillar Wrap */}
                <div className={styles.mainCard}>
                    <Link href={'/shop/wraps/car-wraps/window-pillar-wraps/win-wraps'} className={styles.chooseCard}>
                        <div>
                            <Image
                                className={styles.chooseImage}
                                src={`${baseurl}/assets/category-cards/win_wrap_category.jpg`}
                                alt='Car Pillar Wraps'
                                width={3000}
                                height={3000}
                            />
                        </div>
                    </Link>
                    <div className={styles.name}>Car Pillar Wrap</div>
                </div>

                {/* Tank Wraps (Dynamic Link) */}
                <div className={styles.mainCard}>
                    <Link href={tankWrapPageSlug} className={styles.chooseCard}>
                        <div>
                            <Image
                                className={styles.chooseImage}
                                src={`${baseurl}/assets/category-cards/tank_wrap_category.jpg`}
                                alt='Tank Wraps'
                                width={3000}
                                height={3000}
                            />
                        </div>
                    </Link>
                    <div className={styles.name}>Tank Wraps</div>
                </div>

                {/* Bonnet Wraps */}
                <div className={styles.mainCard}>
                    <Link href={'/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps'} className={styles.chooseCard}>
                        <div>
                            <Image
                                className={styles.chooseImage}
                                src={`${baseurl}/assets/category-cards/bonnet_wrap_category.jpg`}
                                alt='Bonnet Wraps'
                                width={3000}
                                height={3000}
                            />
                        </div>
                    </Link>
                    <div className={styles.name}>Bonnet Wraps</div>
                </div>

                {/* Fuel Cap Wraps */}
                <div className={styles.mainCard}>
                    <Link href={'/shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol'} className={styles.chooseCard}>
                        <div>
                            <Image
                                className={styles.chooseImage}
                                src={`${baseurl}/assets/category-cards/fuel_cap_wrap1.png`}
                                alt='Fuel Cap Wraps'
                                width={3000}
                                height={3000}
                            />
                        </div>
                    </Link>
                    <div className={styles.name}>Fuel Cap Wraps</div>
                </div>

                {/* More Products */}
                <div className={styles.mainCard}>
                    <div className={styles.chooseCard} id={styles.pcid}>
                        <div>
                            <Image
                                className={styles.chooseImage}
                                src={`${baseurl}/assets/category-cards/more-coming-soom.jpg`}
                                alt='More Products'
                                width={3000}
                                height={3000}
                            />
                        </div>
                    </div>
                    <div className={styles.name}>More Products</div>
                </div>

            </div>
        </>
    );
};

export default ChooseCategory;
