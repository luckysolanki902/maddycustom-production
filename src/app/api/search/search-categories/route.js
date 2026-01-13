// pages/api/search/search-categories.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

// Cache search categories for 1 day (rarely changes)
export const revalidate = 86400;

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Fetch all specific categories
    const categories = await SpecificCategory.find({ available: true }).lean();

    if (!categories || categories.length === 0) {
      // console.warn('No specific categories found with available=true.');
    }

    // Create a map of category IDs to category names for easy lookup
    const categoryMap = categories.reduce((map, category) => {
      map[category._id.toString()] = category.name;
      return map;
    }, {});

    // Fetch all specific category variants
    const variants = await SpecificCategoryVariant.find({ available: true }).lean();

    if (!variants || variants.length === 0) {
      // console.warn('No specific category variants found.');
    }

    // Create a map of category ID to first variant's pageSlug
    const categoryToFirstVariantSlug = {};
    variants.forEach(variant => {
      const categoryId = variant.specificCategory.toString();
      if (!categoryToFirstVariantSlug[categoryId]) {
        categoryToFirstVariantSlug[categoryId] = variant.pageSlug;
      }
    });

    // Structure the response
    const responseData = {
      categories: categories.map(category => ({
        id: category._id,
        name: category.name,
        pageSlug: categoryToFirstVariantSlug[category._id.toString()] || category.pageSlug, // Use first variant's slug or fallback
        subCategory: category.subCategory,
        // Add other necessary fields if needed
      })),
      variants: variants.map(variant => {
        let variantName = variant.name;

        // Check if the variant name is a single word
        if (variantName.trim().split(/\s+/).length === 1) {
          const categoryName = categoryMap[variant.specificCategory.toString()];
          if (categoryName) {
            variantName = `${variantName} ${categoryName}`;
          } else {
            // console.warn(`No matching category found for variant ID: ${variant._id}`);
          }
        }

        return {
          id: variant._id,
          name: variantName,
          pageSlug: variant.pageSlug,
          specificCategory: variant.specificCategory, // Reference to parent category
        };
      }),
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching search categories:', error.message);
    return NextResponse.json({ error: 'Failed to fetch search categories' }, { status: 500 });
  }
}
