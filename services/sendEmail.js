import nodemailer from "nodemailer";

// EMAIL_SERVICE (e.g. "gmail") as before; EMAIL_SMTP_HOST (+ EMAIL_SMTP_PORT) only when no service is set
const createTransporter = () =>
{
    const auth = {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
    };

    if (!process.env.EMAIL_SERVICE && process.env.EMAIL_SMTP_HOST)
    {
        const port = Number(process.env.EMAIL_SMTP_PORT) || 587;
        return nodemailer.createTransport({
            host: process.env.EMAIL_SMTP_HOST,
            port,
            secure: port === 465,
            auth,
        });
    }

    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth,
    });
};

// Resolves true when the message was accepted; throws on transport errors (callers decide how to handle)
const sendEmail = async ({
    to = '',
    subject = '',
    message = '',
    attachments = []
} = {}) =>
{
    if (!process.env.EMAIL_SMTP_USER || !process.env.EMAIL_SMTP_PASS)
    {
        throw new Error('Email is not configured (EMAIL_SMTP_USER / EMAIL_SMTP_PASS missing)');
    }

    const transporter = createTransporter();

    // Send email
    const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Saknly" <${process.env.EMAIL_SMTP_USER}>`,
        to,
        subject,
        html: message,
        attachments
    });

    return !info.rejected.length;
};

export default sendEmail;
