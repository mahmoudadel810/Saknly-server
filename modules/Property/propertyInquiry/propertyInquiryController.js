import propertyInquiryModel from "../../../Model/PropertyInquiryModel.js";
import propertyModel from "../../../Model/PropertyModel.js";
import userModel from "../../../Model/UserModel.js";
import { asyncHandler, AppError } from "../../../middelWares/errorMiddleware.js";
import
{
  applyPagination,
  createPaginatedResponse,
} from "../../../utils/pagination.js";
import sendEmail from "../../../services/sendEmail.js";


export const createPropertyInquiry = asyncHandler(async (req, res, next) => {
  const { property, name, email, phone, message } = req.body;
  const propertyId = property;

  if (!propertyId || !name || !email || !phone || !message) {
    return next(new AppError("All fields are required", 400));
  }

  // Validate that property exists
  const propertyDoc = await propertyModel.findById(propertyId);
  if (!propertyDoc) {
    return next(new AppError("Property not found", 404));
  }

  // Check if property is active and approved
  if (!propertyDoc.isActive || !propertyDoc.isApproved) {
    return next(new AppError("Property is not available for inquiries", 400));
  }

  // Create inquiry
  const inquiry = await propertyInquiryModel.create({
    property: propertyId,
    name,
    email,
    phone,
    message,
    agent: propertyDoc.agent || propertyDoc.owner, // Assign to agent if exists, otherwise to owner
  });

  // Populate property and agent details
  await inquiry.populate([
    { path: "property", select: "title price location images" },
    { path: "agent", select: "userName email phone" },
  ]);

  // Notify property agent/owner about the inquiry
  if (inquiry.agent)
  {  
    try
    {
      const agent = await userModel.findById(inquiry.agent);
      if (agent && agent.email)
      {
        await sendEmail({
          to: agent.email,
          subject: "New Property Inquiry",
          message: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>New Property Inquiry</h2>
              <p>You have received a new inquiry about property: ${inquiry.property.title || 'N/A'}</p>
              <p><strong>From:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone}</p>
              <p><strong>Message:</strong> ${message}</p>
              <p>Please respond to this inquiry as soon as possible.</p>
            </div>
          `
        });
      }
    } catch (error)
    {
      console.log("Failed to send agent notification email:", error);
      // Continue execution as the inquiry was created successfully
    }
  }

  // 2. Find the property and push the new inquiry's ID to it
  await propertyModel.findByIdAndUpdate(
    propertyId,
    { $push: { inquiries: inquiry._id } }
  );

  res.status(201).json({
    success: true,
    message: "Property inquiry submitted successfully",
    data: inquiry,
  });
});


export const getPropertyInquiries = asyncHandler(async (req, res, next) =>
{
  const { page = 1, limit = 10, status, propertyId, isRead, search } = req.query;

  // Build filter object
  const filter = {};

  // If user is agent, only show inquiries assigned to them
  if (req.user.role === "agent")
  {
    filter.agent = req.user._id;
  }

  if (status)
  {
    filter.status = status;
  }

  if (propertyId)
  {
    filter.property = propertyId;
  }

  if (isRead !== undefined)
  {
    filter.isRead = isRead === "true";
  }

  if (search)
  {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
    ];
  }

  const inquiries = await propertyInquiryModel.find(filter)
    .populate([
      { path: "property", select: "title price location images" },
      { path: "agent", select: "userName email phone" },
    ])
    .sort({ createdAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  const total = await propertyInquiryModel.countDocuments(filter);

  res.status(200).json({
    success: true,
    message: "Property inquiries retrieved successfully",
    data: inquiries,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    },
  });
});

export const getPropertyInquiryById = asyncHandler(async (req, res, next) =>
{
  const { id } = req.params;

  const inquiry = await propertyInquiryModel.findById(id).populate([
    { path: "property", select: "title price location images owner agent" },
    { path: "agent", select: "userName email phone" },
  ]);

  if (!inquiry)
  {
    return next(new AppError("Property inquiry not found", 404));
  }

  // Check if user has access to this inquiry
  if (req.user.role === "agent" && inquiry.agent.toString() !== req.user._id.toString())
  {
    return next(new AppError("Not authorized to access this inquiry", 403));
  }

  // Mark as read if not already read
  if (!inquiry.isRead)
  {
    inquiry.isRead = true;
    await inquiry.save();
  }

  res.status(200).json({
    success: true,
    message: "Property inquiry retrieved successfully",
    data: inquiry,
  });
});


export const updateInquiryStatus = asyncHandler(async (req, res, next) =>
{
  const { id } = req.params;
  const { status } = req.body;

  if (!status)
  {
    return next(new AppError("Status is required", 400));
  }

  // Validate status
  const validStatuses = ["new", "in-progress", "responded", "closed"];
  if (!validStatuses.includes(status))
  {
    return next(new AppError("Invalid status value", 400));
  }

  const inquiry = await propertyInquiryModel.findById(id);

  if (!inquiry)
  {
    return next(new AppError("Property inquiry not found", 404));
  }

  // Check if user has access to this inquiry
  if (req.user.role === "agent" && inquiry.agent.toString() !== req.user._id.toString())
  {
    return next(new AppError("Not authorized to update this inquiry", 403));
  }

  inquiry.status = status;
  await inquiry.save();

  res.status(200).json({
    success: true,
    message: "Inquiry status updated successfully",
    data: inquiry,
  });
});


export const deletePropertyInquiry = asyncHandler(async (req, res, next) =>
{
  const { id } = req.params;

  const inquiry = await propertyInquiryModel.findById(id);

  if (!inquiry)
  {
    return next(new AppError("Property inquiry not found", 404));
  }

  // Only admin can delete inquiries
  if (req.user.role !== "admin")
  {
    return next(new AppError("Not authorized to delete inquiries", 403));
  }

  await propertyInquiryModel.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Property inquiry deleted successfully",
  });
});

export const getInquiryStats = asyncHandler(async (req, res) =>
{
  const stats = await propertyInquiryModel.aggregate([
    {
      $group: {
        _id: null,
        totalInquiries: { $sum: 1 },
        newInquiries: {
          $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] },
        },
        inProgressInquiries: {
          $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
        },
        respondedInquiries: {
          $sum: { $cond: [{ $eq: ["$status", "responded"] }, 1, 0] },
        },
        closedInquiries: {
          $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
        },
        unreadInquiries: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
      },
    },
  ]);

  const statusDistribution = await propertyInquiryModel.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const agentStats = await propertyInquiryModel.aggregate([
    {
      $group: {
        _id: "$agent",
        totalInquiries: { $sum: 1 },
        newInquiries: {
          $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] },
        },
        unreadInquiries: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
      },
    },
    { $sort: { totalInquiries: -1 } },
    { $limit: 10 },
  ]);

  // Populate agent names
  const agentStatsWithNames = await propertyInquiryModel.populate(agentStats, {
    path: "_id",
    select: "userName email",
    model: "User",
  });

  res.status(200).json({
    success: true,
    message: "Inquiry statistics retrieved successfully",
    data: {
      overview: stats[0] || {
        totalInquiries: 0,
        newInquiries: 0,
        inProgressInquiries: 0,
        respondedInquiries: 0,
        closedInquiries: 0,
        unreadInquiries: 0,
      },
      statusDistribution,
      topAgents: agentStatsWithNames,
    },
  });
});
