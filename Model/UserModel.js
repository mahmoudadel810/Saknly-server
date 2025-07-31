import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            trim: true,
            maxlength: [20, 'First name cannot exceed 20 characters'],
        },
        lastName: {
            type: String,
            // required: [true, 'Last name is required'],
            // required: function () {
            //     return this.provider === 'local';
            // },
            trim: true,
            maxlength: [20, 'Last name cannot exceed 20 characters'],
        },
        userName: {
            type: String,
            required: [true, 'Your username is required'],
            trim: true,
            maxlength: [30, 'Username cannot exceed 30 characters'],
            minlength: [3, 'Username must be more than 3 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please enter a valid email',
            ],
        },
        password: {
            type: String,
            // required: [true, 'Password is required'],
            required: function () {
                return this.provider === 'local';
            },
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
            validate: {
                validator: function(v) {
                    return /^01[0-9]{9}$/.test(v);
                },
                message: props => `${props.value} is not a valid Egyptian phone number! Must be 11 digits starting with 01`
            },
            // match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'],
            // required: [true, 'Phone number is required'],
            required: function () {
                return this.provider === 'local';
            },
        },
        address: {
            type: String,
            // required: [true, 'Address is required'],
            required: function () {
                return this.provider === 'local';
            },
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        isConfirmed: {
            type: Boolean,
            default: false,
        },
        isLoggedIn: {
            type: Boolean,
            default: false
        },
        lastLoginAt: {
            type: Date,
        },
        lastLogoutAt: {
            type: Date,
        },
        status: {
            type: String,
            enum: ['active', 'in-active'],
            default: 'in-active',
        },
        provider: {
            type: String,
            enum: ['local', 'google'],
            default: 'local',
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordTokenExpiresIn: {
            type: Date,
        },
        wishlist: [{
            property: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Property'
            },
            addedAt: {
                type: Date,
                default: Date.now
            },
            notes: {
                type: String,
                trim: true
            }
        }]
    },
    {
        timestamps: true,
    }
);


// Add indices for optimization
userSchema.index({ email: 1, status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isConfirmed: 1 });
userSchema.index({ isLoggedIn: 1 });
userSchema.index({ status: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ resetPasswordTokenExpiresIn: 1 });
userSchema.index({ wishlist: 1 });





const User = mongoose.model('User', userSchema);

export default User; 