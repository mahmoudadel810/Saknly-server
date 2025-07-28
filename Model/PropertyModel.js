import mongoose from 'mongoose';
import crypto from 'crypto';

// Enum values for property types
const PROPERTY_TYPES = {
    APARTMENT: 'شقة',
    VILLA: 'فيلا',
    SHOP: 'محل',
    STUDIO: 'استوديو',
    DUPLEX: 'دوبلكس',
};

// Enum values for cities
const CITIES = [
    'شبين الكوم',
    'منوف',
    'تلا',
    'اشمون', // without hamza
    'أشمون', // with hamza
    'قويسنا',
    'بركة السبع',
    'الباجور',
    'طنطا',
    'مدينة السادات'
];

// Enum values for amenities
const AMENITIES = [
    'تكييف',
    'مصعد', 
    'شرفة',
    'موقف سيارات',
    'مسموح بالحيوانات الأليفة',
    'مفروشة جزئياً',
    'أمن',
    'نظام كهرباء ذكي',
    'مطبخ مجهز',
    'مخزن'
];

//this model suppose to add a property to the database , 


const propertySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Property title is required'],
            trim: true,
            maxlength: [70, 'Title cannot exceed 70 characters'],
        },
        description: {
            type: String,
            required: [true, 'Property description is required'],
            trim: true,
            maxlength: [400, 'Description cannot exceed 400 characters'],
        },
        type: {
            type: String,
            required: [true, 'Property type is required'],
            enum: {
                values: Object.values(PROPERTY_TYPES),
                message: 'Invalid property type'
            }
        },
        price: {
            type: Number,
            required: [true, 'Property price is required'],
            min: [0, 'Price cannot be negative'],
            max: [100000000 ,'Price cannot exceed 100M']
        },
        area: {
            type: Number,
            required: [true, 'Total area is required'],
            min: [60, 'Area must be at least 100sqm'],
        },
        bedrooms: {
            type: Number,
            required: [true, 'Number of bedrooms is required'],
            min: [0, 'Bedrooms cannot be negative'],
            max: [10, 'Bedrooms cannot exceed 10'],
        },
        bathrooms: {
            type: Number,
            required: [true, 'Number of bathrooms is required'],
            min: [1, 'Must have at least 1 bathroom'],
            max: [10, 'Bathrooms cannot exceed 10'],
        },
        floor: {
            type: Number,
            min: [0, 'Floor cannot be negative'],
        },
        totalFloors: {
            type: Number,
            min: [1, 'Total floors must be at least 1'],
        },
        location: {
            address: {
                type: String,
                required: [true, 'Address is required'],
                trim: true,
            },
            city: {
                type: String,
                required: [true, 'City is required'],
                trim: true,
                enum: {
                    values: CITIES,
                    message: 'Invalid city'
                }
            },
            district: {
                type: String,
                trim: true,
            },
            latitude: {
                type: Number,
                min: [-90, 'Latitude must be between -90 and 90'],
                max: [90, 'Latitude must be between -90 and 90'],
            },
            longitude: {
                type: Number,
                min: [-180, 'Longitude must be between -180 and 180'],
                max: [180, 'Longitude must be between -180 and 180'],
            },
        },
        images: [
            {
                publicId: {
                    type: String,
                    required: true,
                },
                url: {
                    type: String,
                    required: true,
                },
                alt: {
                    type: String,
                    default: 'Property image',
                },
                isMain: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        amenities: [
            {
                type: String,
                enum: {
                    values: AMENITIES,
                    message: 'Invalid amenity'
                }
            },
        ],
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Property owner is required'],
        },
        agent:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        agency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agency',
            required: false,
        },
        status: {
            type: String,
            enum: ['available', 'rented', 'sold', 'pending', 'inactive'],
            default: 'available',
        },
        isApproved: {
            type: Boolean,
            default: false,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: Date,
        rejectionReason: String,
        views: {
            type: Number,
            default: 0,
        },
        inquiries: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PropertyInquiry'
        }],
        favorites: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        contactInfo: {
            name: {
                type: String,
                required: [true, 'Contact name is required'],
                trim: true
            },
            phone: {
                type: String,
                required: [true, 'Contact phone is required'],
                trim: true
            },
            email: String,
            whatsapp: String,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        isNegotiable: {
            type: Boolean,
            default: false
        },
        // Student housing specific attributes
        isStudentFriendly: {
            type: Boolean,
            default: false
        },
        studentHousingDetails: {
            isEnabled: {
                type: Boolean,
                default: false
            },
            nearbyUniversities: [{
                name: String,
                distanceInKm: Number
            }],
            roomType: {
                type: String,
                enum: ['private', 'shared', 'dormitory', null],
                default: null
            },
            studentsPerRoom: {
                type: Number,
                min: [1, 'Students per room must be at least 1'],
                max: [4, 'Students per room cannot exceed 4'],
                default: 1
            },
            genderPolicy: {
                type: String,
                enum: ['male', 'female', 'mixed', null],
                default: null
            },
            academicYearOnly: {
                type: Boolean,
                default: false
            },
            semester: {
                type: String,
                enum: ['fall', 'spring', 'summer', 'academic-year', 'full-year', null],
                default: null
            }
        },
        slug: {
            type: String,
            unique: true,
        },
    },
    {
        discriminatorKey: 'category',
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);





