const mongoose = require('mongoose');

// B2B Order schema: captures bulk inquiry style orders without pricing
const B2BOrderSchema = new mongoose.Schema({
	businessName: { type: String, required: true, trim: true },
	contactName: { type: String, required: true, trim: true },
	contactEmail: { type: String, required: true, trim: true, lowercase: true },
	contactPhone: { type: String, required: true, trim: true },
	role: { type: String, required: false, trim: true },
	address: {
		line1: { type: String, required: false, trim: true },
		line2: { type: String, required: false, trim: true },
		city:  { type: String, required: false, trim: true },
		state: { type: String, required: false, trim: true },
		pincode: { type: String, required: false, trim: true },
		country: { type: String, default: 'India', trim: true }
	},
	notes: { type: String, default: '' },
	status: { type: String, default: 'pending', enum: ['pending','review','quoted','closed'] },
	items: [
		{
			product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
			option: { type: mongoose.Schema.Types.ObjectId, ref: 'Option' },
			sku: { type: String, required: true },
			name: { type: String, required: true },
			quantity: { type: Number, required: true, min: 1 },
			thumbnail: { type: String },
			wrapFinish: { type: String },
		}
	]
}, { timestamps: true });

if (mongoose.models.B2BOrder) {
	delete mongoose.models.B2BOrder; // hot reload safety
}

module.exports = mongoose.models.B2BOrder || mongoose.model('B2BOrder', B2BOrderSchema);

