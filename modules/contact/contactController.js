import ContactUs from "../../Model/ContactModel.js";
import { asyncHandler, AppError } from "../../middelWares/errorMiddleware.js";
import { validation } from '../../middelWares/validation.js';

//=========================Submit Contact Form====================================
export const submitContactForm = asyncHandler(async (req, res, next) =>
{
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message)
    {
        return next(new AppError("All fields are required", 400));
    }

    const newContact = await ContactUs.create({
        name,
        email,
        subject,
        message
    });

    res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: newContact
    });
});

//=========================Get All Contacts====================================
export const getContacts = asyncHandler(async (req, res, next) =>
{
    const contacts = await ContactUs.find().sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: contacts
    });
});

//=========================Update Contact Status====================================
export const updateContactStatus = asyncHandler(async (req, res, next) =>
{
    const { id } = req.params;
    const { status } = req.body;

    if (!status)
    {
        return next(new AppError("Status is required", 400));
    }

    const updatedContact = await ContactUs.findByIdAndUpdate(
        id,
        { status },
        { new: true }
    );

    if (!updatedContact)
    {
        return next(new AppError("Message not found", 404));
    }

    res.status(200).json({
        success: true,
        message: 'Message status updated successfully',
        data: updatedContact
    });
});

//=========================Delete Contact====================================
export const deleteContact = asyncHandler(async (req, res, next) =>
{
    const { id } = req.params;

    const deletedContact = await ContactUs.findByIdAndDelete(id);

    if (!deletedContact)
    {
        return next(new AppError("Message not found", 404));
    }

    res.status(200).json({
        success: true,
        message: 'Message deleted successfully'
    });
});