import Link from "next/link";
import styles from "./styles/ProductCategorySlider.module.css";
import Image from "next/image";

const ProductCategorySlider = ({ position = "default" }) => {
  const cardData = [
    { name: "Pillar Wraps", link: "/shop/wraps/car-wraps/window-pillar-wraps/win-wraps", image: "/assets/icons/half_helmet.png" },
    { name: "Air Freshener", link: "/shop/accessories/car-care/car-air-freshners/hanging-bottle-car-fresheners" },
    { name: "Tank Wraps", link: "/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps" },
    { name: "Bonnet Wraps", link: "/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps" },
  ];

  // Determine CSS class based on position for CSS-based show/hide
  const positionClass = position === "aboveHero" 
    ? styles.aboveHero 
    : position === "belowHero" 
      ? styles.belowHero 
      : "";

  return (
    <div className={`${styles.cardContainer} ${positionClass}`}>
      <div className={styles.cardRow}>
        {cardData.map((item, index) => (
          <Link href={item.link} key={index} className={styles.cardLink}>
            <div className={styles.card} style={{ paddingLeft: item.image ? 0 : undefined }}>
              {item.image && (
                <Image 
                  src={`https://d26w01jhwuuxpo.cloudfront.net${item.image}`} 
                  alt={item.name} 
                  width={40} 
                  height={40} 
                  className={styles.cardImg}
                  priority
                />
              )}
              <span className={styles.cardText}>{item.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ProductCategorySlider;

