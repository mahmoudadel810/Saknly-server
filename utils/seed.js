import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// =================================================================
// 1. استيراد المودلز
// =================================================================
import User from '../Model/UserModel.js';
import Agency from '../Model/AgencyModel.js';
import Property from '../Model/PropertyModel.js';
import Comment from '../Model/CommentModel.js';
import PropertyInquiry from '../Model/PropertyInquiryModel.js';
import ContactUs from '../Model/ContactModel.js';
import Testimonial from '../Model/TestimonialModel.js';

// =================================================================
// 2. إعداد الاتصال بقاعدة البيانات
// =================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', 'config', '.env') });

const MONGO_URI = process.env.MONGODB_URI;

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('>>> تم الاتصال بقاعدة البيانات بنجاح...');
    } catch (err) {
        console.error('XXX فشل الاتصال بقاعدة البيانات:', err.message);
        process.exit(1);
    }
};

// =================================================================
// 3. تعريف الـ Object IDs لربط البيانات
// =================================================================
const adminUserId = new mongoose.Types.ObjectId();
const user1Id = new mongoose.Types.ObjectId(); // Menouf
const user2Id = new mongoose.Types.ObjectId(); // Quweisna
const user3Id = new mongoose.Types.ObjectId(); // Tala (inactive)
const user4Id = new mongoose.Types.ObjectId(); // Tanta
const user5Id = new mongoose.Types.ObjectId(); // Sadat City
const user6Id = new mongoose.Types.ObjectId(); // Shebin

const agency1Id = new mongoose.Types.ObjectId(); // Delta (Shebin)
const agency2Id = new mongoose.Types.ObjectId(); // Al-Gharbia (Tanta)
const agency3Id = new mongoose.Types.ObjectId(); // Emaar (Sadat City)

const property1Id = new mongoose.Types.ObjectId();
const property2Id = new mongoose.Types.ObjectId();
const property3Id = new mongoose.Types.ObjectId();
const property4Id = new mongoose.Types.ObjectId();
const property5Id = new mongoose.Types.ObjectId();
const property6Id = new mongoose.Types.ObjectId();
const property7Id = new mongoose.Types.ObjectId();
const property8Id = new mongoose.Types.ObjectId(); // Villa in Sadat
const property9Id = new mongoose.Types.ObjectId(); // Student housing in Shebin
const property10Id = new mongoose.Types.ObjectId(); // Shop in Menouf
const property11Id = new mongoose.Types.ObjectId(); // Apartment for rent in Tanta

// =================================================================
// 4. بيانات المستخدمين (Users)
// =================================================================
const createUsers = async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    return [
        { _id: adminUserId, name: 'Admin Saknly', email: 'admin@saknly.com', password: hashedPassword, phone: '01012345678', role: 'admin', address: { street: '123 Main St', city: 'شبين الكوم', zipCode: '12345' }, isActive: true, isVerified: true },
        { _id: user1Id, name: 'أحمد علي', email: 'ahmed.ali@example.com', password: hashedPassword, phone: '01123456789', role: 'user', address: { street: '456 Oak Ave', city: 'منوف', zipCode: '23456' }, isActive: true },
        { _id: user2Id, name: 'فاطمة الزهراء', email: 'fatima.z@example.com', password: hashedPassword, phone: '01234567890', role: 'user', address: { street: '789 Pine Ln', city: 'قويسنا', zipCode: '34567' }, isActive: true },
        { _id: user3Id, name: 'كريم محمود', email: 'karim.m@example.com', password: hashedPassword, phone: '01567890123', role: 'user', address: { street: '101 Maple Dr', city: 'تلا', zipCode: '45678' }, isActive: false },
        { _id: user4Id, name: 'سارة إبراهيم', email: 'sara.ibrahim@example.com', password: hashedPassword, phone: '01098765432', role: 'user', address: { street: '212 El-Galaa St', city: 'طنطا', zipCode: '56789' }, isActive: true },
        { _id: user5Id, name: 'عمرو دياب', email: 'amr.diab@example.com', password: hashedPassword, phone: '01111111111', role: 'user', address: { street: ' المنطقة السكنية الأولى', city: 'مدينة السادات', zipCode: '67890' }, isActive: true },
        { _id: user6Id, name: 'تامر حسني', email: 'tamer.hosny@example.com', password: hashedPassword, phone: '01222222222', role: 'user', address: { street: 'شارع الاستاد', city: 'شبين الكوم', zipCode: '12345' }, isActive: true },
    ];
};

