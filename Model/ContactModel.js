import mongoose from "mongoose";



const contactUsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email',
        ],
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        maxlength: [100, 'Subject cannot exceed 100 characters'],
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'closed'],
        default: 'pending',
    }
})

const ContactUs = mongoose.model('ContactUs', contactUsSchema);

export default ContactUs;