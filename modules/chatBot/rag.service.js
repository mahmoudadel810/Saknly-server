import Property from '../../Model/PropertyModel.js';
import Agency from '../../Model/AgencyModel.js';
import { getGeminiModel } from './geminiClient.js';

// Public contact details for Saknly, shown by the chatbot
const SAKNLY_CONTACT = {
  phone: process.env.SAKNLY_CONTACT_PHONE || '+20 101 285 2525',
  email: process.env.SAKNLY_CONTACT_EMAIL || 'ma.adel.810@gmail.com',
};

// Only listings that are visible publicly may be used as chatbot context
const PUBLIC_FILTER = { isApproved: true, isActive: true };

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The most specific place named in the question: a city first (longest name wins, so
// "القاهرة الجديدة" beats "القاهرة"), then a governorate.
const matchLocation = async (normalized) => {
  const longest = (names) => names
    .filter(name => name && normalized.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  const city = longest(await Property.distinct("location.city", PUBLIC_FILTER));
  if (city) return { key: "location.city", value: city, label: `مدينة ${city}` };
  const governorate = longest(await Property.distinct("location.governorate", PUBLIC_FILTER));
  if (governorate) return { key: "location.governorate", value: governorate, label: `محافظة ${governorate}` };
  return null;
};

export const smartAskWithRAG = async (userQuestion) => {
  const normalized = userQuestion.toLowerCase().trim();


  // تحيات
  // English greetings must be whole words ("which", "this" contain "hi"). \b is ASCII-only in JS,
  // so the Arabic alternatives keep substring matching.
  if (/(أهلاً|ازيك|إزيك|مرحب|كيف حالك|عامل ايه|أخبارك|\bhello\b|\bhi\b|\bwho are you\b)/i.test(normalized)) {

    return `أهلاً وسهلاً! 👋  
أنا سكّنلي بوت 🤖، المساعد الذكي لموقع "سكّنلي" المتخصص في بيع وشراء وتأجير العقارات.  
تقدر تسألني عن أي شيء يخص العقارات، الأسعار، إضافة عقار، أو حتى وكالات العقارات، وهجاوبك فورًا!`;
  }

  // خدمات
  if (/خدمات|بتقدموا ايه|ايه بتعملوه|ايه الخدمات/i.test(normalized)) {
    return `نحن نقدم خدمات متكاملة في مجال العقارات في محافظة المنوفية، منها:
- 🏠 عرض وبيع وتأجير العقارات بمختلف أنواعها.
- 📝 نشر العقارات الخاصة بك على الموقع.
- 🧭 مساعدتك في البحث عن أفضل العروض والفرص السكنية أو الاستثمارية.
- 🏢 تقديم معلومات عن وكالات العقارات الموجودة.

لو عندك أي سؤال محدد، اسألني وهساعدك فورًا 😊`;
  }

  // غير متخصص
  if (/(طبخ|قيادة|سيارة|دكتور|دراسة|تعليم|برمجة|سفر|رياضة|كرة|مطبخ)/i.test(normalized)) {
    return `❗ عذرًا، أنا متخصص فقط في كل ما يتعلق بالعقارات 🏡 على موقع "سكّني".
لو عندك استفسار عن بيع، شراء أو تأجير، أو عن الوكالات العقارية – هقدر أساعدك بكل سرور 😊.`;
  }



  const geminiModel = getGeminiModel();

  // ✅ التصنيف باستخدام Gemini
  const classificationPrompt = `
صنّف هذا السؤال بناءً على التصنيفات التالية فقط:
- property
- agency
- submit
- contact
- price-range

أعطني فقط الكلمة المناسبة دون أي شرح إضافي.

السؤال: ${userQuestion}
  `;

  const categoryResult = await geminiModel.generateContent({
    contents: [{ parts: [{ text: classificationPrompt }] }]
  });
  const category = (await categoryResult.response.text()).trim().toLowerCase();

  if (category === 'submit') {
    return `لنشر عقارك على سكنلي:
- سجّل الدخول إلى حسابك، أو أنشئ حسابًا جديدًا.
- اضغط على "أضف عقارك" وأكمل بيانات الإعلان.
- يراجع فريقنا الإعلان قبل نشره، وتتابع حالته من صفحة حسابك.`;
  }

  if (category === 'contact') {
    return `للتواصل مع فريق سكنلي:
- الهاتف وواتساب: ${SAKNLY_CONTACT.phone}
- البريد الإلكتروني: ${SAKNLY_CONTACT.email}
يسعدنا الرد على استفسارك.`;
  }

  if (category === 'price-range') {
    const allProperties = await Property.find(PUBLIC_FILTER).select('category type price location');
    const place = await matchLocation(normalized);

    const isRent = normalized.includes("إيجار") || normalized.includes("rent");
    const isSale = normalized.includes("بيع") || normalized.includes("sale");
    const knownTypes = ['شقة', 'فيلا', 'محل', 'استوديو', 'دوبلكس'];
    const selectedType = knownTypes.find(type => normalized.includes(type));

    const filtered = allProperties.filter(p =>
      (isRent ? p.category === 'rent' : true) &&
      (isSale ? p.category === 'sale' : true) &&
      (selectedType ? p.type === selectedType : true) &&
      (place ? p.get(place.key) === place.value : true)
    );

    if (filtered.length === 0) {
      return "❌ لم أتمكن من العثور على بيانات أسعار مناسبة لسؤالك. جرب بصيغة أخرى أو مدينة مختلفة.";
    }

    const allPrices = filtered.map(p => p.price);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const avg = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    return `📊 ${
      isRent ? "متوسط أسعار الإيجار" : isSale ? "متوسط أسعار البيع" : "متوسط الأسعار"
    } ${selectedType ? `لعقار "${selectedType}"` : ""} ${
      place ? `في ${place.label}` : ""
    } يتراوح بين ${min} و ${max} جنيه، بمتوسط ${avg} جنيه.`;
  }

  if (category === 'property') {
    const place = await matchLocation(normalized);

    const filter = {
      ...PUBLIC_FILTER,
      ...(place && { [place.key]: place.value }),
    };

    const properties = await Property.find(filter).select('type title location price description').limit(30);

    if (properties.length === 0) {
      return `❌ لا توجد عقارات متاحة حالياً ${place ? `في ${place.value}` : 'في المنطقة المطلوبة'}.`;
    }

    const context = properties.map((p, idx) =>
      `### 🏠 عقار رقم ${idx + 1}
- النوع: ${p.type}
- العنوان: ${p.title}
- المدينة: ${p.location.city}${p.location.governorate ? ` (${p.location.governorate})` : ''}
- العنوان التفصيلي: ${p.location.address}
- السعر: ${p.price} جنيه
- الوصف: ${p.description || 'لا يوجد وصف'}
`).join('\n---\n');

    const propertyAnswer = await geminiModel.generateContent({
      contents: [{ parts: [{ text: `السياق:\n${context}\n\nسؤال المستخدم: ${userQuestion}` }] }]
    });
    return (await propertyAnswer.response.text()).trim();
  }

  if (/(سكن طلاب|سكن مغتربين|سكن جامعي|سكن للطلبة|سكن بالقرب من|سكن بجوار|قريب من الكلية|سكن للجامعة)/i.test(normalized)) {
    const filter = {
      ...PUBLIC_FILTER,
      isStudentFriendly: true
    };

    const place = await matchLocation(normalized);

    if (place) {
      filter[place.key] = place.value;
    } else {
      const addressKeywords = normalized.split(" ").filter(w => w.length > 2);
      if (addressKeywords.length > 0) {
        filter["location.address"] = { $regex: addressKeywords.map(escapeRegex).join("|"), $options: "i" };
      }
    }

    const properties = await Property.find(filter).select("title location price description").limit(30);

    if (properties.length === 0) {
      return `❌ لم أتمكن من العثور على سكن طلاب مطابق في المنطقة المطلوبة. حاول استخدام اسم مدينة أو شارع آخر.`;
    }

    const context = properties.map((p, idx) => `
### 🏡 سكن طلاب رقم ${idx + 1}
- 🏠 الاسم: ${p.title}
- 🏙️ المدينة: ${p.location.city}${p.location.governorate ? ` (${p.location.governorate})` : ''}
- 📍 العنوان: ${p.location.address}
- 💰 السعر: ${p.price} جنيه
- ℹ️ الوصف: ${p.description || "لا يوجد وصف"}
    `).join('\n---\n');

    const studentResponse = await geminiModel.generateContent({
      contents: [{ parts: [{ text: `السياق:\n${context}\n\nسؤال المستخدم: ${userQuestion}` }] }]
    });
    return `${(await studentResponse.response.text()).trim()}

🔗 يمكنك أيضًا تصفح جميع عقارات الطلاب على الموقع من هنا:
https://saknly.com/student-housing`;
  }

  if (category === 'agency') {
    const agencies = await Agency.find().select('name description');
    const context = agencies.map(a => `الوكالة: ${a.name}\nالوصف: ${a.description}`).join('\n\n');

    const agencyResponse = await geminiModel.generateContent({
      contents: [{ parts: [{ text: `السياق:\n${context}\n\nسؤال المستخدم: ${userQuestion}` }] }]
    });
    return (await agencyResponse.response.text()).trim();
  }

  return '❌ لم أتمكن من فهم سؤالك بدقة. حاول إعادة صياغته أو اسأل عن شيء متعلق بالعقارات.';
};
