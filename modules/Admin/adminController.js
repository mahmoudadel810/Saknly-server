import User from '../../Model/UserModel.js';
import Property from '../../Model/PropertyModel.js';
import Agency from '../../Model/AgencyModel.js';
import Testimonial from '../../Model/TestimonialModel.js';

// Get analytics for admin dashboard
export const getAdminAnalytics = async (req, res) => {
  try {
    // Counts
    const [userCount, propertyCount, agencyCount, testimonialCount] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Agency.countDocuments(),
      Testimonial.countDocuments(),
    ]);

    // Recent activity (last 5)
    const [recentUsers, recentProperties, recentAgencies, recentTestimonials] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(5),
      Property.find().sort({ createdAt: -1 }).limit(5),
      Agency.find().sort({ createdAt: -1 }).limit(5),
      Testimonial.find().sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      userCount,
      propertyCount,
      agencyCount,
      testimonialCount,
      recentUsers,
      recentProperties,
      recentAgencies,
      recentTestimonials,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
}; 