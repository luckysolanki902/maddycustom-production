// /app/api/create-from-scratch/specific-category-variant/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Define file paths
    const productsFilePath = path.join(process.cwd(), 'public', 'json', 'MaddyCustom2.products.json');

    // Load products data
    let productsData;
    try {
      const productsContent = fs.readFileSync(productsFilePath, 'utf-8');
      productsData = JSON.parse(productsContent);
    } catch (err) {
      console.error(`Failed to load products data from '${productsFilePath}':`, err);
      return NextResponse.json({ error: "Failed to load products data." }, { status: 500 });
    }

    // Define FBW Bike Codes
    const fbw_bike_codes = [
      "rid", "pn16", "rc3", "yr1", "duk3", "ap16", "rec3", "spl", "pns1", "mt"
    ];

    // Fetch Specific Categories from DB
    const specificCategories = await SpecificCategory.find({});
    if (!specificCategories.length) {
      console.error("No SpecificCategory documents found.");
      return NextResponse.json({ error: "No SpecificCategory documents found." }, { status: 400 });
    }

    // Helper Functions
    const url_friendly = (name) => {
      return encodeURIComponent(name.toLowerCase().replace(/ /g, '-'));
    };

    const generate_features = (isHelVariant) => {
      const features = [
        {
          name: "Easy Replacement",
          imageUrl: "/assets/icons/boxorder.png"
        },
        {
          name: "UV Ray Protection",
          imageUrl: "/assets/icons/uvprotection.png"
        }
      ];

      if (isHelVariant) {
        features.splice(1, 0, {
          name: "Safety of Brands",
          imageUrl: "/assets/icons/safe.png"
        });
      } else {
        features.splice(1, 0, {
          name: "3 Layers Protection",
          imageUrl: "/assets/icons/3L.png"
        });
      }

      return features;
    };

    const generate_sizes = (isHelVariant) => {
      if (isHelVariant) {
        return {
          applicable: true,
          availableSizes: ['S', 'M', 'L', 'XL', 'XXL']
        };
      } else {
        return {
          applicable: false,
          availableSizes: []
        };
      }
    };

    // Initialize variants array
    let variants = [];

    // Iterate over Specific Categories to generate variants
    for (const specific_category of specificCategories) {
      const code = specific_category.specificCategoryCode;
      const page_slug = specific_category.pageSlug;

      if (code === "fbw") {
        // Full Bike Wraps: Generate variants based on fbw_bike_codes
        for (const code_variant of fbw_bike_codes) {
          const product = productsData.find(prod => prod.BikeCode === code_variant);
          if (!product) {
            console.warn(`No product found with BikeCode '${code_variant}'. Skipping variant.`);
            continue;
          }
          const fullname = product.BikeFullName;
          if (!fullname) {
            console.warn(`Product with BikeCode '${code_variant}' has no BikeFullName. Skipping variant.`);
            continue;
          }

          const designTemplateFolderPath = `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${code_variant}/`;
          const isHelVariant = (code_variant.toLowerCase() === 'hel');

          // SEO-friendly description
          const description = `Enhance and protect your ${fullname} with Maddy Custom’s premium Full Bike Wraps. Our wraps are crafted from high-quality vinyl, ensuring durability and a flawless finish. Choose from a variety of colors and designs to customize your bike to perfection.`;

          // Define keywords for FBW variants
          const keywords = [
            `${fullname.toLowerCase()} bike wrap`,
            `custom ${fullname.toLowerCase()} wrap`,
            `${fullname.toLowerCase()} vinyl wrap`,
            `bike customization`,
            `durable ${fullname.toLowerCase()} wrap`
          ];

          // Construct the variant object
          const variant = {
            variantCode: code_variant,
            variantType: "modelVariant",
            name: fullname,
            cardCaptions: [],
            subtitles: [`Give your bike a complete new look`],
            description: description,
            keywords: keywords,
            pageSlug: `${page_slug}/${url_friendly(fullname)}`,
            designTemplateFolderPath: designTemplateFolderPath,
            imageFolderPath: `products/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${code_variant.toLowerCase()}`,
            specificCategory: specific_category._id,
            available: false,
            showCase: [],
            features: generate_features(isHelVariant),
            sizes: generate_sizes(isHelVariant),
            variantInfo: fullname,
          };

          // If it's a 'hel' variant, add availableBrands
          if (isHelVariant) {
            variant.availableBrands = [
              {
                brandName: "Studds",
                brandLogo: "/assets/logos/third-party-logos/studds.png",
                brandBasePrice: 1190,
              },
              // Add more brands if needed
            ];
          }

          variants.push(variant);
        }

      } else if (code === "tw") {
        // Tank Wraps: Generate variants tw-s, tw-m, tw-w
        const tank_variants = {
          "tw-s": {
            variantType: "designVariant",
            name: "Slim Tank Wraps",
            description: "Slim Tank Wraps offer a sleek and streamlined look for your vehicle's tank. Perfect for those seeking a minimalistic design without compromising on protection.",
            keywords: [
              "slim tank wrap",
              "tank wrap slim",
              "minimalistic tank wrap",
              "vehicle tank customization",
              "slim vinyl tank wraps"
            ],
            pageSlug: `${page_slug}/slim-tank-wraps`,
            designTemplateFolderPath: `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/tw-s`,
            variantInfo: "Choose if your bike has a plain slim tank like: pulsar, xtream, splendor, etc.",
          },
          "tw-m": {
            variantType: "designVariant",
            name: "Medium Tank Wraps",
            description: "Medium Tank Wraps strike the perfect balance between style and protection. Ideal for those who want a noticeable yet tasteful enhancement to their vehicle's tank.",
            keywords: [
              "medium tank wrap",
              "tank wrap medium",
              "balanced tank wrap",
              "vehicle tank customization",
              "medium vinyl tank wraps"
            ],
            pageSlug: `${page_slug}/medium-tank-wraps`,
            designTemplateFolderPath: `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/tw-m`,
            variantInfo: "Choose if your bike has a little thick tank like: classic350, jawa, etc.",
          },
          "tw-w": {
            variantType: "designVariant",
            name: "Wide Tank Wraps",
            description: "Wide Tank Wraps provide a bold and expansive look for your vehicle's tank. Designed for maximum visual impact and comprehensive protection.",
            keywords: [
              "wide tank wrap",
              "tank wrap wide",
              "bold tank wrap",
              "vehicle tank customization",
              "wide vinyl tank wraps"
            ],
            pageSlug: `${page_slug}/wide-tank-wraps`,
            designTemplateFolderPath: `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/tw-w`,
            variantInfo: "Choose if your bike has a wide matte finish in between tank or wide sticker from before: tvs-raider, gixxer, apache, continental-gt, etc.",
          }
        };

        for (const [variant_code, variant_info] of Object.entries(tank_variants)) {
          const isHelVariant = false; // Not applicable for tank wraps

          // SEO-friendly description
          const description = `Enhance and protect your vehicle with Maddy Custom’s ${variant_info.name} Tank Wraps. Our high-quality vinyl wraps provide a stylish and protective layer for your tank, ensuring durability and a flawless finish. Choose from our ${variant_info.name.toLowerCase()} designs tailored to your unique style.`;

          // Keywords
          const keywords = variant_info.keywords;

          const variant = {
            variantCode: variant_code,
            variantType: variant_info.variantType,
            name: variant_info.name,
            subtitles: [],
            description: description,
            keywords: keywords,
            cardCaptions: [], // Empty array as per requirement
            pageSlug: variant_info.pageSlug,
            designTemplateFolderPath: variant_info.designTemplateFolderPath,
            imageFolderPath: `products/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code.toLowerCase()}`,
            specificCategory: specific_category._id,
            available: true,
            showCase: [],
            features: generate_features(isHelVariant),
            sizes: generate_sizes(isHelVariant),
            variantInfo: variant_info.variantInfo,
          };

          variants.push(variant);
        }

      } else if (code === "win") {
        // Window Pillar Wraps
        const variant_code = "win";
        const variant_name = "Win Wraps";
        const description = "Car pillar wraps offer an easy, budget-friendly way to customize your vehicle. Designed to fit perfectly on your car’s B-pillars, these wraps are simple to apply, adding an instant style boost without professional help. With a durable finish and eye-catching design, they’re the ideal choice for affordable, DIY customization.";
        const keywords = [
          "win wrap",
          "window pillar wrap",
          "car pillar protection",
          "vehicle pillars",
          "custom wraps"
        ];
        const pageSlug = `${page_slug}/win-wraps`;
        const designTemplateFolderPath = `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code}`;
        const showCase = [{
          available: true,
          url: '/assets/videos/header-videos/win_wrap_showcase1.mp4'
        }];

        const cardCaptions = ['both side window wrap', 'universal size - fits on all car'];

        const isHelVariant = false;

        const variant = {
          variantCode: variant_code,
          variantType: "designVariant",
          name: variant_name,
          subtitles: ["car window pillar wraps"],
          description: description,
          keywords: keywords,
          cardCaptions: cardCaptions, // Set only for 'win' variant
          pageSlug: pageSlug,
          designTemplateFolderPath: designTemplateFolderPath,
          imageFolderPath: `products/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code.toLowerCase()}`,
          specificCategory: specific_category._id,
          available: true,
          showCase: showCase,
          features: generate_features(isHelVariant),
          sizes: generate_sizes(isHelVariant),
          variantInfo: '', // Empty for non-tank and non-fbw variants
        };

        variants.push(variant);

      } else if (code === "hel") {
        // Graphic Helmets
        const variant_code = "hel";
        const variant_name = "Helmet Store";
        const description = "Explore Maddy Custom’s Helmet Store, offering the best-designed helmets in India with uncompromised safety. Our helmets feature high-impact resistant materials and customizable graphics to reflect your personality while ensuring maximum protection.";
        const keywords = [
          "helmet store",
          "graphic helmets",
          "safety helmets",
          "custom helmets",
          "motorcycle helmets",
          "stylish helmets"
        ];
        const pageSlug = `${page_slug}/helmet-store`;
        const designTemplateFolderPath = `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code}`;

        const availableBrands = [
          {
            brandName: "Studds",
            brandLogo: "/assets/logos/third-party-logos/studds.png",
            brandBasePrice: 1190,
          },
          // Uncomment and add more brands as needed
          // {
          //   brandName: "Steelbird",
          //   brandLogo: "/assets/logos/third-party-logos/steelbird.png",
          //   brandBasePrice: 1090,
          // }
        ];

        const isHelVariant = true;

        const variant = {
          variantCode: variant_code,
          variantType: "designVariant",
          name: variant_name,
          subtitles: ["Best designed helmets of India with safety"],
          description: description,
          keywords: keywords,
          cardCaptions: [], // Empty array as per requirement
          pageSlug: pageSlug,
          designTemplateFolderPath: designTemplateFolderPath,
          imageFolderPath: `products/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code.toLowerCase()}`,
          specificCategory: specific_category._id,
          available: true,
          showCase: [],
          availableBrands: availableBrands, // Set only for 'hel' variant
          features: generate_features(isHelVariant),
          sizes: generate_sizes(isHelVariant),
          variantInfo: '', // Empty for non-tank and non-fbw variants
        };

        variants.push(variant);

      } else if (code === "bw") {
        // Bonnet Strip Wraps
        const variant_code = "bsw";
        const variant_name = "Bonnet Strip Wraps";
        const description = "Bonnet Strip Wraps offer a sleek and protective layer for your car's bonnet. Designed for easy application, these wraps enhance your vehicle's aesthetics while safeguarding against scratches and minor damages. Enjoy a stylish upgrade without the need for professional installation.";
        const keywords = [
          "bonnet strip wrap",
          "car bonnet protection",
          "vehicle bonnet",
          "custom bonnet wraps",
          "vinyl bonnet wraps"
        ];
        const pageSlug = `${page_slug}/bonnet-strip-wraps`;
        const designTemplateFolderPath = `design-templates/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code}`;

        const isHelVariant = false;

        const variant = {
          variantCode: variant_code,
          variantType: "designVariant",
          name: variant_name,
          subtitles: [], // No subtitles for Bonnet Strip Wraps
          description: description,
          keywords: keywords,
          cardCaptions: [], // Empty array as per requirement
          pageSlug: pageSlug,
          designTemplateFolderPath: designTemplateFolderPath,
          imageFolderPath: `products/${specific_category.category.toLowerCase().replace(/\s+/g, '-')}/${specific_category.subCategory.toLowerCase().replace(/\s+/g, '-')}/${specific_category.name.toLowerCase().replace(/\s+/g, '-')}/${variant_code.toLowerCase()}`,
          specificCategory: specific_category._id,
          available: true,
          showCase: [],
          features: generate_features(isHelVariant),
          sizes: generate_sizes(isHelVariant),
          variantInfo: '', // Empty for non-tank and non-fbw variants
        };

        variants.push(variant);
      } else {
        console.warn(`No variant generation logic defined for Specific Category Code '${code}'. Skipping.`);
      }
    }

    // Delete all existing SpecificCategoryVariant documents
    await SpecificCategoryVariant.deleteMany({});

    // Insert new SpecificCategoryVariant documents
    const insertedVariants = await SpecificCategoryVariant.insertMany(variants);

    // Update SpecificCategory documents with availableSpecificCategoryVariants
    for (const variant of insertedVariants) {
      await SpecificCategory.findByIdAndUpdate(
        variant.specificCategory,
        {
          $push: {
            availableSpecificCategoryVariants: {
              variantCode: variant.variantCode,
              name: variant.name,
              image: variant.features.length > 0 ? variant.features[0].imageUrl : ""
            }
          }
        }
      );
    }

    return NextResponse.json({ message: "Specific category variants have been successfully reset and populated." }, { status: 200 });
  } catch (error) {
    console.error("Error resetting SpecificCategoryVariant collection:", error);
    return NextResponse.json({ error: "Failed to reset SpecificCategoryVariant collection." }, { status: 500 });
  }
}
