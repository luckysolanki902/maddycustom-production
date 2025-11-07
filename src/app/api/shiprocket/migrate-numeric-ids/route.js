import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import mongoose from 'mongoose';

export async function POST(request) {
  try {
    const connection = await connectToDatabase();
    const db = connection.connection.db;

    const results = {
      products: { updated: 0, skipped: 0, errors: [] },
      options: { updated: 0, skipped: 0, errors: [] },
      variants: { updated: 0, skipped: 0, errors: [] },
    };

    // Migrate Products using native MongoDB driver
    const productsCollection = db.collection('products');
    const productsWithoutId = await productsCollection.find({ uniqueNumericId: { $exists: false } }).toArray();
    
    for (const product of productsWithoutId) {
      try {
        const timestamp = Date.now().toString().slice(-10);
        const random = Math.floor(Math.random() * 1000);
        const uniqueNumericId = Number(`${timestamp}${random.toString().padStart(3, '0')}`);
        
        await productsCollection.updateOne(
          { _id: product._id },
          { $set: { uniqueNumericId } }
        );
        results.products.updated++;
        // Small delay to ensure unique IDs
        await new Promise(resolve => setTimeout(resolve, 2));
      } catch (error) {
        results.products.errors.push(`Product ${product._id}: ${error.message}`);
      }
    }
    results.products.skipped = await productsCollection.countDocuments({ uniqueNumericId: { $exists: true } });

    // Migrate Options
    const optionsCollection = db.collection('options');
    const optionsWithoutId = await optionsCollection.find({ uniqueNumericId: { $exists: false } }).toArray();
    
    for (const option of optionsWithoutId) {
      try {
        const timestamp = Date.now().toString().slice(-10);
        const random = Math.floor(Math.random() * 1000);
        const uniqueNumericId = Number(`${timestamp}${random.toString().padStart(3, '0')}`);
        
        await optionsCollection.updateOne(
          { _id: option._id },
          { $set: { uniqueNumericId } }
        );
        results.options.updated++;
        await new Promise(resolve => setTimeout(resolve, 2));
      } catch (error) {
        results.options.errors.push(`Option ${option._id}: ${error.message}`);
      }
    }
    results.options.skipped = await optionsCollection.countDocuments({ uniqueNumericId: { $exists: true } });

    // Migrate SpecificCategoryVariants
    const variantsCollection = db.collection('specificcategoryvariants');
    const variantsWithoutId = await variantsCollection.find({ uniqueNumericId: { $exists: false } }).toArray();
    
    for (const variant of variantsWithoutId) {
      try {
        const timestamp = Date.now().toString().slice(-10);
        const random = Math.floor(Math.random() * 1000);
        const uniqueNumericId = Number(`${timestamp}${random.toString().padStart(3, '0')}`);
        
        await variantsCollection.updateOne(
          { _id: variant._id },
          { $set: { uniqueNumericId } }
        );
        results.variants.updated++;
        await new Promise(resolve => setTimeout(resolve, 2));
      } catch (error) {
        results.variants.errors.push(`Variant ${variant._id}: ${error.message}`);
      }
    }
    results.variants.skipped = await variantsCollection.countDocuments({ uniqueNumericId: { $exists: true } });

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
