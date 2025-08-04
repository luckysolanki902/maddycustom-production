import { mainDescription, mainKeywords } from "../constants/seoConsts";

export async function createMetadata({
    canonical = 'https://www.maddycustom.com',
    title = "MaddyCustom - India's Leading Vehicle Personalization & Custom Car/Bike Wraps Experts",
    description = mainDescription,
    favicon = '/images/metadata/favicon.ico',
    seoImage = '/images/metadata/logoforlink.png',
    siteName = 'MaddyCustom',
    keywords = mainKeywords,
  } = {}) {
    return {
      title,
      description,
      keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords,
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
            url: `https://www.maddycustom.com${seoImage}`,
            width: 800,
            height: 600,
            alt: `${siteName} - ${description}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [`https://www.maddycustom.com${seoImage}`],
      },
      icons: {
        icon: favicon,
      },
      other: {
        'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION || '',
      },
    };
  }
  