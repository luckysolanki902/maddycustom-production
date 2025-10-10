import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ['user', 'assistant', 'tool'], required: true },
        kind: {
            type: String,
            enum: ['text', 'tool', 'classification', 'handoff'],
            default: 'text'
        },
        text: { type: String, maxlength: 500 },
        toolName: { type: String },
        toolArgs: { type: mongoose.Schema.Types.Mixed },
        toolSummary: { type: mongoose.Schema.Types.Mixed },
        classification: { type: mongoose.Schema.Types.Mixed },
        handoff: {
            type: new mongoose.Schema(
                {
                    type: { type: String },
                    phone: String,
                    url: String
                },
                { _id: false }
            ),
            default: null
        },
        timestamp: { type: Date, default: Date.now }
    },
    { _id: false }
);

const AssistantChatLogSchema = new mongoose.Schema(
    {
        userId: { type: String, index: true, required: true },
        threadId: { type: String, index: true },
        sessionId: { type: String, index: true },
        messages: { type: [MessageSchema], default: [] }
    },
    { timestamps: true }
);

AssistantChatLogSchema.index({ userId: 1, sessionId: 1 });
AssistantChatLogSchema.index({ userId: 1, threadId: 1 });

export default mongoose.models.AssistantChatLog || mongoose.model('AssistantChatLog', AssistantChatLogSchema);
