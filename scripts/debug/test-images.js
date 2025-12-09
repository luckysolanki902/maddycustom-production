const mongoose = require('mongoose');

const MONGODB_URI = 'process.env.MONGODB_URI';

async function check() {
  await mongoose.connect(MONGODB_URI);
  
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const SpecificCategory = mongoose.model('SpecificCategory', new mongoose.Schema({}, { strict: false }));
  const SpecificCategoryVariant = mongoose.model('SpecificCategoryVariant', new mongoose.Schema({}, { strict: false }));
  const ProductInfoTab = mongoose.model('ProductInfoTab', new mongoose.Schema({}, { strict: false }));
  
  // Find Tigrave product
  const product = await Product.findOne({ name: /tigrave/i }).lean();
  console.log('Product:', product?.name);
  console.log('Product images:', product?.images);
  
  // Get category
  const category = await SpecificCategory.findById(product?.specificCategory).lean();
  console.log('\nCategory:', category?.name);
  console.log('showDescriptionImagesInGallery:', category?.showDescriptionImagesInGallery);
  
  // Get variant
  const variant = await SpecificCategoryVariant.findById(product?.specificCategoryVariant).lean();
  console.log('\nVariant:', variant?.name);
  
  // Get ProductInfoTab for variant
  const tab = await ProductInfoTab.findOne({ 
    specificCategoryVariant: variant?._id,
    title: 'Description'
  }).lean();
  
  console.log('\nProductInfoTab found:', !!tab);
  if (tab?.content?.blocks) {
    const images = tab.content.blocks
      .filter(b => b.type === 'image')
      .map(b => b.data?.file?.url);
    console.log('Description images:', images);
    
    // Combined images
    console.log('\n=== FINAL IMAGE ARRAY ===');
    const allImages = [
      ...(product?.images || []),
      ...images
    ];
    console.log('Total images:', allImages.length);
    allImages.forEach((img, i) => console.log(`  ${i + 1}. ${img}`));
  }
  
  await mongoose.disconnect();
}

check().catch(console.error);
