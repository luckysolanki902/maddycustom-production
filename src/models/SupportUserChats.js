import mongoose from 'mongoose';

const SupportUserChatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  threadId: { type: String, required: false },
  messages: [
    {
      role: { type: String, enum: ['user'], default: 'user' },
      text: { type: String, required: true },
      at: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

export default mongoose.models.SupportUserChats || mongoose.model('SupportUserChats', SupportUserChatsSchema);
