export async function createMetadata({
    canonical = 'https://maddycustom.com',
    title = 'Maddy Custom | Personalize Your Ride with Custom Helmets & Wraps',
    description = "Discover Maddy Custom’s extensive collection of vehicle wraps and helmet graphics, designed for unmatched durability and style. Shop now for top-quality, affordable custom wraps, including anime helmets, N160 wraps, car pillar wraps and KTM RC 390 wraps. Transform your ride with unique designs tailored to your taste, from budget-friendly options to premium customizations. Elevate your vehicle's look with our best-selling motorcycle wraps and helmet designs.",
    favicon = '/images/metadata/favicon.ico',
    seoImage = '/images/metadata/logoforlink.png',
    siteName = 'Maddy Custom',
    keywords = [
      'car pillar wraps', 'car pillar b wraps', 'car pillar wrap', 'car wraps', 'n160 wrap',
      'tvs raider wrap', 'pulsar n160 wrap', 'classic 350 wrapping', 'ktm rc 390 wrap',
      'ns 160 wrap', 'r15 v3 monster edition', 'anime helmet', 'motorcycle helmet wraps',
      'car wraps', 'ktm rc 390 price', 'car pillar wraps', 'royal enfield classic 350 wrap',
      'r15 v3 wrap', 'apache rtr 160 4v wrap', 'car pillar b wraps', 'duke 250 green',
      'yamaha mt6', 'yamaha mt20', 'royal enfield classic 390', 'ruroc deadpool helmet',
      'v3 monster edition', 'car door wraps', 'custom helmet wrap', 'apache 160 wrap',
      'bullet 350 wrap', 'custom splendor wrap', 'itachi bike wrap', 'ktm duke 125 price',
      'r15 monster v3', 'raider bike 150 cc', 'red ktm', 'yamaha mt 15 black panther',
      'anime motorcycle helmet', 'pulsar ns wrap', 'royal enfield classic 350 matte black',
      'tvs raider on road price', 'car pillar door wraps', 'custom bike wraps', 'wrap for r15 v3'
    ],
  } = {}) {
    return {
      title,
      description,
      keywords: keywords.join(', '),
      alternates: {
        canonical: canonical,
      },
      openGraph: {
        title,
        description,
        siteName,
        type: 'website',
        url: canonical,
        images: [
          {
            url: `${seoImage}`,
            width: 800,
            height: 600,
            alt: description,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [seoImage],
      },
      icons: {
        icon: favicon,
      },
    };
  }
  