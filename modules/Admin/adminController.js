import User from '../../Model/UserModel.js';
import Property from '../../Model/PropertyModel.js';
import Agency from '../../Model/AgencyModel.js';
import Testimonial from '../../Model/TestimonialModel.js';
import PropertyInquiry from '../../Model/PropertyInquiryModel.js';
import ContactUs from '../../Model/ContactModel.js';
import { asyncHandler } from '../../middelWares/errorMiddleware.js';

// Get analytics for admin dashboard (counts + recent activity, no secrets)
export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const [
    userCount,
    propertyCount,
    pendingPropertyCount,
    agencyCount,
    testimonialCount,
    inquiryCount,
    contactCount,
  ] = await Promise.all([
    User.countDocuments(),
    Property.countDocuments(),
    Property.countDocuments({ status: 'pending' }),
    Agency.countDocuments(),
    Testimonial.countDocuments(),
    PropertyInquiry.countDocuments(),
    ContactUs.countDocuments(),
  ]);

  // Recent activity (last 5) - only display-safe fields
  const [recentProperties, recentAgencies, recentTestimonials] = await Promise.all([
    Property.find().sort({ createdAt: -1 }).limit(5)
      .select('title category type price status isApproved isActive location.city createdAt'),
    Agency.find().sort({ createdAt: -1 }).limit(5).select('name logo isFeatured createdAt'),
    Testimonial.find().sort({ createdAt: -1 }).limit(5).select('name text type status createdAt'),
  ]);

  res.json({
    userCount,
    propertyCount,
    pendingPropertyCount,
    agencyCount,
    testimonialCount,
    inquiryCount,
    contactCount,
    recentProperties,
    recentAgencies,
    recentTestimonials,
  });
});
