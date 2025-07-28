import mongoose from "mongoose";

const connectDB = async () =>
{
    try
    { 
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log("Connected to MongoDB");
    }
    catch (error)
    {
        console.log("Error connecting to MongoDB: caue ::", error.message);
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () =>
{
    console.log('MongoDB disconnected !!!!!!!!!!!!!!!!');
});

mongoose.connection.on('error', (err) =>
{
    console.error('MongoDB error: ' + err);
});

export default connectDB;