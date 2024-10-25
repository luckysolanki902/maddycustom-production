
import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../middleware';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';

export async function POST(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    
    // Define the path to the public json folder
    const dataFolderPath = path.join(process.cwd(), 'public', 'json');

    // Define the JSON files to be uploaded
    const files = {
      specificCategories: 'specific_categories.json',
      specificCategoryVariants: 'specific_category_variants.json',
      products: 'products.json',
    };

    // Read all JSON files concurrently
    const [
      specificCategoriesData,
      specificCategoryVariantsData,
      productsData,
    ] = await Promise.all(
      Object.values(files).map((file) => fs.readFile(path.join(dataFolderPath, file), 'utf8'))
    );

    // Parse JSON data
    const specificCategories = JSON.parse(specificCategoriesData);
    const specificCategoryVariants = JSON.parse(specificCategoryVariantsData);
    const products = JSON.parse(productsData);

    // OPTIONAL: Clear existing data (Use with caution)
    // Uncomment the following lines if you want to clear existing collections before uploading
    /*
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      SpecificCategory.deleteMany({}),
      SpecificCategoryVariant.deleteMany({}),
      Product.deleteMany({}),
    ]);
    */


    const insertedSpecificCategories = await SpecificCategory.insertMany(specificCategories, { ordered: false });
    console.log(`Inserted ${insertedSpecificCategories.length} specificCategories.`);

    // Insert SpecificCategoryVariants
    const insertedSpecificCategoryVariants = await SpecificCategoryVariant.insertMany(specificCategoryVariants, { ordered: false });
    console.log(`Inserted ${insertedSpecificCategoryVariants.length} specificCategoryVariants.`);

    // Insert Products
    const insertedProducts = await Product.insertMany(products, { ordered: false });
    console.log(`Inserted ${insertedProducts.length} products.`);

    // Ensure indexes are built
    await Promise.all([
      Product.init(),
      SpecificCategory.init(),
      SpecificCategoryVariant.init(),
    ]);

    console.log('All indexes are ensured.');

    return NextResponse.json({ message: 'Data uploaded successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error uploading data:', error);
    return NextResponse.json({ error: 'Error uploading data.', details: error.message }, { status: 500 });
  }
}