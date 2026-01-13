// api/seo/image-sitemap
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';
import Option from '@/models/Option';
import { NextResponse } from 'next/server';

export const revalidate = 86400; // 1 day in seconds
export async function GET() {
  try {
    await connectToDatabase();
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const baseUrl = 'https://www.maddycustom.com';

    // Fetch all available products with their options
    const products = await Product.find(
      { available: true },
      { pageSlug: 1, images: 1, title: 1, name: 1, specificCategory: 1, specificCategoryVariant: 1, updatedAt: 1, optionsAvailable: 1 }
    )
      .populate('specificCategory', 'available')
      .populate('specificCategoryVariant', 'name productDescription available')
      .lean()
      .exec();

    // Filter products where all related entities are available
    const filteredProducts = products.filter(product => {
      // SpecificCategory must exist and be available
      if (!product.specificCategory || product.specificCategory.available !== true) {
        return false;
      }
      // If product has a specificCategoryVariant, it must be available
      if (product.specificCategoryVariant && product.specificCategoryVariant.available !== true) {
        return false;
      }
      return true;
    });

    // Sort by latest first (updatedAt descending)
    const sortedProducts = filteredProducts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Build comprehensive image data for each product
    const imageData = [];

    for (const product of sortedProducts) {
      const variant = product.specificCategoryVariant;
      const description = variant?.productDescription
        ?.replace(/{uniqueName}/g, product.name)
        ?.replace(/{fullBikename}/g, variant.name) ||
        `${product.title} - Premium quality custom vehicle wraps and accessories from MaddyCustom`;

      const pageUrl = `${baseUrl}/shop${product.pageSlug}`;
      const allImages = [];

      // 1. Add product images (main images)
      if (product.images && product.images.length > 0) {
        product.images.forEach((image, index) => {
          allImages.push({
            loc: `${baseImageUrl}${image.startsWith('/') ? image : '/' + image}`,
            title: `${product.title}${index > 0 ? ` - Image ${index + 1}` : ''} | MaddyCustom`,
            caption: description,
          });
        });
      }

      // 2. Add option images if product has options
      if (product.optionsAvailable) {
        try {
          const options = await Option.find({ product: product._id }, { images: 1, optionDetails: 1 })
            .lean()
            .exec();

          options.forEach(option => {
            if (option.images && option.images.length > 0) {
              const optionName = option.optionDetails ?
                Object.entries(option.optionDetails).map(([key, value]) => `${key}: ${value}`).join(', ') :
                'Option';

              option.images.forEach((image, index) => {
                allImages.push({
                  loc: `${baseImageUrl}${image.startsWith('/') ? image : '/' + image}`,
                  title: `${product.title} - ${optionName}${index > 0 ? ` Image ${index + 1}` : ''} | MaddyCustom`,
                  caption: `${description} - ${optionName}`,
                });
              });
            }
          });
        } catch (error) {
          console.error(`Error fetching options for product ${product._id}:`, error);
        }
      }

      // 3. Add variant gallery images if available
      if (variant?.commonGalleryImages && variant.commonGalleryImages.length > 0) {
        variant.commonGalleryImages.forEach((image, index) => {
          allImages.push({
            loc: `${baseImageUrl}${image.startsWith('/') ? image : '/' + image}`,
            title: `${product.title} - Gallery Image ${index + 1} | MaddyCustom`,
            caption: `${description} - Gallery`,
          });
        });
      }

      // Only add to sitemap if we have images
      if (allImages.length > 0) {
        imageData.push({
          url: pageUrl,
          lastModified: product.updatedAt || new Date(),
          images: allImages,
        });
      }
    }

    // Generate XML sitemap
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const xmlNamespaces = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';

    let xmlContent = `${xmlHeader}\n${xmlNamespaces}\n`;

    imageData.forEach(page => {
      xmlContent += '  <url>\n';
      xmlContent += `    <loc>${escapeXml(page.url)}</loc>\n`;
      xmlContent += `    <lastmod>${new Date(page.lastModified).toISOString()}</lastmod>\n`;

      page.images.forEach(image => {
        xmlContent += '    <image:image>\n';
        xmlContent += `      <image:loc>${escapeXml(image.loc)}</image:loc>\n`;
        xmlContent += `      <image:title>${escapeXml(image.title)}</image:title>\n`;
        xmlContent += `      <image:caption>${escapeXml(image.caption)}</image:caption>\n`;
        xmlContent += '    </image:image>\n';
      });

      xmlContent += '  </url>\n';
    });

    xmlContent += '</urlset>';

    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });

  } catch (error) {
    console.error('Error generating image sitemap:', error);
    return new NextResponse('<error>Internal Server Error</error>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}

// Helper function to escape XML special characters
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