// Indexes for better query performance
propertySchema.index({ type: 1, category: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ 'location.city': 1 });
propertySchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ isApproved: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ isStudentFriendly: 1 }); // New index for student housing filter
propertySchema.index({ 'studentHousingDetails.genderPolicy': 1 });
propertySchema.index({ 'studentHousingDetails.roomType': 1 });

// Virtual for main image
propertySchema.virtual('mainImage').get(function () {
    if (!Array.isArray(this.images)) return null;
    const mainImg = this.images.find(img => img.isMain);
    return mainImg || (this.images.length > 0 ? this.images[0] : null);
});

// Virtual for favorites count
propertySchema.virtual('favoritesCount').get(function () {
    return Array.isArray(this.favorites) ? this.favorites.length : 0;
});

// Virtual for inquiries count
propertySchema.virtual('inquiriesCount').get(function () {
    return Array.isArray(this.inquiries) ? this.inquiries.length : 0;
});

// Pre-save middleware to generate slug
propertySchema.pre('save', function (next) {
    if (this.isModified('title') || this.isNew) {
        const randomString = crypto.randomBytes(4).toString('hex');
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9\u0600-\u06FF -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim() + '-' + randomString;
    }

    // Auto-enable student housing details if marked as student friendly
    if (this.isStudentFriendly && !this.studentHousingDetails.isEnabled) {
        this.studentHousingDetails.isEnabled = true;
    }

    next();
});

// Method to increment views
propertySchema.methods.incrementViews = function ()
{
    this.views += 1;
    return this.save({ validateBeforeSave: false });
};

// Method to add to favorites
propertySchema.methods.addToFavorites = function (userId)
{
    if (!this.favorites.includes(userId))
    {
        this.favorites.push(userId);
    }
    return this.save({ validateBeforeSave: false });
};

// Method to remove from favorites
propertySchema.methods.removeFromFavorites = function (userId)
{
    this.favorites = this.favorites.filter(
        (favId) => favId.toString() !== userId.toString()
    );
    return this.save({ validateBeforeSave: false });
};

// Create the base model
const Property = mongoose.model('Property', propertySchema);

// Sale property schema
const SaleProperty = Property.discriminator('sale',
    new mongoose.Schema({
        deliveryDate: {
            type: Date 
        },
        deliveryTerms: {
            type: String,
            maxlength: [300, 'Delivery terms cannot exceed 300 characters']
        },
        paymentMethod: {
            type: String,
            required: [true, 'Payment method is required'],
            enum: ['cash', 'installment', 'cashOrInstallment'],
            default: 'cash'
        },
        downPayment: { // مقدم او تحت الحساب 
            type: Number,
            min: [0, 'Down payment cannot be negative']
        },
        installmentPeriodInYears: { // فترة التقسيط بالسنوات
            type: Number,
            min: [1, 'Installment period must be at least 1 year'],
            max: [30, 'Installment period cannot exceed 30 years']
        },
        minInstallmentAmount: { // الحد الأدنى للقسط
            type: Number,
            min: [0, 'Minimum installment amount cannot be negative']
        },
        ownershipType: {
            type: String,
            required: [true, 'Ownership type is required'],
            enum: ['firstOwner', 'resale'],
            default: 'firstOwner',
        },
        propertyStatus: {
            type: String,
            required: [true, 'Property status is required'],
            enum: ['ready', 'underConstruction'],
            default: 'ready'
        },
    })
); 

// Rent property schema
const RentProperty = Property.discriminator('rent',
    new mongoose.Schema({
        availableFrom: {
            type: Date,
            default: Date.now,
        },
        leaseDuration: {
            type: Number, // in months
            min: [1, 'Lease duration must be at least 1 month'],
            max: [120, 'Lease duration cannot exceed 120 months (10 years)']
        },
        deposit: {
            type: Number,
            min: [0, 'Deposit cannot be negative'],
        },
        utilities: {
            included: {
                type: Boolean,
                default: false,
            },
            cost: {
                type: Number,
                min: [0, 'Utilities cost cannot be negative']
            },
            details: {
                type: String,
                maxlength: [200, 'Utilities details cannot exceed 200 characters']
            }
        },
        rules: {
            pets: {
                type: Boolean,
                default: false,
            },
            parties: {
                type: Boolean,
                default: false,
            },
            other: {
                type: String,
                maxlength: [300, 'Other rules cannot exceed 500 characters']
            }
        }
    })
);

// Student Housing property schema
const StudentProperty = Property.discriminator('student',
    new mongoose.Schema({
        availableFrom: {
            type: Date,
            default: Date.now,
        },
        leaseDuration: {
            type: Number, // in months
            min: [1, 'Lease duration must be at least 1 month'],
            max: [120, 'Lease duration cannot exceed 120 months (10 years)']
        },
        deposit: {
            type: Number,
            min: [0, 'Deposit cannot be negative'],
        },
        utilities: {
            included: {
                type: Boolean,
                default: true,
            },
            cost: {
                type: Number,
                min: [0, 'Utilities cost cannot be negative']
            },
            details: {
                type: String,
                maxlength: [200, 'Utilities details cannot exceed 200 characters']
            }
        }
    })
);

export default Property;
export { SaleProperty, RentProperty, StudentProperty, PROPERTY_TYPES, CITIES, AMENITIES }; 