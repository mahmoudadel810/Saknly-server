import { clientUrl, escapeHtml } from './helpers.js';

// Each template returns { subject, message } for sendEmail

export const propertyApprovedEmail = ({ name, title }) => ({
    subject: 'تمت الموافقة على عقارك - سكنلي',
    message: `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');

                    * { margin: 0; padding: 0; box-sizing: border-box; }

                    body {
                        font-family: 'Cairo', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                        padding: 20px;
                        min-height: 100vh;
                    }

                    .email-container {
                        max-width: 650px;
                        margin: 0 auto;
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(20px);
                        border-radius: 24px;
                        overflow: hidden;
                        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }

                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 45px 30px;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                    }

                    .header::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background: repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255,255,255,0.08) 15px, rgba(255,255,255,0.08) 30px);
                        animation: float 25s linear infinite;
                    }

                    @keyframes float {
                        0% { transform: translateX(-50px) translateY(-50px) rotate(0deg); }
                        100% { transform: translateX(-50px) translateY(-50px) rotate(360deg); }
                    }

                    .header h1 {
                        color: #ffffff;
                        margin: 0;
                        font-size: 32px;
                        font-weight: 700;
                        position: relative;
                        z-index: 2;
                        text-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    }

                    .header p {
                        color: #ffffff;
                        margin: 15px 0 0 0;
                        font-size: 18px;
                        opacity: 0.95;
                        position: relative;
                        z-index: 2;
                        font-weight: 400;
                    }

                    .success-icon {
                        width: 80px;
                        height: 80px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 50%;
                        margin: 20px auto 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        z-index: 2;
                    }

                    .success-icon::before {
                        content: '✓';
                        color: white;
                        font-size: 40px;
                        font-weight: bold;
                    }

                    .content { padding: 45px 35px; }

                    .welcome-section {
                        text-align: center;
                        margin-bottom: 35px;
                    }

                    .welcome-section h2 {
                        color: #2c3e50;
                        margin: 0 0 15px 0;
                        font-size: 28px;
                        font-weight: 700;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }

                    .welcome-section p {
                        color: #7f8c8d;
                        margin: 0;
                        font-size: 18px;
                        font-weight: 400;
                    }

                    .info-card {
                        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                        border-radius: 16px;
                        padding: 30px;
                        margin-bottom: 30px;
                        border: 1px solid rgba(102, 126, 234, 0.1);
                        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                        position: relative;
                        overflow: hidden;
                    }

                    .info-card::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }

                    .info-card p {
                        color: #2c3e50;
                        line-height: 1.8;
                        margin-bottom: 20px;
                        font-size: 17px;
                        font-weight: 400;
                    }

                    .property-title {
                        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                        border: 2px solid transparent;
                        background-clip: padding-box;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 25px 0;
                        position: relative;
                        overflow: hidden;
                    }

                    .property-title::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        margin: -2px;
                        border-radius: inherit;
                        z-index: -1;
                    }

                    .property-title h3 {
                        color: #2c3e50;
                        margin: 0;
                        font-size: 20px;
                        font-weight: 600;
                        text-align: center;
                    }

                    .features-card {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 16px;
                        padding: 35px;
                        text-align: center;
                        margin-bottom: 30px;
                        position: relative;
                        overflow: hidden;
                    }

                    .features-card h3 {
                        color: #ffffff;
                        margin: 0 0 25px 0;
                        font-size: 24px;
                        font-weight: 700;
                        position: relative;
                        z-index: 2;
                    }

                    .features-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        position: relative;
                        z-index: 2;
                    }

                    .features-list li {
                        color: #ffffff;
                        margin-bottom: 15px;
                        font-size: 17px;
                        font-weight: 400;
                        padding: 12px 20px;
                        background: rgba(255,255,255,0.1);
                        border-radius: 25px;
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255,255,255,0.2);
                        position: relative;
                    }

                    .features-list li::before {
                        content: '🏠';
                        margin-left: 10px;
                        font-size: 18px;
                    }

                    .cta-section {
                        text-align: center;
                        margin: 40px 0;
                    }

                    .cta-button {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #ffffff;
                        padding: 18px 40px;
                        text-decoration: none;
                        border-radius: 30px;
                        font-weight: 600;
                        font-size: 18px;
                        display: inline-block;
                        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
                        transition: all 0.3s ease;
                        position: relative;
                        overflow: hidden;
                    }

                    .footer {
                        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                        padding: 30px;
                        text-align: center;
                        border-top: 1px solid rgba(102, 126, 234, 0.1);
                    }

                    .footer p:first-child {
                        color: #6c757d;
                        margin: 0 0 15px 0;
                        font-size: 16px;
                        font-weight: 500;
                    }

                    .footer p:last-child {
                        color: #adb5bd;
                        margin: 0;
                        font-size: 14px;
                        font-weight: 400;
                    }

                    @media (max-width: 600px) {
                        .email-container { margin: 10px; border-radius: 16px; }
                        .header { padding: 30px 20px; }
                        .header h1 { font-size: 26px; }
                        .content { padding: 30px 20px; }
                        .welcome-section h2 { font-size: 24px; }
                        .info-card, .features-card { padding: 25px 20px; }
                        .cta-button { padding: 15px 30px; font-size: 16px; }
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <!-- Header -->
                    <div class="header">
                        <h1>تمت الموافقة على عقارك</h1>
                        <p>مرحباً بك في سكنلي</p>
                        <div class="success-icon"></div>
                    </div>

                    <!-- Content -->
                    <div class="content">
                        <div class="welcome-section">
                            <h2>تمت الموافقة بنجاح</h2>
                            <p>عقارك جاهز للعرض على المنصة</p>
                        </div>

                        <div class="info-card">
                            <p>
                                مرحباً <strong>${escapeHtml(name) || 'عزيزي العميل'}</strong>،
                            </p>
                            <p>
                                تمت الموافقة على عقارك بعنوان:
                            </p>
                            <div class="property-title">
                                <h3>${escapeHtml(title)}</h3>
                            </div>
                        </div>

                        <div class="features-card">
                            <h3>ما يحدث الآن؟</h3>
                            <ul class="features-list">
                                <li>عقارك سيظهر في نتائج البحث</li>
                                <li>يمكن للعملاء التواصل معك مباشرة</li>
                                <li>ستحصل على إشعارات عند وجود استفسارات</li>
                            </ul>
                        </div>

                        <div class="cta-section">
                            <a href="${clientUrl()}" class="cta-button">
                                تصفح المنصة
                            </a>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="footer">
                        <p>شكراً لك على استخدام منصة سكنلي</p>
                        <p>© 2024 سكنلي. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
});

export const propertyDeniedEmail = ({ name, title, reason }) => ({
    subject: 'تحديث بخصوص عقارك',
    message: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">تحديث بخصوص عقارك</h1>
                        <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">منصة سكنلي</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="background-color: #f8d7da; border: 2px solid #f5c6cb; border-radius: 50px; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 40px; color: #721c24;">⚠️</span>
                            </div>
                            <h2 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">عذراً، لم يتم قبول عقارك</h2>
                            <p style="color: #7f8c8d; margin: 0; font-size: 16px;">يرجى مراجعة التفاصيل أدناه</p>
                        </div>

                        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                            <p style="color: #2c3e50; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
                                مرحباً <strong>${escapeHtml(name)}</strong>،
                            </p>
                            <p style="color: #2c3e50; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
                                نعتذر، لم يتم قبول عقارك بعنوان:
                            </p>
                            <div style="background-color: #ffffff; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                                <h3 style="color: #2c3e50; margin: 0; font-size: 18px; font-weight: 600;">${escapeHtml(title)}</h3>
                            </div>
                        </div>

                        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); border-radius: 8px; padding: 25px; text-align: center; margin-bottom: 25px;">
                            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">سبب الرفض:</h3>
                            <div style="background-color: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; margin: 15px 0;">
                                <p style="color: #ffffff; margin: 0; font-size: 16px; line-height: 1.6;">${escapeHtml(reason) || 'غير محدد'}</p>
                            </div>
                        </div>

                        <div style="background-color: #e3f2fd; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                            <h3 style="color: #1976d2; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">نصائح للتحسين:</h3>
                            <ul style="color: #2c3e50; margin: 0; padding-left: 20px;">
                                <li style="margin-bottom: 8px;">تأكد من صحة جميع المعلومات المقدمة</li>
                                <li style="margin-bottom: 8px;">أضف صور واضحة وعالية الجودة</li>
                                <li style="margin-bottom: 8px;">اكتب وصفاً مفصلاً ومفيداً</li>
                                <li style="margin-bottom: 8px;">تأكد من أن السعر مناسب للسوق</li>
                            </ul>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${clientUrl()}/uploadProperty" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                إضافة عقار جديد
                            </a>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e9ecef;">
                        <p style="color: #6c757d; margin: 0 0 10px 0; font-size: 14px;">شكراً لك على استخدام منصة سكنلي</p>
                        <p style="color: #adb5bd; margin: 0; font-size: 12px;">© 2024 سكنلي. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            `,
});
