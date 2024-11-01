// Delete all products, specific category variants and specific categories

import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../middleware';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

export async function GET(request) {
    try {
        // Connect to the database
        await connectToDatabase();  

        // Delete all products
        await Product.deleteMany({});

        // Delete all specific category variants
        await SpecificCategoryVariant.deleteMany({});

        // Delete all specific categories
        await SpecificCategory.deleteMany({});

        return NextResponse.json({ message: 'Products, specific category variants and specific categories deleted successfully' });
    } catch (error) {
        console.error(error);   
        return NextResponse.json({ message: 'Error deleting products, specific category variants and specific categories' }, { status: 500 });
    }
}



