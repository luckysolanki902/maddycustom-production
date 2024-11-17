import dbConnect from '../../../lib/dbConnect';
import HappyCustomer from '../../../models/HappyCustomer';

export default async function handler(req, res) {
  const { parentSpecificCategoryVariantId } = req.query;

  if (!parentSpecificCategoryVariantId) {
    return res.status(400).json({ error: 'parentSpecificCategoryVariantId is required' });
  }

  try {
    await dbConnect();

    // Fetch happy customers where the placement refId matches the given variant ID or isGlobal is true
    const happyCustomers = await HappyCustomer.find({
      $or: [
        { isGlobal: true },
        { 'placements.refId': parentSpecificCategoryVariantId },
      ],
      isActive: true,
    })
      .sort({ isGlobal: -1, globalDisplayOrder: 1, 'placements.displayOrder': 1 }) // Global customers first, then sort by orders
      .select('name photo');

    res.status(200).json({ happyCustomers });
  } catch (error) {
    console.error('Error fetching happy customers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
