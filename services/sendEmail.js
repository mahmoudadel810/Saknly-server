import nodemailer from "nodemailer";

const sendEmail = async ({
    to = '',
    subject = '',
    message = '',
    attachments = []
} = {}) =>
{
    // Create email transporter
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_SMTP_USER,
            pass: process.env.EMAIL_SMTP_PASS,
        },
    });

    // Send email
    const info = await transporter.sendMail({
        from: `"Saknly" <${process.env.EMAIL_SMTP_USER}>`,
        to,
        subject,
        html: message,
        attachments
    });

    return !info.rejected.length;
};

export default sendEmail;