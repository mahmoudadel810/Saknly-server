import joi from "joi";

const objectId = () => joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": "المعرف غير صحيح",
});

export const addTestimonialValidator = {
  body: joi.object({
    name: joi.string().trim().min(2).max(50).required().messages({
      "string.empty": "الاسم مطلوب",
      "any.required": "الاسم مطلوب",
    }),
    text: joi.string().trim().min(5).max(1000).required().messages({
      "string.empty": "الرأي مطلوب",
      "any.required": "الرأي مطلوب",
    }),
    image: joi.string().uri({ scheme: ["https", "http"] }).allow("", null),
    role: joi.string().trim().max(50).allow("", null),
    type: joi.string().valid("general", "property", "agency").required().messages({
      "any.only": "نوع الرأي يجب أن يكون عام أو عقار أو وكالة",
      "any.required": "نوع الرأي مطلوب",
    }),
    propertyId: joi.when("type", {
      is: "property",
      then: objectId().required().messages({ "any.required": "يجب تحديد العقار" }),
      otherwise: joi.any().strip(),
    }),
    agencyId: joi.when("type", {
      is: "agency",
      then: objectId().required().messages({ "any.required": "يجب تحديد الوكالة" }),
      otherwise: joi.any().strip(),
    }),
  }).options({ stripUnknown: true }),
};

export const updateTestimonialStatusValidator = {
  body: joi.object({
    status: joi.string().valid("approved", "rejected", "pending").required().messages({
      "any.only": "الحالة غير صحيحة",
      "any.required": "الحالة مطلوبة",
    }),
  }),
  params: joi.object({
    id: objectId().required(),
  }),
};
