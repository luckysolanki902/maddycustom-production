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
            productDescription: "Wrap Your Passion in Style! Evolve your {fullBikename} with Maddy Custom's {uniqueName} full bike wraps combine art and protection. Durable vinyl, precise fitment and easy maintenance. Choose from unique designs. Upgrade your bike's look, enhance its value",
            variantType: "modelVariant",
            name: fullname,
            cardCaptions: [],
            title: "Full Bike Wraps for a Bold New Look | Maddy Custom",
            subtitles: ["Give your bike a complete new look"],
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
            dimensions: {
              length: 31,
              breadth: 8,
              height: 8.5,
              weight: 0.07,
              boxWeight: 0.22,
              boxCapacity: 2
            }
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
            title: "Bike Tank Wraps for a Bold New Look | Maddy Custom",
            productDescription: "Upgrade your bike’s style with Maddy Custom's {uniqueName} tank wraps. Durable, scratch-resistant, and easy to apply, these premium vinyl wraps offer seamless fitment and stunning designs. Protect your tank and make your bike stand out effortlessly!",
            description: "Personalize your bike’s fuel tank with our high-quality wraps. Available in various designs and finishes to give your bike a standout appearance",
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
            dimensions: {
              length: 20,
              breadth: 6,
              height: 6,
              weight: 0.02,
              boxWeight: 0.15,
              boxCapacity: 4
            }
          },
          "tw-m": {
            variantType: "designVariant",
            name: "Medium Tank Wraps",
            title: "Bike Tank Wraps for a Bold New Look | Maddy Custom",
            productDescription: "Upgrade your bike’s style with Maddy Custom's {uniqueName} tank wraps. Durable, scratch-resistant, and easy to apply, these premium vinyl wraps offer seamless fitment and stunning designs. Protect your tank and make your bike stand out effortlessly!",
            description: "Personalize your bike’s fuel tank with our high-quality wraps. Available in various designs and finishes to give your bike a standout appearance",
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
            dimensions: {
              length: 20,
              breadth: 6,
              height: 6,
              weight: 0.02,
              boxWeight: 0.15,
              boxCapacity: 4
            }
          },
          "tw-w": {
            variantType: "designVariant",
            name: "Wide Tank Wraps",
            title: "Bike Tank Wraps for a Bold New Look | Maddy Custom",
            productDescription: "Upgrade your bike’s style with Maddy Custom's {uniqueName} tank wraps. Durable, scratch-resistant, and easy to apply, these premium vinyl wraps offer seamless fitment and stunning designs. Protect your tank and make your bike stand out effortlessly!",
            description: "Personalize your bike’s fuel tank with our high-quality wraps. Available in various designs and finishes to give your bike a standout appearance",
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
            dimensions: {
              length: 20,
              breadth: 6,
              height: 6,
              weight: 0.02,
              boxWeight: 0.15,
              boxCapacity: 4
            }
          }
        };

        for (const [variant_code, variant_info] of Object.entries(tank_variants)) {
          const isHelVariant = false; // Not applicable for tank wraps

          // SEO-friendly description
          const description = "Personalize your bike’s fuel tank with our high-quality wraps. Available in various designs and finishes to give your bike a standout appearance";
          // Keywords
          const keywords = variant_info.keywords;

          const variant = {
            variantCode: variant_code,
            variantType: variant_info.variantType,
            name: variant_info.name,
            title: "Bike Tank Wraps for a Bold New Look | Maddy Custom",
            subtitles: [],
            description: description,
            productDescription: "Upgrade your bike’s style with Maddy Custom's {uniqueName} tank wraps. Durable, scratch-resistant, and easy to apply, these premium vinyl wraps offer seamless fitment and stunning designs. Protect your tank and make your bike stand out effortlessly!",
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
            dimensions: {
              length: 20,
              breadth: 6,
              height: 6,
              weight: 0.02,
              boxWeight: 0.15,
              boxCapacity: 4
            }
          };

          variants.push(variant);
        }

      } else if (code === "win") {
        // Window Pillar Wraps
        const variant_code = "win";
        const variant_name = "Win Wraps";
        const description = "Make your vehicle's style unrivaled with MaddyCustom's Window Pillar Wraps. Available in a range of colors and finishes; these wraps add a sleek and modern touch to any car, ensuring long-lasting protection";
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
          title: "Shield Your Style with Premium Window Pillar Wraps | Maddy Custom",
          productDescription: "Enhance your car's pillars with the {uniqueName} window pillar wrap from Maddy Custom. Car pillar wraps offer an easy, budget-friendly way to customize your vehicle. Designed to fit perfectly on your car’s B-pillars, these wraps are simple to apply, adding an instant style boost without professional help. With a durable finish and eye-catchy design, they’re the ideal choice for affordable, DIY customization",
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
          variantInfo: '', // Empty for non-tank and non-fbw variants,
          dimensions: {
            length: 31,
            breadth: 8.5,
            height: 8.5,
            weight: 0.08,
            boxWeight: 0.23,
            boxCapacity: 4
          }
        };

        variants.push(variant);

      } else if (code === "hel") {
        // Graphic Helmets
        const variant_code = "hel";
        const variant_name = "Helmet Store";
        const description = "Protect your ride and express your style with MaddyCustom's Graphic Helmets. Custom designs and premium quality. Durable, scratch-resistant and comfortable";
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
          productDescription: "Explore the {uniqueName} helmet from Maddy Custom's Helmet Store. Combining style and safety, this helmet features high-impact resistant materials and customizable graphics. Ride with confidence and flaunt your personality with this premium helmet",
          subtitles: ["Best designed helmets of India with safety"],
          description: description,
          title: "Helmet Goals: Achieved! | Maddy Custom",
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
          dimensions: {
            length: 34,
            breadth: 34,
            height: 28,
            weight: 1,
            boxWeight: 0.1,
            boxCapacity: 1
          }
        };

        variants.push(variant);

      } else if (code === "bw") {
        // Bonnet Strip Wraps
        const variant_code = "bsw";
        const variant_name = "Bonnet Strip Wraps";
        const description = "Make a bold statement with our high-quality bonnet wraps. Choose from matte, glossy or carbon fiber finishes to give your car a distinctive look that stands out on the road";
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
          productDescription: "Transform Your Ride's Frontline with Maddy Custom's {uniqueName} bonnet wraps which offer unrivaled customization. Select from various materials, colors and finishes. Stand out from the crowd, upgrade your car today!",
          title: "Bonnet Strip Wraps for a Bold New Look | Maddy Custom",
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
          variantInfo: '', // Empty for non-tank and non-fbw variants,
          dimensions: {
            length: 31,
            breadth: 8,
            height: 8.5,
            weight: 0.07,
            boxWeight: 0.22,
            boxCapacity: 2
          }
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
