import authRoutes from "./Auth/authRoutes.js";
import userRoutes from './User/userRoutes.js';
import propertyRoutes from './Property/propertyRoutes.js';
import contactRoutes from './contact/contactRoutes.js';
import propertyInquiryRoutes from './Property/propertyInquiry/propertyInquiryRoutes.js';
import agencyRoutes from './Agency/agencyRoutes.js';
import testimonialRoutes from "./Testimonial/testimonialRoutes.js";

import propertyCommentRoutes from './Property/propertyCommentRoutes.js';

import chatRoutes from "./chatBot/chat.routes.js";
import adminRoutes from './Admin/adminRoutes.js';

const routes = {
  auth: {
    path: '/api/saknly/v1/auth',
    router: authRoutes
  },
  agencies: {
    path: '/api/saknly/v1/agencies',
    router: agencyRoutes
  },
  properties: {
    path: '/api/saknly/v1/properties',
    router: propertyRoutes
  },
  users: {
    path: '/api/saknly/v1/users',
    router: userRoutes
  },
  propertyInquiry: {
    path: '/api/saknly/v1/property-inquiry',
    router: propertyInquiryRoutes
  },
  contact: {
    path: '/api/saknly/v1/contact',
    router: contactRoutes
  },
  testimonial: {
    path: '/api/saknly/v1/testimonial',
    router: testimonialRoutes
  },

  propertyComments: {
    path: '/api/saknly/v1/property-comments',
    router: propertyCommentRoutes
  },
  chat: {
    path: '/api/saknly/v1/chat', // ممكن تعدلي المسار حسب اللي محتاجاه
    router: chatRoutes

  },
  admin: {
    path: '/api/saknly/v1/admin',
    router: adminRoutes
  }
};

export default routes; 