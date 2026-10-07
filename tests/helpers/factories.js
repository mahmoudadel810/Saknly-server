import mongoose from 'mongoose';
import sharp from 'sharp';
import User from '../../Model/UserModel.js';
import Property from '../../Model/PropertyModel.js';
import { hashFunction } from '../../utils/passwordHashing.js';
import { tokenFunction } from '../../utils/tokenFunction.js';

export const PASSWORD = 'Passw0rd!';

let seq = 0;
const next = () => (seq += 1);

export const auth = (token) => ({ Authorization: `Saknly__${token}` });

export const newId = () => new mongoose.Types.ObjectId().toString();

export const makeUser = async (overrides = {}) =>
{
    const n = next();
    const { password = PASSWORD, ...rest } = overrides;
    return User.create({
        userName: `user${n}`,
        email: `user${n}@example.test`,
        password: hashFunction({ payload: password }),
        phone: '01012345678',
        address: 'Shebin El Kom',
        role: 'user',
        status: 'active',
        isConfirmed: true,
        isLoggedIn: true,
        ...rest,
    });
};

export const makeAdmin = (overrides = {}) => makeUser({ role: 'admin', ...overrides });

// Same payload shape as login; extra claims (e.g. iat) may be passed for edge cases
export const tokenFor = (user, extra = {}) => tokenFunction({
    payload: { id: user._id, email: user.email, userName: user.userName, role: user.role, ...extra },
});

// Property.create (not insertMany): the pre-save hook generates the unique slug
export const makeProperty = async (owner, overrides = {}) =>
{
    const n = next();
    return Property.create({
        title: `Property ${n}`,
        description: 'A nice place to live',
        type: 'شقة',
        category: 'rent',
        price: 3000,
        area: 120,
        bedrooms: 2,
        bathrooms: 1,
        location: { address: '1 Main St', city: 'طنطا' },
        contactInfo: { name: 'Owner', phone: '01012345678', email: 'owner@example.test' },
        owner: owner._id,
        status: 'available',
        isApproved: true,
        isActive: true,
        ...overrides,
    });
};

export const makePendingProperty = (owner, overrides = {}) =>
    makeProperty(owner, { status: 'pending', isApproved: false, isActive: false, ...overrides });

let png;
// Small real PNG (sharp runs for real in the upload pipeline)
export const pngBuffer = async () =>
{
    png ??= await sharp({ create: { width: 2, height: 2, channels: 3, background: '#3366ff' } }).png().toBuffer();
    return png;
};

// Pulls the confirmation JWT / reset code out of a mocked sendEmail call
export const confirmationTokenFrom = (call) => call[0].message.match(/confirm-email\/([\w.-]+)/)?.[1];
export const resetCodeFrom = (call) => call[0].message.match(/letter-spacing: 5px; color: #333;">\s*([A-Za-z0-9_-]{6})\s*<\/div>/)?.[1];
