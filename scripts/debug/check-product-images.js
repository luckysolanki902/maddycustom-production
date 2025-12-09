const mongoose = require('mongoose');

// Get MongoDB URI from environment or use default
const MONGODB_URI = process.env.MONGODB_URI || 'process.env.MONGODB_URI';

async function checkProductImages(productName = 'Tigrave') {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const SpecificCategory = mongoose.model('SpecificCategory', new mongoose.Schema({}, { strict: false }));
    const SpecificCategoryVariant = mongoose.model('SpecificCategoryVariant', new mongoose.Schema({}, { strict: false }));
    
    // Find the product
    const product = await Product.findOne({ name: new RegExp(productName, 'i') }).lean();
    
    if (!product) {
      console.log(`Product "${productName}" not found`);
      return;
    }
    
    console.log('=== PRODUCT ===');
    console.log('Name:', product.name);
    console.log('Images:', product.images);
    
    // Get category
    let category = null;
    if (product.specificCategory) {
      category = await SpecificCategory.findById(product.specificCategory).lean();
      console.log('\n=== CATEGORY ===');
      console.log('Name:', category?.name);
      console.log('showDescriptionImagesInGallery:', category?.showDescriptionImagesInGallery);
      console.log('commonProductCardImages:', category?.commonProductCardImages || '(empty)');
      console.log('commonGalleryImages:', category?.commonGalleryImages || '(empty)');
    }
    
    // Get variant
    let variant = null;
    if (product.specificCategoryVariant) {
      variant = await SpecificCategoryVariant.findById(product.specificCategoryVariant).lean();
      console.log('\n=== VARIANT ===');
      console.log('Name:', variant?.name);
      console.log('commonProductCardImages:', variant?.commonProductCardImages || '(empty)');
      
      // Check description tab for images
      if (variant?.productInfoTabs && Array.isArray(variant.productInfoTabs)) {
        const descTab = variant.productInfoTabs.find(t => t.title?.toLowerCase() === 'description');
        if (descTab && descTab.content?.blocks) {
          const imageBlocks = descTab.content.blocks.filter(b => b.type === 'image');
          console.log('\nDescription tab image blocks:', imageBlocks.length);
          imageBlocks.forEach((b, i) => {
            console.log(`  Image ${i + 1}:`, b.data?.file?.url);
          });
        } else {
          console.log('\nDescription tab: no image blocks found');
        }
      }
    }
    
    // Summary of total images
    console.log('\n=== SUMMARY ===');
    const totalImages = [];
    totalImages.push(...(product.images || []));
    
    // Description images (if category allows)
    if (category?.showDescriptionImagesInGallery && variant?.productInfoTabs) {
      const descTab = variant.productInfoTabs.find(t => t.title?.toLowerCase() === 'description');
      if (descTab?.content?.blocks) {
        const descImages = descTab.content.blocks
          .filter(b => b.type === 'image')
          .map(b => b.data?.file?.url)
          .filter(Boolean);
        totalImages.push(...descImages);
      }
    }
    
    totalImages.push(...(category?.commonGalleryImages || []));
    totalImages.push(...(variant?.commonProductCardImages || []));
    totalImages.push(...(category?.commonProductCardImages || []));
    
    console.log('Total images that should appear:', totalImages.length);
    totalImages.forEach((img, i) => console.log(`  ${i + 1}. ${img}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run with product name from command line or default to "Tigrave"
const productName = process.argv[2] || 'Tigrave';
checkProductImages(productName);
