import mongoose from "mongoose";

// Queue messages a consumer has already handled. RabbitMQ delivers at least once,
// so a redelivered message (worker crash before ack) must not send a second email.
const processedMessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    queue: { type: String, required: true },
    // TTL index: records go after 7 days, long past any redelivery
    processedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

processedMessageSchema.index({ messageId: 1, queue: 1 }, { unique: true });

export default mongoose.models.ProcessedMessage || mongoose.model("ProcessedMessage", processedMessageSchema);
