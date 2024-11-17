// /app/api/create-from-scratch/products/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Load specific categories from the database
    const specificCategories = await SpecificCategory.find({});
    if (!specificCategories.length) {
      console.error("No SpecificCategory documents found.");
      return NextResponse.json({ error: "No SpecificCategory documents found." }, { status: 400 });
    }

    // Load specific category variants from the database
    const specificCategoryVariants = await SpecificCategoryVariant.find({});
    if (!specificCategoryVariants.length) {
      console.error("No SpecificCategoryVariant documents found.");
      return NextResponse.json({ error: "No SpecificCategoryVariant documents found." }, { status: 400 });
    }

    // Load products data from JSON file
    const productsFilePath = path.join(process.cwd(), 'public', 'json', 'MaddyCustom2.products.json');
    let originalProducts;
    try {
      const productsContent = fs.readFileSync(productsFilePath, 'utf-8');
      originalProducts = JSON.parse(productsContent);
    } catch (err) {
      console.error(`Failed to load products data from '${productsFilePath}':`, err);
      return NextResponse.json({ error: "Failed to load products data." }, { status: 500 });
    }

    // Create mappings for quick lookup
    const specificCategoryMap = new Map();
    specificCategories.forEach(cat => {
      specificCategoryMap.set(cat.specificCategoryCode, cat);
    });

    const specificCategoryVariantMap = new Map();
    specificCategoryVariants.forEach(variant => {
      specificCategoryVariantMap.set(variant.variantCode, variant);
    });

    // Define the mappings
    const variantToCategoryCode = {
      'bsw': 'bw',
      'win': 'win',
      'hel': 'hel',
      'twrapsports': 'tw',
      'twrapclassic': 'tw',
      'twrapwide': 'tw'
    };

    const variantToCategoryVariantCode = {
      'bsw': 'bsw',
      'win': 'win',
      'hel': 'hel',
      'twrapsports': 'tw-s',
      'twrapclassic': 'tw-m',
      'twrapwide': 'tw-w'
    };

    // Define lists of bike codes
    const fbwBikeCodes = [
      "rid",
      "pn16",
      "rc3",
      "yr1",
      "duk3",
      "ap16",
      "rec3",
      "spl",
      "pns1",
      "mt"
    ];

    const nonFbwBikeCodes = [
      "win",
      "twrapsports",
      "twrapclassic",
      "twrapwide",
      "hel",
      "bsw"
    ];

    // Initialize an empty array for products
    const productList = [];

    // Initialize a map to keep track of name counts for uniqueness
    const nameCounts = new Map();

    // Function to get ObjectId from product data
    function getObjectIdFromProduct(prod) {
      const productIdField = prod._id;
      if (productIdField && productIdField.$oid) {
        const oidString = productIdField.$oid;
        if (mongoose.Types.ObjectId.isValid(oidString)) {
          return new mongoose.Types.ObjectId(oidString);
        } else {
          console.warn(`Invalid ObjectId '${oidString}' for product '${prod.Name}'. Generating a new ObjectId.`);
          return new mongoose.Types.ObjectId();
        }
      } else {
        console.warn(`Product '${prod.Name}' does not have a valid '_id' field. Generating a new ObjectId.`);
        return new mongoose.Types.ObjectId();
      }
    }

    // Process each product in the originalProducts
    for (const prod of originalProducts) {
      const productId = getObjectIdFromProduct(prod);

      const bikeCode = prod.BikeCode;
      const bikeFullName = prod.BikeFullName;
      const displayOrder = prod.sortOrder || 0;
      const stockQuantity = parseInt(prod.StockLeft || 0, 10); // Note: 'stock' field removed

      // Skip products not in the specified bike codes
      if (!fbwBikeCodes.includes(bikeCode) && !nonFbwBikeCodes.includes(bikeCode)) {
        console.warn(`Product with SKU '${prod.Name}' has unrecognized BikeCode '${bikeCode}'. Skipping.`);
        continue;
      }

      const casualName = (prod.CasualName || '').trim();
      if (!casualName) {
        console.warn(`Product with SKU '${prod.Name}' has no CasualName. Skipping.`);
        continue;
      }

      // Ensure uniqueness of name
      const nameKey = casualName.toLowerCase();
      const count = nameCounts.get(nameKey) || 0;
      nameCounts.set(nameKey, count + 1);
      let uniqueName = casualName;
      if (count > 0) {
        uniqueName = `${casualName} ${String(count + 1).padStart(2, '0')}`;
        console.debug(`Duplicate name found. Assigned unique name: '${uniqueName}'.`);
      } else {
        console.debug(`Assigned name: '${uniqueName}'.`);
      }

      let description = '';

      let createdAt;

      if (fbwBikeCodes.includes(bikeCode)) {
        description = `Revamp your ${bikeFullName} with the premium ${uniqueName} full bike wrap from Maddy Custom. Made with durable, high-quality vinyl, this wrap is designed to stand up to the elements while keeping your bike looking brand new. Showcase your personality on the road with unique, eye-catching designs that reflect your style. Achieve a flawless, professional look easily—no paint required! Elevate your ride with top-tier customization that turns heads.`;
        createdAt = new Date('2023-11-01T14:00:00');
      } else {
        if (bikeCode === 'win') {
          description = `Give your car’s pillars a stylish makeover with the ${uniqueName} window pillar wrap from Maddy Custom. These wraps are crafted to perfectly fit and enhance your car’s B-pillars, offering a sleek, professional look without the high price tag. Made from durable, weather-resistant vinyl, they add a modern edge to your vehicle while protecting the original finish. Easy to apply, these DIY wraps offer an affordable, high-impact way to boost your car’s aesthetics. Make a statement and drive with style!`;
          createdAt = new Date('2024-06-01T14:00:00');
        } else if (bikeCode === 'hel') {
          description = `Ride in style and safety with the ${uniqueName} helmet from Maddy Custom’s Helmet Store. Designed with high-impact resistant materials, this helmet offers superior protection, while the customizable graphics make it uniquely yours. Show off your personality and turn heads on the road with a helmet that blends function with fashion. Whether you're a casual rider or a seasoned biker, this helmet is your ideal companion for safe, stylish rides.`;
          createdAt = new Date('2024-04-01T14:00:00');
        } else if (bikeCode === 'bsw') {
          description = `Enhance your car’s appearance with the ${uniqueName} bonnet strip wrap from Maddy Custom. Crafted from top-grade, durable vinyl, our bonnet wraps not only protect your car’s surface but also deliver a sleek, eye-catching design. Perfect for a sporty, polished look, these wraps add personality and sophistication to your vehicle without the hassle of a paint job. Experience quick, DIY installation for a bold new style that’s as unique as your ride.`;
          createdAt = new Date('2024-08-01T14:00:00');
        } else {
          description = `Elevate your vehicle’s aesthetics with the ${uniqueName} from Maddy Custom. Our collection of wraps and accessories is meticulously designed for style, durability, and a flawless finish. Choose from a wide array of unique designs tailored to suit every taste and budget. From economical upgrades to luxurious customizations, transform your ride into a stunning reflection of your personality and drive with confidence.`;
          createdAt = new Date('2024-09-01T14:00:00');
        }
      }

      // Tags
      const tagsField = prod.Tags || '';
      const tags = tagsField ? [tagsField.split(',')[0].trim()] : [];

      // SKU
      const sku = prod.Name;
      if (!sku) {
        console.warn(`Product '${uniqueName}' has no SKU. Skipping.`);
        continue;
      }

      // Page Slug
      const casualNameUrl = encodeURIComponent(uniqueName.toLowerCase().replace(/\s+/g, '-'));
      let pageSlug = '';
      let specificCategory = null;
      let specificCategoryVariant = null;

      if (fbwBikeCodes.includes(bikeCode)) {
        specificCategory = specificCategoryMap.get('fbw');
        if (!specificCategory) {
          console.error("Specific Category for Full Bike Wraps ('fbw') not found. Skipping product.");
          continue;
        }
        const bikeFullNameUrl = encodeURIComponent(bikeFullName.toLowerCase().replace(/\s+/g, '-'));
        specificCategoryVariant = specificCategoryVariants.find(variant => variant.variantCode === bikeCode);
        if (!specificCategoryVariant) {
          console.warn(`Specific Category Variant not found for variantCode '${bikeCode}'. Skipping product '${uniqueName}'.`);
          continue;
        }
        pageSlug = `${specificCategory.pageSlug}/${casualNameUrl}`;
      } else {
        const specificCategoryCode = variantToCategoryCode[bikeCode];
        if (!specificCategoryCode) {
          console.warn(`No Specific Category Code mapping found for BikeCode '${bikeCode}'. Skipping product '${uniqueName}'.`);
          continue;
        }
        specificCategory = specificCategoryMap.get(specificCategoryCode);
        if (!specificCategory) {
          console.warn(`No Specific Category found for SpecificCategoryCode '${specificCategoryCode}'. Skipping product '${uniqueName}'.`);
          continue;
        }
        pageSlug = `${specificCategory.pageSlug}/${casualNameUrl}`;
        const variantCode = variantToCategoryVariantCode[bikeCode];
        if (!variantCode) {
          console.warn(`No Specific Category Variant Code mapping found for BikeCode '${bikeCode}'. Skipping product '${uniqueName}'.`);
          continue;
        }
        specificCategoryVariant = specificCategoryVariantMap.get(variantCode);
        if (!specificCategoryVariant) {
          console.warn(`No Specific Category Variant found for VariantCode '${variantCode}'. Skipping product '${uniqueName}'.`);
          continue;
        }
      }

      // Images
      const imageField = prod.Image || '';
      if (!imageField) {
        console.warn(`Product '${uniqueName}' has no Image field. Skipping.`);
        continue;
      }
      const filename = `${sku}.jpg`;
      const imageUrl = `/products/${specificCategory.category.toLowerCase().replace(/\s+/g, '-')}/${specificCategory.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specificCategory.name.toLowerCase().replace(/\s+/g, '-')}/${specificCategoryVariant.variantCode.toLowerCase()}/${filename}`;
      const images = [imageUrl];

      // Category and subCategory
      const category = specificCategory.category;
      const subCategory = specificCategory.subCategory;

      // Ensure unique pageSlug
      const existingSlugs = new Set(productList.map(p => p.pageSlug));
      let uniquePageSlug = pageSlug;
      let slugSuffix = 2;
      while (existingSlugs.has(uniquePageSlug)) {
        uniquePageSlug = `${pageSlug}-${String(slugSuffix).padStart(2, '0')}`;
        slugSuffix++;
      }

      // Ensure unique name
      const existingNames = new Set(productList.map(p => p.name));
      let uniqueNameFinal = uniqueName;
      let nameSuffix = 2;
      while (existingNames.has(uniqueNameFinal)) {
        uniqueNameFinal = `${uniqueName} ${String(nameSuffix).padStart(2, '0')}`;
        nameSuffix++;
      }

      // Assemble the product document without removed fields
      const product = {
        _id: productId,
        name: uniqueNameFinal,
        title: `${uniqueNameFinal} ${specificCategory.name.endsWith('s') ? specificCategory.name.slice(0, -1) : specificCategory.name}`,
        description: description,
        mainTags: tags,
        pageSlug: uniquePageSlug, // Use uniquePageSlug after ensuring uniqueness
        images: images,
        category: category,
        subCategory: subCategory,
        specificCategory: specificCategory._id,
        specificCategoryVariant: specificCategoryVariant._id,
        deliveryCost: 100, // Default value as per schema
        price: prod.Price || 1, // Ensure minimum price as per schema
        sku: sku,
        displayOrder: displayOrder,
        designTemplate: {
          designCode: sku,
          imageUrl: `${specificCategoryVariant.designTemplateFolderPath}/${sku}.png`
        },
        reviews: [],
        ratings: {
          averageRating: 0,
          numberOfRatings: 0
        },
        available: true,
      };

      productList.push(product);
    }

    // Delete all existing Product documents
    await Product.deleteMany({});

    // Insert new products into the database
    await Product.insertMany(productList);

    return NextResponse.json({ message: "Products have been successfully reset and populated." }, { status: 200 });

  } catch (error) {
    console.error("Error resetting Product collection:", error);
    return NextResponse.json({ error: "Failed to reset Product collection." }, { status: 500 });
  }
}
