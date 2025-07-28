/**
 * Pagination utility for MongoDB queries
 */

/**
 * Create pagination object
 * @param {Object} query - Mongoose query object
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} totalDocs - Total number of documents
 * @returns {Object} Pagination information
 */
export const createPagination = (page, limit, totalDocs) =>
{
    const currentPage = parseInt(page, 10) || 1;
    const itemsPerPage = parseInt(limit, 10) || 10;
    const totalPages = Math.ceil(totalDocs / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = currentPage * itemsPerPage;

    const pagination = {
        currentPage,
        totalPages,
        totalDocs,
        itemsPerPage,
        hasNext: endIndex < totalDocs,
        hasPrev: startIndex > 0,
    };

    if (pagination.hasNext)
    {
        pagination.next = {
            page: currentPage + 1,
            limit: itemsPerPage,
        };
    }

    if (pagination.hasPrev)
    {
        pagination.prev = {
            page: currentPage - 1,
            limit: itemsPerPage,
        };
    }

    return pagination;
};

/**
 * Apply pagination to MongoDB query
 * @param {Object} query - Mongoose query object
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Modified query and pagination info
 */
export const applyPagination = async (Model, filter = {}, options = {}) =>
{
    const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        populate = [],
        select = '',
    } = options;

    const currentPage = parseInt(page, 10) || 1;
    const itemsPerPage = parseInt(limit, 10) || 10;
    const skip = (currentPage - 1) * itemsPerPage;

    // Get total count
    const totalDocs = await Model.countDocuments(filter);

    // Build query
    let query = Model.find(filter);

    // Apply select fields
    if (select)
    {
        query = query.select(select);
    }

    // Apply population
    if (populate.length > 0)
    {
        populate.forEach(pop =>
        {
            query = query.populate(pop);
        });
    }

    // Apply sorting, skip, and limit
    const results = await query
        .sort(sort)
        .skip(skip)
        .limit(itemsPerPage)
        .lean();

    // Create pagination info
    const pagination = createPagination(currentPage, itemsPerPage, totalDocs);

    return {
        data: results,
        pagination,
        totalDocs,
    };
};

/**
 * Advanced pagination with aggregation pipeline
 * @param {Object} Model - Mongoose model
 * @param {Array} pipeline - Aggregation pipeline
 * @param {Object} options - Pagination options
 * @returns {Object} Results with pagination
 */
export const aggregatePagination = async (Model, pipeline = [], options = {}) =>
{
    const {
        page = 1,
        limit = 10,
    } = options;

    const currentPage = parseInt(page, 10) || 1;
    const itemsPerPage = parseInt(limit, 10) || 10;
    const skip = (currentPage - 1) * itemsPerPage;

    // Create aggregation pipeline with pagination
    const aggregationPipeline = [
        ...pipeline,
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: itemsPerPage }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ];

    const [result] = await Model.aggregate(aggregationPipeline);

    const totalDocs = result.totalCount.length > 0 ? result.totalCount[0].count : 0;
    const data = result.data || [];

    const pagination = createPagination(currentPage, itemsPerPage, totalDocs);

    return {
        data,
        pagination,
        totalDocs,
    };
};

/**
 * Get pagination from request query
 * @param {Object} query - Request query object
 * @returns {Object} Pagination options
 */
export const getPaginationFromQuery = (query) =>
{
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(parseInt(query.limit, 10) || 10, 100); // Max 100 items per page

    return { page, limit };
};

/**
 * Create pagination response format
 * @param {Array} data - Data array
 * @param {Object} pagination - Pagination info
 * @param {string} message - Success message
 * @returns {Object} Formatted response
 */
export const createPaginatedResponse = (data, pagination, message = 'Data retrieved successfully') =>
{
    return {
        success: true,
        message,
        data,
        pagination,
        count: data.length,
        total: pagination.totalDocs,
    };
}; 