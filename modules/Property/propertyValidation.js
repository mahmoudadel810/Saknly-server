import joi from 'joi';
import { PROPERTY_TYPES, CITIES, AMENITIES, GOVERNORATES, MAX_PRICE, MIN_AREA } from '../../Model/PropertyModel.js';

// Multipart bodies arrive as strings: Joi converts "5" -> 5 and "true" -> true,
// and multer expands bracket keys (location[city]) into nested objects.
// Empty strings from optional form fields are treated as "not sent".
const num = () => joi.number().empty('');
const bool = () => joi.boolean().empty('');
const str = (max) => joi.string().trim().max(max).empty('');
const objectId = () => joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).empty('');

const locationFields = {
    address: str(300),
    // optional: the model derives it from the city and rejects a city from another governorate
    governorate: joi.string().trim().valid(...GOVERNORATES).empty(''),
    city: joi.string().trim().valid(...CITIES),
    district: str(100),
    latitude: num().min(-90).max(90),
    longitude: num().min(-180).max(180),
};

const contactFields = {
    name: str(100),
    phone: str(30),
    email: joi.string().trim().email({ tlds: { allow: false } }).empty(''),
    whatsapp: str(30),
};

// Fields shared by create and update (all optional here; create adds .required() below)
const commonFields = {
    title: str(70),
    description: str(400),
    type: joi.string().trim().valid(...Object.values(PROPERTY_TYPES)),
    price: num().min(0).max(MAX_PRICE),
    area: num().min(MIN_AREA),
    bedrooms: num().integer().min(0).max(10),
    bathrooms: num().integer().min(1).max(10),
    floor: num().integer().min(0),
    totalFloors: num().integer().min(1),
    amenities: joi.array().items(joi.string().trim().valid(...AMENITIES)).single(),
    isNegotiable: bool(),
    isStudentFriendly: bool(),
    studentHousingDetails: joi.object({
        isEnabled: bool(),
        nearbyUniversities: joi.array().items(joi.object({
            name: str(100),
            distanceInKm: num().min(0),
        }).unknown(true)).single(),
        roomType: joi.string().valid('private', 'shared', 'dormitory').empty(''),
        studentsPerRoom: num().integer().min(1).max(4),
        genderPolicy: joi.string().valid('male', 'female', 'mixed').empty(''),
        academicYearOnly: bool(),
        semester: joi.string().valid('fall', 'spring', 'summer', 'academic-year', 'full-year').empty(''),
    }).unknown(true),

    // sale
    paymentMethod: joi.string().valid('cash', 'installment', 'cashOrInstallment').empty(''),
    ownershipType: joi.string().valid('firstOwner', 'resale').empty(''),
    propertyStatus: joi.string().valid('ready', 'underConstruction').empty(''),
    downPayment: num().min(0),
    installmentPeriodInYears: num().min(1).max(30),
    minInstallmentAmount: num().min(0),
    deliveryDate: joi.date().empty(''),
    deliveryTerms: str(300),

    // rent / student
    availableFrom: joi.date().empty(''),
    leaseDuration: num().min(1).max(120),
    deposit: num().min(0),
    utilities: joi.object({
        included: bool(),
        cost: num().min(0),
        details: str(200),
    }).unknown(true),
    rules: joi.object({
        pets: bool(),
        parties: bool(),
        other: str(300),
    }).unknown(true),

    // admin only (ignored by the controller for non-admins)
    agency: objectId(),
    status: joi.string().valid('available', 'rented', 'sold', 'pending', 'inactive').empty(''),
};

// Unknown keys are allowed through validation; the controller whitelists what it stores
export const PropertyValidator = {
    body: joi.object({
        ...commonFields,
        title: commonFields.title.required(),
        description: commonFields.description.required(),
        type: commonFields.type.required(),
        category: joi.string().valid('sale', 'rent', 'student').required(),
        price: commonFields.price.required(),
        area: commonFields.area.required(),
        bedrooms: commonFields.bedrooms.required(),
        bathrooms: commonFields.bathrooms.required(),
        location: joi.object({
            ...locationFields,
            address: locationFields.address.required(),
            city: locationFields.city.required(),
        }).unknown(true).required(),
        contactInfo: joi.object({
            ...contactFields,
            name: contactFields.name.required(),
            phone: contactFields.phone.required(),
        }).unknown(true).required(),
    }).unknown(true),
};

// Partial update: nothing required
export const UpdatePropertyValidator = {
    body: joi.object({
        ...commonFields,
        location: joi.object(locationFields).unknown(true),
        contactInfo: joi.object(contactFields).unknown(true),
        images: joi.array().items(joi.object({
            publicId: joi.string().required(),
            isMain: bool(),
        }).unknown(true)),
        imagesToDelete: joi.array().items(joi.string()).single(),
    }).unknown(true),
};
