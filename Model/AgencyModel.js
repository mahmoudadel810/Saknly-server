
import mongoose from 'mongoose';

const agencySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الوكالة مطلوب'],
    trim: true,
    maxlength: [70, 'اسم الوكالة لا يزيد عن 70 حرف'],
  },
  logo: {
    publicId: { type: String, required: [true, 'PublicId مطلوب'] },
    url: { type: String, required: [true, 'رابط الشعار مطلوب'] },
  },
  description: {
    type: String,
    trim: true,
    maxlength: [512, 'الوصف لا يزيد عن 512 حرف'],
  },
  isFeatured: {
    type: Boolean,
    default: true,
  },
  properties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
  }],
}, { timestamps: true });

const Agency = mongoose.model('Agency', agencySchema);
export default Agency;