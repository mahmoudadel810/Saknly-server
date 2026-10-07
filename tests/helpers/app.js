// The app is imported only after tests/setup.js has set the environment and started MongoDB
let appPromise;

export const getApp = () =>
{
    appPromise ??= import('../../index.js').then(m => m.default);
    return appPromise;
};

export const API = '/api/saknly/v1';
