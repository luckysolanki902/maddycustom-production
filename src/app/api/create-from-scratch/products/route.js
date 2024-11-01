// /app/api/create-from-scratch/products/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../../middleware';
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
    const productsFilePath = path.join(process.cwd(), 'public', 'json', 'MaddyCustom.products.json');
    let originalProducts;
    try {
      const productsContent = fs.readFileSync(productsFilePath, 'utf-8');
      originalProducts = JSON.parse(productsContent);
      console.log(`Loaded original products data from '${productsFilePath}'.`);
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
      const stockQuantity = parseInt(prod.StockLeft || 0, 10);

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

      // Captions and description
      let captions = [];
      let description = '';

      let createdAt;

      if (fbwBikeCodes.includes(bikeCode)) {
        description = `Transform your ${bikeFullName} with the ${uniqueName} full bike wrap from Maddy Custom. Crafted from high-quality vinyl, this wrap offers unmatched durability and style. Customize your ride with a unique design that reflects your personality. Shop now for premium customizations and give your bike a complete new look.`;
        createdAt = new Date('2023-11-01T14:00:00')
      } else {
        if (bikeCode === 'win') {
          description = `Enhance your car's pillars with the ${uniqueName} window pillar wrap from Maddy Custom. Car pillar wraps offer an easy, budget-friendly way to customize your vehicle. Designed to fit perfectly on your car’s B-pillars, these wraps are simple to apply, adding an instant style boost without professional help. With a durable finish and eye-catching design, they’re the ideal choice for affordable, DIY customization.`;
          createdAt = new Date('2024-06-01T14:00:00')
        } else if (bikeCode === 'hel') {
          description = `Discover the ${uniqueName} helmet from Maddy Custom's Helmet Store. Combining style and safety, this helmet features high-impact resistant materials and customizable graphics. Ride with confidence and express your personality with this premium helmet.`;
          createdAt = new Date('2024-04-01T14:00:00')
        } else if (bikeCode === 'bsw') {
          description = `Upgrade your car with the ${uniqueName} bonnet strip wrap from Maddy Custom. Our bonnet strip wraps are designed for unmatched durability and style. Protect your car's bonnet while enhancing its aesthetics with our high-quality, easy-to-apply vinyl wraps. Transform your ride with a sleek and professional look.`;
          createdAt = new Date('2024-08-01T14:00:00')
        } else {
          description = `Upgrade your vehicle with the ${uniqueName} from Maddy Custom. Our wraps and accessories are designed for unmatched durability and style. Transform your ride with unique designs tailored to your taste, from budget-friendly options to premium customizations.`;
          createdAt = new Date('2024-09-01T14:00:00')
        }
      }

      // Tags
      const tagsField = prod.Tags || '';
      const tags = tagsField ? [tagsField.split(',')[0].trim()] : [];

      // Search keywords
      const searchKeywords = casualName.match(/\b\w+\b/g) || [];

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
        specificCategory = specificCategoryMap.get('flw');
        if (!specificCategory) {
          console.error("Specific Category for Full Bike Wraps ('flw') not found. Skipping product.");
          continue;
        }
        const bikeFullNameUrl = encodeURIComponent(bikeFullName.toLowerCase().replace(/\s+/g, '-'));
        specificCategoryVariant = specificCategoryVariants.find(variant => variant.variantCode === bikeCode);
        if (!specificCategoryVariant) {
          console.warn(`Specific Category Variant not found for variantCode '${bikeCode}'. Skipping product '${uniqueName}'.`);
          continue;
        }
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

      // Freebies: only available with win wraps
      let freebies = {
        available: false,
        description: '',
        image: ''
      };
      if (bikeCode === 'win') {
        freebies = {
          available: true,
          description: 'Tools to apply at home e.g., cutter, slider etc.',
          image: '/products/wraps/car-wraps/window-pillar-wraps/freebies/tools.jpg'
        };
      }

      // Assemble the product document
      const product = {
        _id: productId,
        name: uniqueNameFinal,
        captions: captions,
        title: `${uniqueNameFinal} ${specificCategory.name}`,
        description: description,
        mainTags: tags,
        searchKeywords: searchKeywords,
        pageSlug: `${specificCategoryVariant.pageSlug}/${casualNameUrl}`,
        images: images,
        category: category,
        subCategory: subCategory,
        specificCategory: specificCategory._id,
        specificCategoryVariant: specificCategoryVariant._id,
        deliveryCost: 100,
        price: prod.Price || 0,
        sku: sku,
        stock: stockQuantity,
        displayOrder: displayOrder,
        freebies: freebies,
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
        showInSearch: true,
        dominantColor: {},
        createdAt: createdAt,
        updatedAt: createdAt,
        _v: 0
      };

      productList.push(product);
      console.log(`Processed product: '${uniqueNameFinal}' with SKU '${sku}'.`);
    }

    // Delete all existing Product documents
    await Product.deleteMany({});
    console.log("All existing Product documents have been deleted.");

    // Insert new products into the database
    await Product.insertMany(productList);
    console.log("New Product documents have been inserted successfully.");

    return NextResponse.json({ message: "Products have been successfully reset and populated." }, { status: 200 });

  } catch (error) {
    console.error("Error resetting Product collection:", error);
    return NextResponse.json({ error: "Failed to reset Product collection." }, { status: 500 });
  }
}
