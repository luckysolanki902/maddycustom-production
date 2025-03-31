import mongoose from 'mongoose';

const SupportRequestSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true },
    email: { type: String },
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    issue: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'unresolved'],
      default: 'pending',
    },
    resolvedBy: {
      type: String,
      enum: ['ai', 'support team'],
      default: 'ai',
    },
    department: {
      type: String,
      enum: ['production', 'marketing'],
      default: 'production',
    },
    // New field to store the AI's response
    aiResponse: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

if(mongoose.models.SupportRequest){
  delete mongoose.models.SupportRequest
}

export default mongoose.models.SupportRequest ||
  mongoose.model('SupportRequest', SupportRequestSchema);
