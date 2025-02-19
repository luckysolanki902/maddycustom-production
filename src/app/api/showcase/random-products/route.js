import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  // Accept the extra parameter "number" for the total product count (default to 10 if not provided)
  const numberParam = parseInt(searchParams.get('number'), 10) || 10;

  if (!categoryCode) {
    return NextResponse.json(
      { message: "Category parameter is required." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  try {
    // Find the specific category using its unique code
    const specificCategory = await SpecificCategory.findOne({ specificCategoryCode: categoryCode });
    if (!specificCategory) {
      return NextResponse.json(
        { message: "Category not found." },
        { status: 404 }
      );
    }

    // Find available variants for this category
    const variants = await SpecificCategoryVariant.find({
      specificCategory: specificCategory._id,
      available: true,
    });
    if (!variants || variants.length === 0) {
      return NextResponse.json(
        { message: "No variants found for this category." },
        { status: 404 }
      );
    }

    const requested = numberParam; // total desired products
    const availableVariants = variants.length;
    let allocation = []; // will hold objects: { variant, count }

    // Shuffle variants for randomness
    const shuffledVariants = variants.sort(() => Math.random() - 0.5);

    if (availableVariants >= 2 * requested) {
      // When many variants are available, sample fewer variants but with two products from some.
      // We choose k = ceil(requested / 2) variants.
      const k = Math.ceil(requested / 2);
      const selected = shuffledVariants.slice(0, k);
      // Determine how many variants should contribute 2 products.
      // (requested - k) gives the count of 2-product allocations.
      const countTwo = requested - k;
      for (let i = 0; i < k; i++) {
        const count = i < countTwo ? 2 : 1;
        allocation.push({ variant: selected[i], count });
      }
    } else if (availableVariants >= requested) {
      // Enough variants to provide one product each.
      const selected = shuffledVariants.slice(0, requested);
      allocation = selected.map(v => ({ variant: v, count: 1 }));
    } else {
      // Fewer variants than requested: return one product per available variant.
      allocation = shuffledVariants.map(v => ({ variant: v, count: 1 }));
    }

    // For each allocated variant, fetch the designated number of random products.
    const productPromises = allocation.map(({ variant, count }) =>
      Product.aggregate([
        { $match: { specificCategoryVariant: variant._id } },
        { $sample: { size: count } },
      ])
    );
    const productArrays = await Promise.all(productPromises);
    let products = productArrays.flat();

    // Final shuffle of the products array before returning
    products = products.sort(() => Math.random() - 0.5);

    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error("Error fetching random products:", error.message);
    return NextResponse.json(
      { message: "Error fetching random products" },
      { status: 500 }
    );
  }
}
