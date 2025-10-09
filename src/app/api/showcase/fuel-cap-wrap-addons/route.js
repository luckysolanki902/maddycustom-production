// /api/showcase/fuel-cap-wrap-addons
// Returns low-cost add-on products for a given variantCode (prefix mapping) with pagination.
// Query params:
//   variantCode=FRC (full code or partial prefix)
//   page=1
//   pageSize=6
// Response: { ok: true, variantCode, page, pageSize, total, products: [ { _id, name, price, images, pageSlug } ] }
// Fallback gracefully to empty list if no matches.

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import connectToDatabase from '@/lib/db';

export const revalidate = 600; // cache for 10 minutes (ISR)

export async function GET(req) {
	const url = new URL(req.url);
	const variantCodeRaw = (url.searchParams.get('variantCode') || '').trim();
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const pageSize = Math.min(24, Math.max(1, parseInt(url.searchParams.get('pageSize') || '6', 10)));

	// Optional similarity context (one-time snapshot from cart when viewcart opened)
	const designGroupIdsParam = (url.searchParams.get('designGroupIds') || '').trim(); // comma separated ObjectId strings
	const nameTokensParam = (url.searchParams.get('nameTokens') || '').trim(); // comma separated, already lowercased tokens

	let designGroupIds = [];
	if (designGroupIdsParam) {
		designGroupIds = designGroupIdsParam.split(',')
			.map(s => s.trim())
			.filter(s => /^[0-9a-fA-F]{24}$/.test(s))
			.map(s => new mongoose.Types.ObjectId(s));
	}

	let nameTokens = [];
	if (nameTokensParam) {
		nameTokens = nameTokensParam.split(',')
			.map(t => t.trim().toLowerCase())
			.filter(Boolean)
			.slice(0, 12); // safety cap
	}

		try {
			await connectToDatabase();
	} catch (err) {
		return NextResponse.json({ ok: false, error: 'db_connect_failed' }, { status: 500 });
	}

	if (!variantCodeRaw) {
		return NextResponse.json({ ok: true, variantCode: '', page, pageSize, total: 0, products: [] });
	}

	try {
		// Strategy: Find SpecificCategoryVariants whose variantCode starts with provided code (case-insensitive)
		// Then fetch Products referencing those variants via specificCategoryVariant field.
		const regex = new RegExp('^' + variantCodeRaw, 'i');
		const matchingVariantDocs = await SpecificCategoryVariant.find({ variantCode: regex, available: true })
			.select('_id variantCode name')
			.lean();
		const variantIds = matchingVariantDocs.map(v => v._id);

		if (!variantIds.length) {
			return NextResponse.json({ ok: true, variantCode: variantCodeRaw, page, pageSize, total: 0, products: [] });
		}

		// Base product filter: available, low price heuristic (<= 750) to keep list add-on focused.
		const baseMatch = {
			specificCategoryVariant: { $in: variantIds },
			available: true,
			price: { $gt: 0, $lte: 750 },
		};

		// Count before pagination (ignore similarity weighting)
		const total = await Product.countDocuments(baseMatch);

		// Similarity scoring: designGroupId match gets high weight; each name token match adds smaller weight.
		// If no context provided, similarityScore will be 0 so ordering reverts to price asc, createdAt desc.
		const similarityScoreExpr = [];
		if (designGroupIds.length) {
			similarityScoreExpr.push({
				$cond: [{ $in: ['$designGroupId', designGroupIds] }, 10, 0]
			});
		}
		if (nameTokens.length) {
			for (const token of nameTokens) {
				// Basic word boundary-ish regex (contains) case-insensitive
				// Using $regexMatch for performance vs building large alternation
				similarityScoreExpr.push({
					$cond: [
						{ $regexMatch: { input: { $toLower: '$name' }, regex: token } },
						2,
						0
					]
				});
			}
		}

				const aggregation = [
			{ $match: baseMatch },
			// Add similarity score only if context present
			{ $addFields: {
				similarityScore: similarityScoreExpr.length ? { $add: similarityScoreExpr } : 0
			}},
			{ $sort: { similarityScore: -1, price: 1, createdAt: -1 } },
			{ $skip: (page - 1) * pageSize },
			{ $limit: pageSize },
						// Lookup options and sort by inventory availability (highest first)
						{
							$lookup: {
								from: 'options',
								let: { productId: '$_id' },
								pipeline: [
									{ $match: { $expr: { $eq: ['$product', '$$productId'] } } },
									{
										$lookup: {
											from: 'inventories',
											localField: 'inventoryData',
											foreignField: '_id',
											as: 'inventoryData'
										}
									},
									{ $unwind: { path: '$inventoryData', preserveNullAndEmptyArrays: true } },
									{ $sort: { 'inventoryData.availableQuantity': -1 } }
								],
								as: 'options'
							}
						},
						{ $project: { _id: 1, name: 1, price: 1, MRP: 1, images: 1, pageSlug: 1, specificCategoryVariant: 1, category: 1, subCategory: 1, options: 1 } }
		];

		const products = await Product.aggregate(aggregation).exec();

		return NextResponse.json({
			ok: true,
			variantCode: variantCodeRaw,
			page,
			pageSize,
			total,
			products,
			// debug info (optional): lengths of similarity context; remove if not needed in prod
			context: { dg: designGroupIds.length, tokens: nameTokens.length }
		});
	} catch (err) {
		console.error('[fuel-cap-wrap-addons] error', err);
		return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
	}
}

