import mongoose from "mongoose";

// Cached connection promise so serverless invocations reuse one connection.
// Reset on failure so the next request retries instead of failing forever.
let connectionPromise = null;

const connectDB = () =>
{
    if (mongoose.connection.readyState === 1)
    {
        return Promise.resolve(mongoose.connection);
    }

    // A warm instance whose connection fully dropped must reconnect, not reuse a stale promise
    if (mongoose.connection.readyState === 0 && connectionPromise)
    {
        connectionPromise = null;
    }

    if (!connectionPromise)
    {
        if (!process.env.MONGODB_URI)
        {
            return Promise.reject(new Error('MONGODB_URI is not set'));
        }

        connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.DB_NAME || 'saknly',
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        })
            .then((conn) =>
            {
                console.log("Connected to MongoDB");
                return conn.connection;
            })
            .catch((error) =>
            {
                connectionPromise = null;
                console.error("Error connecting to MongoDB:", error.message);
                throw error;
            });
    }

    return connectionPromise;
};

export const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export const getDbState = () => dbStates[mongoose.connection.readyState] || 'unknown';

// Express middleware: make sure the DB is connected before handling a request
export const ensureDbConnection = async (req, res, next) =>
{
    try
    {
        await connectDB();
        next();
    }
    catch (error)
    {
        res.status(503).json({
            success: false,
            message: 'Service temporarily unavailable (database connection failed). Please try again shortly.'
        });
    }
};

mongoose.connection.on('disconnected', () =>
{
    console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) =>
{
    console.error('MongoDB error: ' + err.message);
});

export default connectDB;
