import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
	{
		role: { type: String, required: true, enum: ['user', 'assistant', 'system', 'tool'] },
		kind: { type: String, default: 'text' },
		text: { type: String, default: '' },
		toolName: { type: String },
		toolArgs: mongoose.Schema.Types.Mixed,
		toolSummary: mongoose.Schema.Types.Mixed,
		handoff: mongoose.Schema.Types.Mixed,
		meta: mongoose.Schema.Types.Mixed,
		timestamp: { type: Date, default: Date.now }
	},
	{ _id: false }
);

const AssistantChatLogSchema = new mongoose.Schema(
	{
		userId: { type: String, required: true, index: true },
		threadId: { type: String, required: true, index: true },
		sessionId: { type: String, required: true },
		messages: { type: [MessageSchema], default: [] }
	},
	{ timestamps: true }
);

AssistantChatLogSchema.index({ userId: 1, threadId: 1 }, { unique: true });

export default mongoose.models.AssistantChatLog || mongoose.model('AssistantChatLog', AssistantChatLogSchema);
