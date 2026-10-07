// Demo data for Saknly (Menoufia area, Arabic content).
//
//   npm run seed            -> seeds an EMPTY database (refuses if data exists)
//   npm run seed -- --reset -> wipes the Saknly collections and re-seeds
//
// Passwords: SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD, otherwise strong random ones are generated and printed once.
import './loadEnv.js'; // must stay the first import
import crypto from 'crypto';
import mongoose from 'mongoose';

import User from '../Model/UserModel.js';
import Agency from '../Model/AgencyModel.js';
import Property, { PROPERTY_TYPES, CITIES, AMENITIES } from '../Model/PropertyModel.js';
import Comment from '../Model/CommentModel.js';
import PropertyInquiry from '../Model/PropertyInquiryModel.js';
import ContactUs from '../Model/ContactModel.js';
import Testimonial from '../Model/TestimonialModel.js';
import { hashFunction } from './passwordHashing.js';

const RESET = process.argv.includes('--reset');
const EMAIL_DOMAIN = 'saknly.example.com';

// Same rules as POST /auth/register: 5-30 chars, 1 uppercase, 1 digit, 1 symbol
const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{5,30}$/;

const generatePassword = () =>
{
    const symbols = '!@#$%^&*';
    const body = crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
    const symbol = symbols[crypto.randomInt(symbols.length)];
    return `${body}${String.fromCharCode(65 + crypto.randomInt(26))}${crypto.randomInt(10)}${symbol}`;
};

const resolvePassword = (envName) =>
{
    const fromEnv = process.env[envName];
    if (fromEnv)
    {
        if (!PASSWORD_RULE.test(fromEnv))
        {
            throw new Error(`${envName} does not meet the password rules (5-30 chars, 1 uppercase, 1 digit, 1 symbol)`);
        }
        return { value: fromEnv, generated: false };
    }
    return { value: generatePassword(), generated: true };
};

const id = () => new mongoose.Types.ObjectId();

