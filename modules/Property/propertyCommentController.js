import Comment from '../../Model/CommentModel.js';
import propertyModel from '../../Model/PropertyModel.js';
import { AppError, asyncHandler } from '../../middelWares/errorMiddleware.js';

// جلب كل التعليقات لعقار معين
export const getCommentsByProperty = asyncHandler(async (req, res, next) => {
  const { propertyId } = req.params;
  const comments = await Comment.find({ property: propertyId })
    .populate('user', 'userName email')
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

  // تحقق من وجود العقار
  const property = await propertyModel.findById(propertyId);
  if (!property) {
    return next(new AppError('العقار غير موجود', 404));
  }

  // إنشاء التعليق
  const comment = await Comment.create({
    property: propertyId,
    user: userId,
    text,
  });

  await comment.populate('user', 'userName email');

  res.status(201).json({
    success: true,
    data: comment,
    message: 'تم إضافة التعليق بنجاح',
  });
}); 