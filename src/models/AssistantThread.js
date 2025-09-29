import mongoose from 'mongoose';

const AssistantThreadSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    threadId: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.AssistantThread || mongoose.model('AssistantThread', AssistantThreadSchema);
