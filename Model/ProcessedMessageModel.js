import mongoose from "mongoose";

// Queue messages a consumer has claimed or handled. RabbitMQ delivers at least once,
// so a duplicate or redelivered message must not send a second email.
const processedMessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    queue: { type: String, required: true },
    status: { type: String, enum: ['processing', 'done'], default: 'processing' },
    claimedAt: { type: Date, default: Date.now },
    // Identifies the current holder, so a run can only release its own claim (not one taken over from it)
    claimToken: { type: String },
    // TTL index: records go after 7 days, long past any redelivery
    processedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

processedMessageSchema.index({ messageId: 1, queue: 1 }, { unique: true });

export default mongoose.models.ProcessedMessage || mongoose.model("ProcessedMessage", processedMessageSchema);
