import Property from '../../Model/PropertyModel.js';
import Agency from '../../Model/AgencyModel.js';
import genAI from './geminiClient.js';

const geminiModel = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

// const result = await geminiModel.generateContent("ما هو موقع سكّنلي؟");
// const response = await result.response;
// console.log(response.text());

export const smartAskWithRAG = async (userQuestion) => {
  const normalized = userQuestion.toLowerCase().trim();


  // تحيات
  if (/(أهلاً|ازيك|إزيك|مرحب|كيف حالك|عامل ايه|أخبارك|hello|hi|who are you)/i.test(normalized)) {

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
    return `لرفع العقار الخاص بك على موقع سكنلي: 
- يجب إنشاء حساب وتسجيل الدخول.
- ثم الضغط على زر "أضف عقارك".
- سيتم مراجعة العقار خلال ساعات قبل النشر.
تابع حالة العقار من صفحتك الشخصية على الموقع.`;
  }

  if (category === 'contact') {
    return `للتواصل معنا 📞:
- الهاتف: 01097558591
- البريد الإلكتروني: tasbih.attia@gmail.com
نحن دائمًا في خدمتك.`;
  }

  if (category === 'price-range') {
    const allProperties = await Property.find({ isApproved: true, isActive: true });
    const allCities = await Property.distinct("location.city");

    const isRent = normalized.includes("إيجار") || normalized.includes("rent");
    const isSale = normalized.includes("بيع") || normalized.includes("sale");
    const knownTypes = ['شقة', 'فيلا', 'محل', 'استوديو', 'دوبلكس'];
    const selectedType = knownTypes.find(type => normalized.includes(type));
    const matchedCity = allCities.find(city => city && normalized.includes(city.toLowerCase()));

    const filtered = allProperties.filter(p =>
      (isRent ? p.category === 'rent' : true) &&
      (isSale ? p.category === 'sale' : true) &&
      (selectedType ? p.type === selectedType : true) &&
      (matchedCity ? p.location.city?.toLowerCase() === matchedCity.toLowerCase() : true)
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
      matchedCity ? `في مدينة ${matchedCity}` : ""
    } يتراوح بين ${min} و ${max} جنيه، بمتوسط ${avg} جنيه.`;
  }

  if (category === 'property') {
    const allCities = await Property.distinct("location.city");
    const matchedCity = allCities.find(city => city && normalized.includes(city.toLowerCase()));

    const filter = {
      isApproved: true,
      isActive: true,
      ...(matchedCity && { "location.city": matchedCity }),
    };

    const properties = await Property.find(filter).select('type title location address price description');

    if (properties.length === 0) {
      return `❌ لا توجد عقارات متاحة حالياً ${matchedCity ? `في ${matchedCity}` : 'في المنطقة المطلوبة'}.`;
    }

    const context = properties.map((p, idx) =>
      `### 🏠 عقار رقم ${idx + 1}
- النوع: ${p.type}
- العنوان: ${p.title}
- المدينة: ${p.location.city}
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
      isApproved: true,
      isActive: true,
      isStudentFriendly: true
    };

    const allCities = await Property.distinct("location.city");
    const matchedCity = allCities.find(city => city && normalized.includes(city.toLowerCase()));

    if (matchedCity) {
      filter["location.city"] = matchedCity;
    } else {
      const addressKeywords = normalized.split(" ").filter(w => w.length > 2);
      filter["location.address"] = { $regex: addressKeywords.join("|"), $options: "i" };
    }

    const properties = await Property.find(filter).select("title location address price description");

    if (properties.length === 0) {
      return `❌ لم أتمكن من العثور على سكن طلاب مطابق في المنطقة المطلوبة. حاول استخدام اسم مدينة أو شارع آخر.`;
    }

    const context = properties.map((p, idx) => `
### 🏡 سكن طلاب رقم ${idx + 1}
- 🏠 الاسم: ${p.title}
- 🏙️ المدينة: ${p.location.city}
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
