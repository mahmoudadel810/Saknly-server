import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "زائر",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function() {
        return this.type === 'general' ? 'approved' : 'pending';
      },
    },
    type: {
      type: String,
      enum: ["general", "property", "agency"],
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Testimonial", testimonialSchema); 