import { escapeHtml } from './helpers.js';

// Returns { subject, message } for sendEmail
export const inquiryReceivedEmail = ({ propertyTitle, name, email, phone, message }) => ({
    subject: "New Property Inquiry",
    message: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>New Property Inquiry</h2>
              <p>You have received a new inquiry about property: ${escapeHtml(propertyTitle || 'N/A')}</p>
              <p><strong>From:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
              <p><strong>Message:</strong> ${escapeHtml(message)}</p>
              <p>Please respond to this inquiry as soon as possible.</p>
            </div>
          `,
});
