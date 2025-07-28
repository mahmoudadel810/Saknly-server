import joi from "joi";

export const addTestimonialValidator = joi.object({
  name: joi.string().min(2).max(50).required().messages({
    "string.empty": "الاسم مطلوب",
    "any.required": "الاسم مطلوب",
  }),
  text: joi.string().min(5).max(1000).required().messages({
    "string.empty": "الرأي مطلوب",
    "any.required": "الرأي مطلوب",
  }),
  image: joi.string().uri().allow("", null),
  role: joi.string().allow("", null),
  type: joi.string().valid("general", "property", "agency").required().messages({
    "any.only": "نوع الرأي يجب أن يكون عام أو عقار أو وكالة",
    "any.required": "نوع الرأي مطلوب",
  }),
  propertyId: joi.when("type", {
    is: "property",
    then: joi.string().required().messages({ "any.required": "يجب تحديد العقار" }),
    otherwise: joi.string().allow(null, ""),
  }),
  agencyId: joi.when("type", {
    is: "agency",
    then: joi.string().required().messages({ "any.required": "يجب تحديد الوكالة" }),
    otherwise: joi.string().allow(null, ""),
  }),
}); 