// =================================================================
// 5. بيانات الوكالات العقارية (Agencies)
// =================================================================
const agenciesData = [
    { _id: agency1Id, name: 'شركة دلتا العقارية', email: 'contact@delta.com', phone: '0482223333', address: { street: 'شارع الجمهورية', city: 'شبين الكوم', zipCode: '12345' }, description: 'رواد العقارات في المنوفية، خبرة تمتد لعشرين عاماً.', logo: { publicId: 'logos/delta_logo', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/logos/delta_logo.png' }, isFeatured: true },
    { _id: agency2Id, name: 'الغربية للتطوير العقاري', email: 'info@gharbia-dev.com', phone: '0403334444', address: { street: 'شارع البحر', city: 'طنطا', zipCode: '56789' }, description: 'مشاريع سكنية وتجارية فاخرة في قلب الدلتا.', logo: { publicId: 'logos/gharbia_logo', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/logos/gharbia_logo.png' } },
    { _id: agency3Id, name: 'إعمار مصر للتنمية', email: 'sales@emaar.eg', phone: '16116', address: { street: 'ميفيدا، التجمع الخامس', city: 'مدينة السادات', zipCode: '67890' }, description: 'نخلق مجتمعات عالمية المستوى في مصر.', logo: { publicId: 'logos/emaar_logo', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/logos/emaar_logo.png' }, isFeatured: true },
];

// =================================================================
// 6. بيانات العقارات (Properties)
// =================================================================
const propertiesData = [
    // --- عقارات موجودة ---
    { _id: property1Id, title: 'شقة للبيع بموقع متميز في شارع الجلاء البحري', description: 'شقة 175 متر تشطيب سوبر لوكس، 3 غرف نوم و2 حمام وريسبشن كبير.', type: 'شقة', category: 'sale', price: 2300000, area: 175, bedrooms: 3, bathrooms: 2, floor: 8, totalFloors: 11, location: { address: 'شارع الجلاء البحري، أمام حلواني العيسوي', city: 'طنطا', district: 'حي أول طنطا' }, images: [{ publicId: 'props/p1_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p1_1.jpg', isMain: true }], amenities: ['تكييف', 'مصعد', 'شرفة'], owner: user4Id, agency: agency2Id, status: 'available', isApproved: true, approvedBy: adminUserId, paymentMethod: 'cash', ownershipType: 'resale', propertyStatus: 'ready' },
    { _id: property2Id, title: 'فيلا للبيع في كمبوند جرين فالي', description: 'فيلا مستقلة 400 متر مع حديقة خاصة 150 متر وحمام سباحة.', type: 'فيلا', category: 'sale', price: 7500000, area: 400, bedrooms: 5, bathrooms: 5, floor: 0, totalFloors: 2, location: { address: 'كمبوند جرين فالي، الكيلو 15 طريق مصر اسكندرية الزراعي', city: 'قويسنا' }, images: [{ publicId: 'props/p2_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p2_1.jpg', isMain: true }], amenities: ['موقف سيارات', 'أمن', 'مطبخ مجهز'], owner: agency1Id, isApproved: true, approvedBy: adminUserId, paymentMethod: 'cashOrInstallment', downPayment: 1500000, installmentPeriodInYears: 7, ownershipType: 'firstOwner', propertyStatus: 'ready' },
    { _id: property3Id, title: 'شقة مفروشة بالكامل للايجار في منوف', description: 'شقة 120 متر، غرفتين نوم، مكيفة بالكامل وبها جميع الأجهزة.', type: 'شقة', category: 'rent', price: 6000, area: 120, bedrooms: 2, bathrooms: 1, floor: 3, totalFloors: 5, location: { address: 'شارع الجيش، بجوار المستشفى العام', city: 'منوف' }, images: [{ publicId: 'props/p3_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p3_1.jpg', isMain: true }], amenities: ['تكييف', 'شرفة', 'مفروشة بالكامل'], owner: user1Id, isApproved: true, approvedBy: adminUserId, leaseDuration: 12, deposit: 12000, utilities: { included: true } },
    { _id: property4Id, title: 'محل تجاري للإيجار بموقع حيوي في شبين الكوم', description: 'محل 50 متر على شارع رئيسي، يصلح لجميع الأنشطة التجارية.', type: 'محل', category: 'rent', price: 15000, area: 50, bedrooms: 0, bathrooms: 1, floor: 0, location: { address: 'شارع باريس، أمام كارفور', city: 'شبين الكوم' }, images: [{ publicId: 'props/p4_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p4_1.jpg', isMain: true }], amenities: ['موقف سيارات'], owner: agency1Id, status: 'available', isApproved: true, approvedBy: adminUserId },
    { _id: property5Id, title: 'غرفة فردية لسكن طالبات بالقرب من جامعة المنوفية', description: 'غرفة مستقلة في شقة مشتركة للطالبات فقط. شاملة واي فاي.', type: 'استوديو', category: 'student', price: 1800, area: 20, bedrooms: 1, bathrooms: 1, floor: 4, location: { address: 'خلف كلية الهندسة، شارع مصطفى كامل', city: 'شبين الكوم' }, images: [{ publicId: 'props/p5_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p5_1.jpg', isMain: true }], amenities: ['مطبخ مجهز', 'أمن', ' واي فاي'], owner: user2Id, isApproved: true, approvedBy: adminUserId, isStudentFriendly: true, studentHousingDetails: { isEnabled: true, nearbyUniversities: [{ name: 'جامعة المنوفية', distanceInKm: 0.5 }], genderRestriction: 'female' } },
    { _id: property6Id, title: 'شقة للبيع في أشمون استلام فوري', description: 'شقة 150 متر، 3 غرف، نصف تشطيب، في برج جديد.', type: 'شقة', category: 'sale', price: 950000, area: 150, bedrooms: 3, bathrooms: 2, floor: 6, totalFloors: 10, location: { address: 'شارع سعد زغلول', city: 'أشمون' }, images: [{ publicId: 'props/p6_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p6_1.jpg', isMain: true }], amenities: ['مصعد', 'شرفة'], owner: agency1Id, isApproved: false, paymentMethod: 'cash', ownershipType: 'firstOwner', propertyStatus: 'ready' },
    { _id: property7Id, title: 'دوبلكس للإيجار في تلا بمنطقة الفيلات', description: 'دوبلكس 250 متر بمدخل خاص وحديقة صغيرة. 4 غرف نوم.', type: 'دوبلكس', category: 'rent', price: 9000, area: 250, bedrooms: 4, bathrooms: 3, floor: 0, totalFloors: 1, location: { address: 'منطقة الفيلات، بالقرب من النادي', city: 'تلا' }, images: [{ publicId: 'props/p7_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p7_1.jpg', isMain: true }], amenities: ['موقف سيارات', 'حديقة خاصة', 'أمن'], owner: user3Id, isApproved: true, approvedBy: adminUserId },
    // --- عقارات جديدة ---
    { _id: property8Id, title: 'فيلا فاخرة للبيع في كايرو جيت - إعمار', description: 'فيلا 550 متر في أرقى مناطق مدينة السادات، تصميم عصري وإطلالة على مساحات خضراء.', type: 'فيلا', category: 'sale', price: 12000000, area: 550, bedrooms: 6, bathrooms: 7, floor: 0, totalFloors: 3, location: { address: 'كمبوند كايرو جيت', city: 'مدينة السادات' }, images: [{ publicId: 'props/p8_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p8_1.jpg', isMain: true }], amenities: ['موقف سيارات', 'أمن', 'مطبخ مجهز', 'حديقة خاصة', 'حمام سباحة'], owner: agency3Id, isApproved: true, approvedBy: adminUserId, paymentMethod: 'installment', downPayment: 2400000, installmentPeriodInYears: 10, ownershipType: 'firstOwner', propertyStatus: 'underConstruction', deliveryDate: new Date('2026-12-31') },
    { _id: property9Id, title: 'استوديو لسكن الطلاب بجوار كلية التجارة', description: 'استوديو 45 متر، مثالي للطلاب، قريب جدا من المواصلات والخدمات.', type: 'استوديو', category: 'student', price: 2200, area: 45, bedrooms: 1, bathrooms: 1, floor: 2, location: { address: 'شارع كلية التجارة', city: 'شبين الكوم' }, images: [{ publicId: 'props/p9_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p9_1.jpg', isMain: true }], amenities: ['مطبخ مجهز', ' واي فاي', 'شرفة'], owner: user6Id, isApproved: true, approvedBy: adminUserId, isStudentFriendly: true, studentHousingDetails: { isEnabled: true, nearbyUniversities: [{ name: 'جامعة المنوفية', distanceInKm: 1 }], genderRestriction: 'male' } },
    { _id: property10Id, title: 'محل للإيجار في شارع بور سعيد', description: 'محل 30 متر، واجهة كبيرة، يصلح لكافة الأنشطة.', type: 'محل', category: 'rent', price: 8000, area: 30, bedrooms: 0, bathrooms: 0, floor: 0, location: { address: 'شارع بور سعيد الرئيسي', city: 'منوف' }, images: [{ publicId: 'props/p10_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p10_1.jpg', isMain: true }], owner: user1Id, isApproved: true, approvedBy: adminUserId, status: 'rented' },
    { _id: property11Id, title: 'شقة إيجار جديد بسعر لقطة في طنطا', description: 'شقة 90 متر غرفتين وصالة، تشطيب عادي، دور رابع بدون مصعد.', type: 'شقة', category: 'rent', price: 2500, area: 90, bedrooms: 2, bathrooms: 1, floor: 4, totalFloors: 5, location: { address: 'سيجر', city: 'طنطا' }, images: [{ publicId: 'props/p11_1', url: 'https://res.cloudinary.com/demo/image/upload/v1625149495/props/p11_1.jpg', isMain: true }], amenities: [], owner: user4Id, isApproved: true, approvedBy: adminUserId, leaseDuration: 24 },
];

// =================================================================
// 7. بيانات التعليقات (Comments)
// =================================================================
const commentsData = [
    { property: property1Id, user: user1Id, text: 'الشقة تبدو رائعة! هل السعر قابل للتفاوض؟', rating: 4 },
    { property: property1Id, user: user2Id, text: 'موقع ممتاز جداً، بالتوفيق في البيع.', rating: 5 },
    { property: property3Id, user: user4Id, text: 'هل الإيجار شامل فواتير الكهرباء والمياه؟', rating: 3 },
    { property: property8Id, user: user5Id, text: 'مشروع واعد! متحمس للاستلام.', rating: 5 },
    { property: property9Id, user: user6Id, text: 'هل يوجد سراير أخرى في الاستوديو؟', rating: 4 },
];

// =================================================================
// 8. بيانات الاستفسارات (Inquiries)
// =================================================================
const inquiriesData = [
    { property: property2Id, user: user2Id, message: 'مهتم بالفيلا، أود تحديد موعد للمعاينة.' },
    { property: property4Id, user: user1Id, message: 'أنا صاحب نشاط تجاري وأبحث عن محل.' },
    { property: property8Id, user: user5Id, message: 'أرغب في معرفة المزيد عن أنظمة السداد للفيلا في مدينة السادات.' },
];

// =================================================================
// 9. بيانات رسائل التواصل (Contact Us)
// =================================================================
const contactsData = [
    { name: 'محمد عبدالله', email: 'mohamed.abd@email.com', phone: '01011223344', subject: 'اقتراح إضافة خاصية جديدة', message: 'أقترح إضافة خاصية البحث بالخريطة.' },
    { name: 'هبة مصطفى', email: 'heba.m@email.com', phone: '01155667788', subject: 'مشكلة في عرض الصور', message: 'بعض الصور لا تظهر بشكل جيد.' },
];

// =================================================================
// 10. بيانات شهادات العملاء (Testimonials)
// =================================================================
const testimonialsData = [
    { user: user1Id, agency: agency1Id, text: 'تجربة ممتازة مع شركة دلتا، محترفين جداً.', rating: 5, isApproved: true },
    { user: user4Id, agency: agency2Id, text: 'مصداقية وسرعة في التعامل. شكراً لكم.', rating: 4, isApproved: true },
    { user: user5Id, agency: agency3Id, text: 'اسم كبير ومشاريع على أرض الواقع تتحدث عن نفسها. فخور بكوني عميل لديكم.', rating: 5, isApproved: true },
];

// =================================================================
// 11. الدالة الرئيسية لملء قاعدة البيانات
// =================================================================
const seedDatabase = async () => {
    try {
        await connectDB();

        console.log('>>> جاري حذف البيانات القديمة...');
        await Testimonial.deleteMany({});
        await ContactUs.deleteMany({});
        await PropertyInquiry.deleteMany({});
        await Comment.deleteMany({});
        await Property.deleteMany({});
        await Agency.deleteMany({});
        await User.deleteMany({});
        console.log('>>> تم حذف البيانات القديمة بنجاح.');

        console.log('>>> جاري تجهيز وإدخال البيانات الجديدة...');
        const users = await createUsers();

        await User.create(users);
        console.log('✅ تم إدخال المستخدمين');

        await Agency.create(agenciesData);
        console.log('✅ تم إدخال الوكالات');

        await Property.create(propertiesData);
        console.log('✅ تم إدخال العقارات');

        await Comment.create(commentsData);
        console.log('✅ تم إدخال التعليقات');

        await PropertyInquiry.create(inquiriesData);
        console.log('✅ تم إدخال استفسارات العقارات');

        await ContactUs.create(contactsData);
        console.log('✅ تم إدخال رسائل التواصل');

        await Testimonial.create(testimonialsData);
        console.log('✅ تم إدخال شهادات العملاء');

        console.log('\n🎉🎉🎉 تمت عملية ملء قاعدة البيانات بالبيانات الأولية بنجاح! 🎉🎉🎉');

    } catch (error) {
        console.error('❌❌❌ خطأ أثناء عملية ملء قاعدة البيانات:', error);
    } finally {
        console.log('>>> جاري إغلاق الاتصال بقاعدة البيانات.');
        mongoose.connection.close();
        process.exit();
    }
};

seedDatabase();