// Demo listing photos: real-estate photos from Unsplash (Unsplash License, free to use), served from
// images.unsplash.com, which the client's next.config.mjs already allows. Each listing gets three photos that
// match its type (apartment, villa, duplex, shop, studio, student room), indexed like the `properties` array
// below. Every URL was checked to return 200 and to show property.
const UNSPLASH = (photo) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1600&q=80`;
const LISTING_PHOTOS = [
    // 0 apartment for sale, Shebin El Kom: building, living room, kitchen
    ['photo-1704640728496-bb1756181fda', 'photo-1560185127-6ed189bf02f4', 'photo-1732044790214-2930623d3edc'],
    // 1 villa for sale, Sadat City: house and lawn, garden pool, living room
    ['photo-1782939355849-4a748ada9c84', 'photo-1782939355736-fc6ed5c24b88', 'photo-1782939355626-8df602c595fb'],
    // 2 duplex for sale, Menouf: two exteriors, living room
    ['photo-1766603636700-e9d80473f40f', 'photo-1690731987727-ab5daed3620b', 'photo-1631510390389-c1e4fb20ff31'],
    // 3 shop for sale, Quesna: storefront, counter, empty unit
    ['photo-1782971638979-980f65112527', 'photo-1790049687819-9dd37662276e', 'photo-1641159930908-e9eb9ccdc002'],
    // 4 furnished apartment for rent, Menouf: living room, bedroom, kitchen
    ['photo-1560184897-67f4a3f9a7fa', 'photo-1560448075-57d0285fc59b', 'photo-1630699144641-72fa7a6b8aa1'],
    // 5 duplex for rent, Tala: house with pool, living room, bedroom
    ['photo-1613490493576-7fde63acd811', 'photo-1666585958641-4f70887372a1', 'photo-1630699375019-c334927264df'],
    // 6 shop for rent, El Bagour: shopfront, corner shop, vacant units
    ['photo-1734539724637-1f325ce24116', 'photo-1678528854861-7a05ff744221', 'photo-1748731268804-061cffd76797'],
    // 7 apartment for rent, Ashmoun: building, living room, kitchen
    ['photo-1704641116242-7d74a85b207d', 'photo-1630699034151-f6f726975c0a', 'photo-1630699293784-9f977570255a'],
    // 8 student housing (girls): bedroom with desk, bedroom, kitchen
    ['photo-1652882860938-f90aa298e644', 'photo-1638454668466-e8dbd5462f20', 'photo-1630699376167-3870469e7598'],
    // 9 student studio: studio room, kitchenette, living corner
    ['photo-1702014859878-5d4743176d28', 'photo-1702014862053-946a122b920d', 'photo-1702014859908-d48b9b844240'],
    // 10 apartment for sale, Birket El Sab (pending): new building, facades
    ['photo-1617341623760-1919df79274c', 'photo-1664813953897-ada06817c48c', 'photo-1784492003162-8897437fec4b'],
    // 11 student rooms, Sadat City (pending): single rooms, study desk
    ['photo-1614715661635-abb0547c125c', 'photo-1530334580314-1e7a340426a0', 'photo-1674162406360-df5ec5eb97e4'],
];

// publicIds are namespaced "saknly-seed/..." so deleting a seeded listing never touches a real upload
const imagesFor = (index) => LISTING_PHOTOS[index % LISTING_PHOTOS.length].map((photo, i) => ({
    publicId: `saknly-seed/property-${index + 1}-${i + 1}`,
    url: UNSPLASH(photo),
    alt: 'صورة العقار',
    isMain: i === 0,
}));

// Agency logos: a generated initials mark (SVG data URI) instead of a borrowed image. The client renders
// data: URLs unoptimized (shared/ui/listing/AgencyLogo.tsx).
const initialsLogo = (letter, background) => `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="${background}"/>`
    + `<text x="48" y="50" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans Arabic, Tahoma, Arial, sans-serif" font-size="48" font-weight="700" fill="#FFFFFF">${letter}</text></svg>`,
)}`;
const AGENCY_LOGOS = [initialsLogo('د', '#0E5E57'), initialsLogo('م', '#1F5F99'), initialsLogo('س', '#A15C07')];

const buildData = () =>
{
    const adminPassword = resolvePassword('SEED_ADMIN_PASSWORD');
    const demoPassword = resolvePassword('SEED_DEMO_PASSWORD');
    const adminHash = hashFunction({ payload: adminPassword.value });
    const demoHash = hashFunction({ payload: demoPassword.value });

    // ---------------- users
    const admin = {
        _id: id(), userName: 'Saknly Admin', firstName: 'مدير', lastName: 'سكنلي',
        email: `admin@${EMAIL_DOMAIN}`, password: adminHash, phone: '01000000001',
        address: 'شبين الكوم، المنوفية', role: 'admin', isConfirmed: true, status: 'active', provider: 'local',
    };

    const demoUsers = [
        ['ahmed.ali', 'أحمد', 'علي', '01012345671', 'منوف، شارع الجيش'],
        ['fatma.hassan', 'فاطمة', 'حسن', '01123456782', 'قويسنا، شارع المحطة'],
        ['karim.mahmoud', 'كريم', 'محمود', '01234567893', 'تلا، منطقة الفيلات'],
        ['sara.ibrahim', 'سارة', 'إبراهيم', '01098765434', 'شبين الكوم، شارع الجمهورية'],
        ['omar.khaled', 'عمر', 'خالد', '01511223345', 'مدينة السادات، المنطقة الأولى'],
        ['mona.adel', 'منى', 'عادل', '01155667786', 'أشمون، شارع سعد زغلول'],
    ].map(([handle, firstName, lastName, phone, address]) => ({
        _id: id(), userName: handle, firstName, lastName,
        email: `${handle}@${EMAIL_DOMAIN}`, password: demoHash, phone, address,
        role: 'user', isConfirmed: true, status: 'active', provider: 'local',
    }));
    const [ahmed, fatma, karim, sara, omar, mona] = demoUsers;

    // ---------------- agencies
    const agencies = [
        { _id: id(), name: 'دلتا للتسويق العقاري', description: 'خبرة أكثر من 15 عاماً في سوق العقارات بشبين الكوم ومراكز المنوفية.', isFeatured: true },
        { _id: id(), name: 'المنوفية للتطوير العقاري', description: 'مشروعات سكنية وتجارية في منوف وقويسنا بأنظمة سداد مرنة.', isFeatured: true },
        { _id: id(), name: 'السادات هومز', description: 'وحدات سكنية وفيلات في مدينة السادات بالقرب من الجامعة والمنطقة الصناعية.', isFeatured: false },
    ].map((agency, i) => ({
        ...agency,
        logo: { publicId: `saknly-seed/agency-${i + 1}`, url: AGENCY_LOGOS[i] },
        properties: [],
    }));
    const [delta, menoufia, sadat] = agencies;

    // ---------------- properties
    const T = PROPERTY_TYPES;
    const base = (owner, contactName, contactPhone) => ({
        owner: owner._id,
        contactInfo: { name: contactName, phone: contactPhone, email: owner.email, whatsapp: contactPhone },
        status: 'available',
        isApproved: true,
        isActive: true,
        approvedBy: admin._id,
        approvedAt: new Date(),
    });

    const properties = [
        // ----- sale
        {
            title: 'شقة للبيع بشارع الجمهورية في شبين الكوم', description: 'شقة 150 متر تشطيب سوبر لوكس، 3 غرف نوم وحمامين وريسبشن كبير، قريبة من جامعة المنوفية.',
            type: T.APARTMENT, category: 'sale', price: 1850000, area: 150, bedrooms: 3, bathrooms: 2, floor: 4, totalFloors: 8,
            location: { address: 'شارع الجمهورية', governorate: 'المنوفية', city: 'شبين الكوم', district: 'وسط البلد', latitude: 30.5590, longitude: 31.0108 },
            amenities: ['تكييف', 'مصعد', 'شرفة'], paymentMethod: 'cash', ownershipType: 'resale', propertyStatus: 'ready',
            ...base(sara, 'سارة إبراهيم', sara.phone), agency: delta._id, views: 240, isNegotiable: true,
        },
        {
            title: 'فيلا مستقلة للبيع في مدينة السادات', description: 'فيلا 350 متر مع حديقة خاصة وجراج، تقسيط حتى 7 سنوات.',
            type: T.VILLA, category: 'sale', price: 6500000, area: 350, bedrooms: 5, bathrooms: 4, floor: 0, totalFloors: 2,
            location: { address: 'الحي السابع', governorate: 'المنوفية', city: 'مدينة السادات', district: 'الحي السابع', latitude: 30.3626, longitude: 30.5263 },
            amenities: ['موقف سيارات', 'أمن', 'مطبخ مجهز'], paymentMethod: 'cashOrInstallment', downPayment: 1500000,
            installmentPeriodInYears: 7, minInstallmentAmount: 45000, ownershipType: 'firstOwner', propertyStatus: 'ready',
            ...base(omar, 'عمر خالد', omar.phone), agency: sadat._id, views: 410,
        },
        {
            title: 'دوبلكس للبيع في منوف تحت الإنشاء', description: 'دوبلكس 220 متر بمدخل خاص، استلام بعد سنة، مقدم 30% والباقي على 5 سنوات.',
            type: T.DUPLEX, category: 'sale', price: 2900000, area: 220, bedrooms: 4, bathrooms: 3, floor: 5, totalFloors: 6,
            location: { address: 'شارع الجيش', governorate: 'المنوفية', city: 'منوف', district: 'الجيش' },
            amenities: ['مصعد', 'شرفة', 'مخزن'], paymentMethod: 'installment', downPayment: 870000, installmentPeriodInYears: 5,
            ownershipType: 'firstOwner', propertyStatus: 'underConstruction', deliveryDate: new Date('2027-12-31'),
            deliveryTerms: 'استلام نصف تشطيب',
            ...base(ahmed, 'أحمد علي', ahmed.phone), agency: menoufia._id, views: 130,
        },
        {
            title: 'محل تجاري للبيع على الطريق الرئيسي في قويسنا', description: 'محل 75 متر بواجهة كبيرة، يصلح لجميع الأنشطة.',
            type: T.SHOP, category: 'sale', price: 1200000, area: 75, bedrooms: 0, bathrooms: 1, floor: 0, totalFloors: 4,
            location: { address: 'طريق شبين - قويسنا', governorate: 'المنوفية', city: 'قويسنا', district: 'المحطة' },
            amenities: ['أمن'], paymentMethod: 'cash', ownershipType: 'resale', propertyStatus: 'ready',
            ...base(fatma, 'فاطمة حسن', fatma.phone), views: 75,
        },
        // ----- rent
        {
            title: 'شقة مفروشة للإيجار في منوف', description: 'شقة 120 متر مفروشة جزئياً، غرفتين نوم، قريبة من المستشفى العام.',
            type: T.APARTMENT, category: 'rent', price: 4500, area: 120, bedrooms: 2, bathrooms: 1, floor: 3, totalFloors: 5,
            location: { address: 'شارع المستشفى', governorate: 'المنوفية', city: 'منوف' },
            amenities: ['تكييف', 'مفروشة جزئياً', 'مطبخ مجهز'], leaseDuration: 12, deposit: 9000,
            utilities: { included: false, cost: 400, details: 'الكهرباء والمياه على المستأجر' },
            rules: { pets: false, parties: false, other: 'للعائلات فقط' },
            ...base(ahmed, 'أحمد علي', ahmed.phone), views: 320,
        },
        {
            title: 'دوبلكس للإيجار في تلا بمنطقة الفيلات', description: 'دوبلكس 250 متر بحديقة صغيرة، 4 غرف نوم و3 حمامات.',
            type: T.DUPLEX, category: 'rent', price: 9000, area: 250, bedrooms: 4, bathrooms: 3, floor: 0, totalFloors: 2,
            location: { address: 'منطقة الفيلات بجوار النادي', governorate: 'المنوفية', city: 'تلا' },
            amenities: ['موقف سيارات', 'أمن', 'شرفة'], leaseDuration: 24, deposit: 18000,
            utilities: { included: false }, rules: { pets: true, parties: false },
            ...base(karim, 'كريم محمود', karim.phone), views: 95,
        },
        {
            title: 'محل للإيجار في الباجور', description: 'محل 60 متر على شارع تجاري حيوي.',
            type: T.SHOP, category: 'rent', price: 6000, area: 60, bedrooms: 0, bathrooms: 1, floor: 0,
            location: { address: 'شارع البحر', governorate: 'المنوفية', city: 'الباجور' },
            amenities: ['أمن'], leaseDuration: 36, deposit: 12000,
            ...base(mona, 'منى عادل', mona.phone), agency: delta._id, views: 40,
        },
        {
            title: 'شقة للإيجار في أشمون قريبة من الموقف', description: 'شقة 95 متر، غرفتين وصالة، دور ثاني.',
            type: T.APARTMENT, category: 'rent', price: 3000, area: 95, bedrooms: 2, bathrooms: 1, floor: 2, totalFloors: 4,
            location: { address: 'شارع سعد زغلول', governorate: 'المنوفية', city: 'أشمون' },
            amenities: ['شرفة'], leaseDuration: 12, deposit: 6000,
            ...base(mona, 'منى عادل', mona.phone), views: 60, isNegotiable: true,
        },
        // ----- student
        {
            title: 'سكن طالبات بجوار جامعة المنوفية', description: 'غرف مشتركة لطالبات الجامعة، شاملة الإنترنت والمرافق.',
            type: T.APARTMENT, category: 'student', price: 1800, area: 110, bedrooms: 3, bathrooms: 2, floor: 3, totalFloors: 5,
            location: { address: 'خلف كلية الهندسة', governorate: 'المنوفية', city: 'شبين الكوم' },
            amenities: ['مطبخ مجهز', 'أمن', 'تكييف'], leaseDuration: 9, deposit: 1800,
            utilities: { included: true, details: 'شاملة الكهرباء والمياه والإنترنت' },
            isStudentFriendly: true,
            studentHousingDetails: {
                isEnabled: true, nearbyUniversities: [{ name: 'جامعة المنوفية', distanceInKm: 0.5 }],
                roomType: 'shared', studentsPerRoom: 2, genderPolicy: 'female', academicYearOnly: true, semester: 'academic-year',
            },
            ...base(sara, 'سارة إبراهيم', sara.phone), views: 280,
        },
        {
            title: 'استوديو لطالب قريب من كلية التجارة', description: 'استوديو 65 متر مستقل، مناسب لطالب واحد، قريب من المواصلات.',
            type: T.STUDIO, category: 'student', price: 2200, area: 65, bedrooms: 1, bathrooms: 1, floor: 1, totalFloors: 4,
            location: { address: 'شارع كلية التجارة', governorate: 'المنوفية', city: 'شبين الكوم' },
            amenities: ['تكييف', 'مطبخ مجهز'], leaseDuration: 10, deposit: 2200,
            utilities: { included: true },
            isStudentFriendly: true,
            studentHousingDetails: {
                isEnabled: true, nearbyUniversities: [{ name: 'جامعة المنوفية', distanceInKm: 1 }],
                roomType: 'private', studentsPerRoom: 1, genderPolicy: 'male', academicYearOnly: false, semester: 'full-year',
            },
            ...base(karim, 'كريم محمود', karim.phone), views: 150,
        },
        // ----- pending (admin approval queue)
        {
            title: 'شقة للبيع في بركة السبع', description: 'شقة 130 متر، 3 غرف، نصف تشطيب في برج جديد.',
            type: T.APARTMENT, category: 'sale', price: 950000, area: 130, bedrooms: 3, bathrooms: 1, floor: 6, totalFloors: 10,
            location: { address: 'شارع المحطة', governorate: 'المنوفية', city: 'بركة السبع' },
            amenities: ['مصعد'], paymentMethod: 'cash', ownershipType: 'firstOwner', propertyStatus: 'ready',
            ...base(fatma, 'فاطمة حسن', fatma.phone),
            status: 'pending', isApproved: false, isActive: false, approvedBy: undefined, approvedAt: undefined,
        },
        {
            title: 'سكن طلاب في مدينة السادات', description: 'غرف فردية لطلاب جامعة مدينة السادات مع مطبخ مشترك.',
            type: T.STUDIO, category: 'student', price: 1500, area: 70, bedrooms: 2, bathrooms: 1, floor: 2,
            location: { address: 'الحي الثاني بجوار الجامعة', governorate: 'المنوفية', city: 'مدينة السادات' },
            amenities: ['مطبخ مجهز'], leaseDuration: 9,
            isStudentFriendly: true,
            studentHousingDetails: {
                isEnabled: true, nearbyUniversities: [{ name: 'جامعة مدينة السادات', distanceInKm: 0.8 }],
                roomType: 'private', studentsPerRoom: 1, genderPolicy: 'male',
            },
            ...base(omar, 'عمر خالد', omar.phone),
            status: 'pending', isApproved: false, isActive: false, approvedBy: undefined, approvedAt: undefined,
        },
    ].map((property, index) => ({ _id: id(), ...property, images: imagesFor(index) }));

    // agency.properties[] mirrors property.agency
    for (const property of properties)
    {
        if (property.agency)
        {
            agencies.find(a => a._id.equals(property.agency)).properties.push(property._id);
        }
    }

    const approved = properties.filter(p => p.isApproved);

    // ---------------- favourites / wishlists (kept consistent on both sides)
    const favourites = [[ahmed, approved[1]], [ahmed, approved[8]], [fatma, approved[0]], [mona, approved[4]], [omar, approved[9]]];
    for (const [user, property] of favourites)
    {
        user.wishlist = [...(user.wishlist || []), { property: property._id, addedAt: new Date() }];
        property.favorites = [...(property.favorites || []), user._id];
    }

    // ---------------- inquiries (assigned to the listing owner, like the API does)
    const inquiries = [
        [approved[1], omar, 'مهتم بالفيلا وأرغب في تحديد موعد للمعاينة هذا الأسبوع.', 'new'],
        [approved[4], fatma, 'هل الإيجار يشمل فواتير الكهرباء والمياه؟ وهل يوجد مصعد؟', 'responded'],
        [approved[8], mona, 'أريد حجز غرفة لابنتي بداية العام الدراسي، هل يوجد مكان متاح؟', 'in-progress'],
    ].map(([property, from, message, status]) => ({
        _id: id(), property: property._id, name: `${from.firstName} ${from.lastName}`, email: from.email,
        phone: from.phone, message, status, agent: property.owner,
    }));
    for (const inquiry of inquiries)
    {
        const property = properties.find(p => p._id.equals(inquiry.property));
        property.inquiries = [...(property.inquiries || []), inquiry._id];
    }

    // ---------------- comments
    const comments = [
        [approved[0], ahmed, 'الشقة تبدو رائعة! هل السعر قابل للتفاوض؟'],
        [approved[0], fatma, 'موقع ممتاز جداً، بالتوفيق في البيع.'],
        [approved[4], sara, 'هل يمكن المعاينة يوم الجمعة؟'],
        [approved[8], mona, 'هل السكن قريب من بوابة الجامعة الرئيسية؟'],
    ].map(([property, user, text]) => ({ _id: id(), property: property._id, user: user._id, text }));

    // ---------------- contact messages
    const contacts = [
        { name: 'محمد عبدالله', email: `mohamed.abdallah@${EMAIL_DOMAIN}`, subject: 'اقتراح إضافة البحث بالخريطة', message: 'أقترح إضافة خاصية البحث عن العقارات على الخريطة.' },
        { name: 'هبة مصطفى', email: `heba.mostafa@${EMAIL_DOMAIN}`, subject: 'استفسار عن نشر عقار', message: 'كم يستغرق مراجعة العقار قبل نشره على الموقع؟', status: 'in-progress' },
    ].map(contact => ({ _id: id(), ...contact }));

    // ---------------- testimonials (approved so they show on the site)
    const testimonials = [
        { name: 'أحمد علي', text: 'وجدت شقة مناسبة في منوف خلال أسبوع واحد. تجربة ممتازة!', role: 'مستأجر', type: 'general' },
        { name: 'سارة إبراهيم', text: 'نشرت شقتي وتواصل معي أكثر من مشتري جاد. شكراً سكنلي.', role: 'مالكة عقار', type: 'general' },
        { name: 'منى عادل', text: 'سكن الطالبات كان آمن وقريب من الجامعة كما هو موصوف.', role: 'ولية أمر', type: 'property', propertyId: approved[8]._id },
        { name: 'عمر خالد', text: 'تعامل محترم وسرعة في الرد من فريق السادات هومز.', role: 'عميل', type: 'agency', agencyId: sadat._id },
    ].map(t => ({ _id: id(), ...t, status: 'approved' }));

    return {
        passwords: { admin: adminPassword, demo: demoPassword },
        docs: {
            users: [admin, ...demoUsers].map(u => new User(u)),
            agencies: agencies.map(a => new Agency(a)),
            properties: properties.map(p => new Property(p)), // base model picks the discriminator from category
            inquiries: inquiries.map(i => new PropertyInquiry(i)),
            comments: comments.map(c => new Comment(c)),
            contacts: contacts.map(c => new ContactUs(c)),
            testimonials: testimonials.map(t => new Testimonial(t)),
        },
    };
};

// Sanity checks the enums the client relies on
const assertEnums = (properties) =>
{
    for (const p of properties)
    {
        if (!CITIES.includes(p.location.city)) throw new Error(`Unknown city ${p.location.city}`);
        if (!Object.values(PROPERTY_TYPES).includes(p.type)) throw new Error(`Unknown type ${p.type}`);
        for (const a of p.amenities) if (!AMENITIES.includes(a)) throw new Error(`Unknown amenity ${a}`);
    }
};

const COLLECTIONS = [
    ['users', User], ['agencies', Agency], ['properties', Property], ['inquiries', PropertyInquiry],
    ['comments', Comment], ['contacts', ContactUs], ['testimonials', Testimonial],
];

const seed = async () =>
{
    if (!process.env.MONGODB_URI)
    {
        throw new Error('MONGODB_URI is not set (root .env or config/.env)');
    }

    // 1. Build + validate everything BEFORE touching the database
    const { docs, passwords } = buildData();
    assertEnums(docs.properties);

    const validationErrors = [];
    for (const [name, list] of Object.entries(docs))
    {
        list.forEach((doc, index) =>
        {
            const error = doc.validateSync();
            if (error)
            {
                validationErrors.push(`${name}[${index}]: ${Object.values(error.errors).map(e => e.message).join('; ')}`);
            }
        });
    }
    if (validationErrors.length > 0)
    {
        throw new Error(`Seed data is invalid, nothing was changed:\n  ${validationErrors.join('\n  ')}`);
    }

    // 2. Connect (same database selection as the API)
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.DB_NAME || 'saknly',
        serverSelectionTimeoutMS: 10000,
    });
    console.log(`>>> Connected to database "${mongoose.connection.name}"`);

    // 3. Refuse to overwrite existing data unless --reset
    const counts = await Promise.all(COLLECTIONS.map(([, Model]) => Model.estimatedDocumentCount()));
    const nonEmpty = COLLECTIONS.filter((_, i) => counts[i] > 0).map(([name], i) => name);
    if (nonEmpty.length > 0 && !RESET)
    {
        throw new Error(`Database already has data (${nonEmpty.join(', ')}). Re-run with --reset to wipe and re-seed.`);
    }

    if (RESET)
    {
        console.log('>>> --reset: deleting existing Saknly data...');
        for (const [, Model] of COLLECTIONS)
        {
            await Model.deleteMany({});
        }
    }

    // 4. Insert with save() so pre-save hooks (property slugs) run
    await Promise.all(COLLECTIONS.map(([, Model]) => Model.init())); // build unique indexes first
    const order = ['users', 'agencies', 'properties', 'inquiries', 'comments', 'contacts', 'testimonials'];
    for (const name of order)
    {
        for (const doc of docs[name])
        {
            await doc.save();
        }
        console.log(`✅ ${name}: ${docs[name].length}`);
    }

    console.log('\nSeed complete.');
    console.log(`  Admin login: admin@${EMAIL_DOMAIN}`);
    console.log(`  Demo users:  ahmed.ali, fatma.hassan, karim.mahmoud, sara.ibrahim, omar.khaled, mona.adel @${EMAIL_DOMAIN}`);
    if (passwords.admin.generated || passwords.demo.generated)
    {
        console.log('\n  Generated passwords (shown only now - set SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD to choose your own):');
        if (passwords.admin.generated) console.log(`    admin: ${passwords.admin.value}`);
        if (passwords.demo.generated) console.log(`    demo users: ${passwords.demo.value}`);
    }
    else
    {
        console.log('  Passwords: from SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD');
    }
};

seed()
    .then(async () =>
    {
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (error) =>
    {
        console.error(`❌ Seed failed: ${error.message}`);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    });
