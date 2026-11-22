import { confirmationEmail, passwordChangedEmail } from './authEmails.js';
import { propertyApprovedEmail, propertyDeniedEmail } from './propertyEmails.js';
import { inquiryReceivedEmail } from './inquiryEmails.js';

// Event type -> email. The same builders run inline in the API and in the queue worker.
const builders = {
    'user.registered': (d) => ({ to: d.email, ...confirmationEmail(d) }),
    'user.confirmation_resent': (d) => ({ to: d.email, ...confirmationEmail(d) }),
    'user.password_changed': (d) => ({ to: d.email, ...passwordChangedEmail() }),
    'property.approved': (d) => ({ to: d.contactEmail, ...propertyApprovedEmail({ name: d.ownerName, title: d.title }) }),
    'property.denied': (d) => ({ to: d.contactEmail, ...propertyDeniedEmail({ name: d.ownerName, title: d.title, reason: d.reason }) }),
    'inquiry.created': (d) => ({ to: d.agentEmail, ...inquiryReceivedEmail(d) }),
};

// Returns sendEmail options, or null when the event sends no email (unknown type, no recipient)
export const buildEmail = (type, data = {}) =>
{
    const build = builders[type];
    if (!build) return null;
    const email = build(data);
    return email.to ? email : null;
};
