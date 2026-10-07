// Only these query keys may become MongoDB filters (anything else is ignored)
const FILTERABLE_FIELDS = [
    'category',
    'type',
    'status',
    'location.city',
    'location.district',
    'bedrooms',
    'bathrooms',
    'area',
    'price',
    'floor',
    'amenities',
    'agency',
    'isNegotiable',
    'isStudentFriendly',
    'paymentMethod',
    'ownershipType',
    'propertyStatus',
    'downPayment',
    'installmentPeriodInYears',
    'studentHousingDetails.genderPolicy',
    'studentHousingDetails.roomType',
];

const NUMERIC_FIELDS = ['bedrooms', 'bathrooms', 'area', 'price', 'floor', 'downPayment', 'installmentPeriodInYears'];

// Friendly aliases sent by some client pages
const KEY_ALIASES = {
    city: 'location.city',
    district: 'location.district',
    minPrice: 'price[gte]',
    maxPrice: 'price[lte]',
};

export const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toScalar = (value, key) =>
{
    if (NUMERIC_FIELDS.includes(key))
    {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }
    if (value === 'true' || value === 'false')
    {
        return value === 'true';
    }
    return String(value);
};

class ApiFeatures {
    /**
     * @param {Query} mongooseQuery
     * @param {Object} queryData   req.query
     * @param {Object} baseFilter  conditions applied LAST so user input can't override them
     */
    constructor(mongooseQuery, queryData = {}, baseFilter = {}) {
        this.mongooseQuery = mongooseQuery;
        this.queryData = queryData || {};
        this.baseFilter = baseFilter;
    }

    static getPage(queryData = {}) {
        const page = parseInt(queryData.page, 10);
        return Number.isFinite(page) && page > 0 ? page : 1;
    }

    static getLimit(queryData = {}) {
        const limit = parseInt(queryData.limit, 10);
        if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
        return Math.min(limit, MAX_LIMIT);
    }

    // Plain filter object built from the whitelisted query keys (+ search) + base filter
    static buildFilter(queryData = {}, baseFilter = {}) {
        const conditions = {};

        for (let [rawKey, value] of Object.entries(queryData || {})) {
            if (typeof rawKey !== 'string' || rawKey.startsWith('$')) continue;
            const key = KEY_ALIASES[rawKey] || rawKey;

            if (value === undefined || value === null || value === '') continue;

            // field[gte|gt|lte|lt]=value
            const match = key.match(/^(.*)\[(gte|gt|lte|lt)]$/);
            if (match) {
                const field = match[1];
                if (!FILTERABLE_FIELDS.includes(field) || !NUMERIC_FIELDS.includes(field)) continue;
                const n = Number(Array.isArray(value) ? value[0] : value);
                if (!Number.isFinite(n)) continue;
                if (typeof conditions[field] !== 'object' || conditions[field] === null) conditions[field] = {};
                conditions[field][`$${match[2]}`] = n;
                continue;
            }

            if (!FILTERABLE_FIELDS.includes(key)) continue;

            // Repeated keys arrive as arrays; comma lists mean "any of"
            const values = (Array.isArray(value) ? value : String(value).split(','))
                .map(v => (typeof v === 'string' ? v.trim() : v))
                .filter(v => v !== '' && typeof v !== 'object')
                .map(v => toScalar(v, key))
                .filter(v => v !== undefined);

            if (values.length === 0) continue;
            conditions[key] = values.length === 1 ? values[0] : { $in: values };
        }

        const search = queryData?.search;
        if (typeof search === 'string' && search.trim()) {
            const regex = { $regex: escapeRegex(search.trim().slice(0, 100)), $options: 'i' };
            conditions.$or = [
                { title: regex },
                { description: regex },
                { 'location.city': regex },
                { 'location.address': regex },
                { type: regex },
                { amenities: regex }
            ];
        }

        // Base conditions last: they win over anything from the query string
        return { ...conditions, ...baseFilter };
    }

    // 1.paginate
    paginate() {
        const page = ApiFeatures.getPage(this.queryData);
        const limit = ApiFeatures.getLimit(this.queryData);
        this.mongooseQuery.skip((page - 1) * limit).limit(limit);
        return this;
    }

    // 2.filter (includes search + base filter)
    filter() {
        this.mongooseQuery.find(ApiFeatures.buildFilter(this.queryData, this.baseFilter));
        return this;
    }

    // 3.sort
    sort() {
        const sort = this.queryData.sort;
        if (typeof sort === 'string' && sort.trim()) {
            const sortBy = sort.split(',')
                .map(f => f.trim())
                .filter(f => /^-?[A-Za-z0-9_.]+$/.test(f))
                .join(' ');
            this.mongooseQuery.sort(sortBy || '-createdAt');
        } else {
            this.mongooseQuery.sort('-createdAt');
        }
        return this;
    }

    // 4.limitfields
    limitFields() {
        const fields = this.queryData.fields;
        if (typeof fields === 'string' && fields.trim()) {
            const selected = fields.split(',')
                .map(f => f.trim())
                .filter(f => /^-?[A-Za-z0-9_.]+$/.test(f)) // no "+field" (would un-hide select:false fields)
                .join(' ');
            this.mongooseQuery.select(selected || '-__v');
        } else {
            this.mongooseQuery.select('-__v');
        }
        return this;
    }

    // 5.search - kept for compatibility; search is applied inside filter()
    search() {
        return this;
    }
}

export default ApiFeatures;
