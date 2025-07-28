class ApiFeatures {
    constructor(mongooseQuery, queryData) {
        this.mongooseQuery = mongooseQuery;
        this.queryData = queryData;
    }

    // 1.paginate
    paginate() {
        let { page, limit } = this.queryData;
        page = page * 1 || 1;
        if (page < 1) page = 1;
        limit = limit * 1 || 10;
        const skip = (page - 1) * limit;
        this.mongooseQuery.skip(skip).limit(limit);
        return this;
    }


    // 2.filter
    filter() {
        const excludedFields = ['page', 'limit', 'sort', 'fields', 'search'];
        const queryObj = { ...this.queryData };
        excludedFields.forEach(field => delete queryObj[field]);

        let processedQuery = {};

        for (let key in queryObj) {
            let value = queryObj[key];

            const match = key.match(/^(.*)\[(gte|gt|lte|lt)]$/);
            if (match) {
                const actualKey = match[1];
                const operator = `$${match[2]}`;
                if (!processedQuery[actualKey]) {
                    processedQuery[actualKey] = {};
                }
                processedQuery[actualKey][operator] = Number(value);
            } else {
                if (value.includes(',')) {
                    processedQuery[key] = { $in: value.split(',') };
                } else if (value === 'true' || value === 'false') { 
                    processedQuery[key] = value === 'true';
                }
                else {
                    if (['bedrooms', 'bathrooms', 'area', 'price', 'downPayment', 'installmentPeriodInYears'].includes(key)) {
                             processedQuery[key] = Number(value);
                    } else if (key === 'location.city' || key === 'type' || key === 'amenities' || key === 'category' ) { 
                        processedQuery[key] = value;
                    } else {
                             processedQuery[key] = value;
                    }
                }
            }
        }

        this.mongooseQuery.find(processedQuery);
        return this;
    }


     // 3.sort
    sort() {
        if (this.queryData.sort) {
            const sortBy = this.queryData.sort.split(',').join(' ');
            this.mongooseQuery.sort(sortBy);
        } else {
            this.mongooseQuery.sort('-createdAt');
        }
        return this;
    }

// 4.limitfields
    limitFields() {
        if (this.queryData.fields) {
            const fields = this.queryData.fields.split(',').join(' ');
            this.mongooseQuery.select(fields);
        } else {
            this.mongooseQuery.select('-__v');
        }
        return this;
    }

//   5.search
    search() {
        if (this.queryData.search) {
            this.mongooseQuery.find({
                $or: [
                    { title: { $regex: this.queryData.search, $options: 'i' } },
                    { description: { $regex: this.queryData.search, $options: 'i' } },
                    { 'location.city': { $regex: this.queryData.search, $options: 'i' } },
                    { 'location.address': { $regex: this.queryData.search, $options: 'i' } },
                    { type: { $regex: this.queryData.search, $options: 'i' } },
                    { amenities: { $regex: this.queryData.search, $options: 'i' } } 
                ]
            });
        }
        return this;
    }


}

export default ApiFeatures;