import mongoose from 'mongoose';

const SupportRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    threadId: { type: String },
    mobile: { type: String, required: true },
    email: { type: String },
    category: { type: String, required: true },
    subcategory: { type: String },
    issue: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'resolved', 'cancelled'], default: 'pending' },
    resolvedBy: { type: String, enum: ['ai', 'human'], default: 'ai' },
    department: { type: String, enum: ['production', 'marketing', 'support', 'ops', 'sales'], default: 'support' },
    aiResponse: { type: String },
    chatLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportUserChats' },
    metadata: { type: Object },
  },
  { timestamps: true }
);

if(mongoose.models.SupportRequest){
  delete mongoose.models.SupportRequest
}

export default mongoose.models.SupportRequest ||
  mongoose.model('SupportRequest', SupportRequestSchema);
