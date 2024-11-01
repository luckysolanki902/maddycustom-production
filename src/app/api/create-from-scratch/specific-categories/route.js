// /app/api/create-from-scratch/specific-categories/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../../middleware';
import SpecificCategory from '@/models/SpecificCategory';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Define the specific categories
    const specificCategories = [
      {
        specificCategoryCode: "flw",
        name: "Full Bike Wraps",
        commonPrice: 2199,
        subtitles: ["Give Your Bike A Complete New Look"],
        description: "Explore Maddy Custom’s collection of Full Bike Wraps. Transform your bike's appearance with our high-quality, durable vinyl wraps that offer both aesthetic enhancement and surface protection. Choose from a variety of customizable designs tailored to your taste, ensuring a unique and premium finish for your bike.",
        keywords: [
          "full bike wrap",
          "custom bike wraps",
          "bike transformation",
          "vehicle wraps",
          "vinyl bike wrap"
        ],
        pageSlug: "/wraps/bike-wraps/full-bike-wraps",
        subCategory: "Bike Wraps",
        category: "Wraps",
        available: true,
        showInSearch: true,
        thumbnails: [
          "/assets/images/full-bike-wrap1.jpg",
          "/assets/images/full-bike-wrap2.jpg"
        ],
        availableSpecificCategoryVariants: [], // Left blank as per instructions
      },
      {
        specificCategoryCode: "win",
        name: "Window Pillar Wraps",
        commonPrice: 499,
        subtitles: ["car window pillar wraps"],
        description: "Discover Maddy Custom’s Window Pillar Wraps designed to safeguard and stylize your vehicle's pillars. Our premium wraps ensure durability and a seamless look, enhancing your car's overall aesthetics while protecting against scratches and wear. Choose from a range of stylish options tailored to complement your vehicle's design.",
        keywords: [
          "window pillar wrap",
          "car pillar protection",
          "vehicle pillars",
          "custom wraps",
          "vinyl pillar wraps"
        ],
        pageSlug: "/wraps/car-wraps/window-pillar-wraps",
        subCategory: "Car Wraps",
        category: "Wraps",
        available: true,
        showInSearch: true,
        thumbnails: [
          "/assets/images/window-pillar-wrap1.jpg",
          "/assets/images/window-pillar-wrap2.jpg"
        ],
        availableSpecificCategoryVariants: [], // Left blank as per instructions
      },
      {
        specificCategoryCode: "bw",
        name: "Bonnet Wraps",
        commonPrice: 599,
        subtitles: [],
        description: "Upgrade your vehicle with Maddy Custom’s Bonnet Wraps. Our sleek and protective vinyl wraps are designed to resist wear and tear, providing both aesthetic appeal and functional protection. Maintain the pristine look of your car's bonnet while guarding against scratches and minor damages with our high-quality, customizable wraps.",
        keywords: [
          "bonnet wrap",
          "car bonnet protection",
          "vehicle bonnet",
          "custom car wraps",
          "vinyl bonnet wraps"
        ],
        pageSlug: "/wraps/car-wraps/bonnet-wraps",
        subCategory: "Car Wraps",
        category: "Wraps",
        available: true,
        showInSearch: true,
        thumbnails: [
          "/assets/images/bonnet-wrap1.jpg",
          "/assets/images/bonnet-wrap2.jpg"
        ],
        availableSpecificCategoryVariants: [], // Left blank as per instructions
      },
      {
        specificCategoryCode: "hel",
        name: "Graphic Helmets",
        commonPrice: 800,
        subtitles: ["Best designed helmets of india with safety of"],
        description: "Explore Maddy Custom’s Graphic Helmets, where style meets safety. Our helmets feature high-impact resistant materials combined with customizable graphics that reflect your personality. Lightweight and durable, these helmets ensure maximum comfort and security, making them the perfect choice for both protection and personal expression.",
        keywords: [
          "graphic helmets",
          "safety helmets",
          "custom helmets",
          "motorcycle helmets",
          "stylish helmets"
        ],
        pageSlug: "/accessories/safety/graphic-helmets",
        subCategory: "Safety",
        category: "Accessories",
        available: true,
        showInSearch: true,
        thumbnails: [
          "/assets/images/graphic-helmet1.jpg",
          "/assets/images/graphic-helmet2.jpg"
        ],
        availableSpecificCategoryVariants: [], // Left blank as per instructions
      },
      {
        specificCategoryCode: "tw",
        name: "Tank Wraps",
        commonPrice: 999,
        subtitles: [],
        description: "Transform your bike with Maddy Custom’s Tank Wraps. Our high-quality vinyl wraps provide a stylish and protective layer for your bike's tank, ensuring durability and a flawless finish. Enhance your bike's aesthetics while protecting the tank from scratches and minor damages with our customizable designs tailored to your unique style.",
        keywords: [
          "tank wrap",
          "custom tank wraps",
          "bike tank protection",
          "vinyl tank wraps",
          "motorcycle tank customization"
        ],
        pageSlug: "/wraps/bike-wraps/tank-wraps",
        subCategory: "Bike Wraps",
        category: "Wraps",
        available: true,
        showInSearch: true,
        thumbnails: [
          "/assets/images/tank-wrap1.jpg",
          "/assets/images/tank-wrap2.jpg"
        ],
        availableSpecificCategoryVariants: [], // Left blank as per instructions
      }
    ];

    // Delete all existing documents in the SpecificCategory collection
    await SpecificCategory.deleteMany({});
    console.log("All existing SpecificCategory documents have been deleted.");

    // Insert new specific categories
    await SpecificCategory.insertMany(specificCategories);
    console.log("New SpecificCategory documents have been inserted successfully.");

    return NextResponse.json({ message: "Specific categories have been successfully reset and populated." }, { status: 200 });
  } catch (error) {
    console.error("Error resetting SpecificCategory collection:", error);
    return NextResponse.json({ error: "Failed to reset SpecificCategory collection." }, { status: 500 });
  }
}
