import Comment from '../../Model/CommentModel.js';
import propertyModel from '../../Model/PropertyModel.js';
import { AppError, asyncHandler } from '../../middelWares/errorMiddleware.js';

// جلب كل التعليقات لعقار معين
export const getCommentsByProperty = asyncHandler(async (req, res, next) => {
  const { propertyId } = req.params;
  const comments = await Comment.find({ property: propertyId })
    .populate('user', 'userName firstName lastName')
    .sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: comments,
  });
});

// إضافة تعليق جديد لعقار
export const addComment = asyncHandler(async (req, res, next) => {
  const { propertyId } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    return next(new AppError('نص التعليق مطلوب ولا يزيد عن 1000 حرف', 400));
  }

  // تحقق من وجود العقار (المنشور فقط)
  const property = await propertyModel.findById(propertyId).select('isApproved isActive');
  if (!property || !property.isApproved || !property.isActive) {
    return next(new AppError('العقار غير موجود', 404));
  }

  // إنشاء التعليق
  const comment = await Comment.create({
    property: propertyId,
    user: userId,
    text: text.trim(),
  });

  await comment.populate('user', 'userName firstName lastName');

  res.status(201).json({
    success: true,
    data: comment,
    message: 'تم إضافة التعليق بنجاح',
  });
}); 