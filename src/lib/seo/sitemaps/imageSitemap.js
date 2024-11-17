export default async function videoSitemap() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seo/sitemap-data`);
    const { products } = await response.json();
  
    const baseUrl = 'https://maddycustom.com';
    const baseVideoUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  
    const videoRoutes = products
      .filter((product) => product.showcase && product.showcase.available)
      .map((product) => ({
        url: `${baseUrl}/shop${product.pageSlug}`,
        videos: product.showcase.map((showcase) => ({
          url: `${baseVideoUrl}${showcase.url}`,
          thumbnail: `${baseVideoUrl}${showcase.thumbnailUrl}`,
          title: showcase.title || 'Video Title',
          description: showcase.description || 'Video Description',
          playerUrl: `${baseUrl}/videoplayer?video=${showcase.videoId}`,
          duration: showcase.duration || 600,
        })),
      }));
  
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
        ${videoRoutes
          .map(
            (route) => `
          <url>
            <loc>${route.url}</loc>
            ${route.videos
              .map(
                (video) => `
              <video:video>
                <video:thumbnail_loc>${video.thumbnail}</video:thumbnail_loc>
                <video:title>${video.title}</video:title>
                <video:description>${video.description}</video:description>
                <video:content_loc>${video.url}</video:content_loc>
                <video:player_loc>${video.playerUrl}</video:player_loc>
                <video:duration>${video.duration}</video:duration>
              </video:video>`
              )
              .join('')}
          </url>`
          )
          .join('')}
      </urlset>`;
  
    return new Response(xmlContent, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
  