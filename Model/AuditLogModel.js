import mongoose from "mongoose";

// One row per domain event, written by the audit.log consumer (bound to every routing key)
const auditLogSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    type: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
    // Ids and short non-sensitive fields only: no emails, links, codes or message bodies
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
