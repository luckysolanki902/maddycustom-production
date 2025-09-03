import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

export default async function sitemap() {
    let products = [];
  let variants = [];

    try {
        // Connect to database directly during build
        await connectToDatabase();

    // Fetch products with availability filtering
        const productsData = await Product.find(
            { available: true },
            { pageSlug: 1, updatedAt: 1, specificCategory: 1, specificCategoryVariant: 1 }
        )
        .populate({
            path: 'specificCategory',
            select: 'available',
            match: { available: true }
        })
        .populate({
            path: 'specificCategoryVariant', 
            select: 'available pageSlug updatedAt',
            match: { available: true }
        })
        .lean()
        .exec();

    // Filter products where all entities are available
        const availableProducts = productsData.filter(product => {
            if (!product.specificCategory || product.specificCategory.available !== true) {
                return false;
            }
            if (product.specificCategoryVariant && product.specificCategoryVariant.available !== true) {
                return false;
            }
            return true;
        });

    // Prepare products array
        products = availableProducts.map(product => ({
            pageSlug: product.pageSlug,
            lastModified: product.updatedAt
        }));

    // Fetch variants independently to avoid duplicates derived from products
    const variantsData = await SpecificCategoryVariant.find(
      { available: true },
      { pageSlug: 1, updatedAt: 1, specificCategory: 1 }
    )
    .populate({
      path: 'specificCategory',
      select: 'available',
      match: { available: true }
    })
    .lean()
    .exec();

    // Prepare variants array (only where parent specificCategory is available)
    variants = variantsData
      .filter(v => v.pageSlug && v.specificCategory)
      .map(v => ({
        pageSlug: v.pageSlug,
        lastModified: v.updatedAt
      }));

    } catch (error) {
        console.error('Error fetching sitemap data:', error);
        // Fallback to empty arrays if database connection fails during build
    }
  
    const baseUrl = 'https://www.maddycustom.com';
  
    // 1. Home page - highest priority at the top
    const homeRoute = [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
    ];

    // 2. Dynamic variant pages with proper lastModified dates - sorted by latest first
    const variantRoutes = variants
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .map((variant) => ({
        url: `${baseUrl}/shop${variant.pageSlug}`,
        lastModified: new Date(variant.lastModified),
        changeFrequency: 'weekly',
        priority: 0.9,
      }));

    // 3. Other static pages - ordered by importance
    const otherStaticRoutes = [
      {
        url: `${baseUrl}/shop`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.85,
      },
      {
        url: `${baseUrl}/orders/track`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/about-us`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/contact-us`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/faqs`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      {
        url: `${baseUrl}/termsandconditions`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
      },
    ];
  
    // 4. Dynamic product pages with proper lastModified dates - sorted by latest first
    const productRoutes = products
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .map((product) => ({
        url: `${baseUrl}/shop${product.pageSlug}`,
        lastModified: new Date(product.lastModified),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
  
    // Return in the specified order: home > variant routes > other static routes > product routes
    return [...homeRoute, ...variantRoutes, ...otherStaticRoutes, ...productRoutes];
  }
  