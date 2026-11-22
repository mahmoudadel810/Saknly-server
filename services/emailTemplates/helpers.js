// Front-end base URL (links in emails point to client pages)
export const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');

export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
