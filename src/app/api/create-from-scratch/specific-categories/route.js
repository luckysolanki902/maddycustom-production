// /app/api/create-from-scratch/specific-categories/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Define the specific categories
    const specificCategories = [
      {
        specificCategoryCode: "fbw",
        name: "Full Bike Wraps",
        description: "Explore Maddy Custom’s collection of Full Bike Wraps. Transform your bike's appearance with our high-quality, durable vinyl wraps that offer both aesthetic enhancement and surface protection. Choose from a variety of customizable designs tailored to your taste, ensuring a unique and premium finish for your bike.",
        pageSlug: "/wraps/bike-wraps/full-bike-wraps",
        subCategory: "Bike Wraps",
        category: "Wraps",
        available: true,
      },
      {
        specificCategoryCode: "win",
        name: "Window Pillar Wraps",
        description: "Make your vehicle's style unrivaled with MaddyCustom's Window Pillar Wraps. Available in a range of colors and finishes; these wraps add a sleek and modern touch to any car, ensuring long-lasting protection",
        pageSlug: "/wraps/car-wraps/window-pillar-wraps",
        subCategory: "Car Wraps",
        category: "Wraps",
        available: true,
      },
      {
        specificCategoryCode: "bw",
        name: "Bonnet Wraps",
        description: "Make a bold statement with our high-quality bonnet wraps. Choose from matte, glossy or carbon fiber finishes to give your car a distinctive look that stands out on the road",
        pageSlug: "/wraps/car-wraps/bonnet-wraps",
        subCategory: "Car Wraps",
        category: "Wraps",
        available: true,
      },
      {
        specificCategoryCode: "hel",
        name: "Graphic Helmets",
        description: "Protect your ride and express your style with MaddyCustom's Graphic Helmets. Custom designs and premium quality. Durable, scratch-resistant and comfortable",
        pageSlug: "/accessories/safety/graphic-helmets",
        subCategory: "Safety",
        category: "Accessories",
        available: true,
      },
      {
        specificCategoryCode: "tw",
        name: "Tank Wraps",
        description: "Personalize your bike’s fuel tank with our high-quality wraps. Available in various designs and finishes to give your bike a standout appearance.",
        pageSlug: "/wraps/bike-wraps/tank-wraps",
        subCategory: "Bike Wraps",
        category: "Wraps",
        available: true,
      }
    ];

    // Delete all existing documents in the SpecificCategory collection
    await SpecificCategory.deleteMany({});

    // Insert new specific categories
    await SpecificCategory.insertMany(specificCategories);

    return NextResponse.json({ message: "Specific categories have been successfully reset and populated." }, { status: 200 });
  } catch (error) {
    console.error("Error resetting SpecificCategory collection:", error);
    return NextResponse.json({ error: "Failed to reset SpecificCategory collection." }, { status: 500 });
  }
}