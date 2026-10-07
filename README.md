<!-- @format -->

# Saknly Backend Server

A modern real estate platform API built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Authentication**: JWT-based authentication with email verification
- **Property Management**: CRUD operations for real estate properties
- **Image Upload**: Cloudinary integration for property images
- **Advanced Search**: Filter properties by location, price, type, amenities
- **Pagination**: Efficient data pagination for all listing endpoints
- **Role-based Access**: User and Admin roles with appropriate permissions
- **Data Validation**: Comprehensive input validation using Joi
- **Error Handling**: Centralized error handling with detailed messages
- **Security**: CORS, Helmet, and input sanitization
- **Arabic Support**: RTL language support and Arabic content

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Image Storage**: Cloudinary
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting
- **File Upload**: Express-fileupload
- **Email**: Nodemailer (for future implementation)

## 📁 Project Structure

```
server/
├── DB/
│   └── connection.js          # MongoDB connection
├── Model/
│   ├── UserModel.js          # User schema
│   └── PropertyModel.js      # Property schema
├── modules/
│   ├── Auth/
│   │   ├── authController.js
│   │   ├── authRoutes.js
│   │   └── authValidation.js
│   ├── User/
│   │   ├── userController.js
│   │   ├── userRoutes.js
│   │   └── userValidation.js
│   └── Property/
│       ├── propertyController.js
│       └── propertyRoutes.js
├── config/
│   └── cloudinary.js        # Cloudinary configuration
├── utils/
│   ├── errorMiddleware.js    # Error handling
│   ├── authMiddleware.js     # Authentication middleware
│   └── pagination.js        # Pagination utilities
├── services/                 # Business logic services
├── index.js                 # Server entry point
└── package.json
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- Cloudinary account (for image uploads)

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment Setup**
   Create a `.env` file in the server directory:

   ```env
   # Environment
   NODE_ENV=development

   # Server Configuration
   PORT=8000
   CLIENT_URL=http://localhost:3000

   # Database
   MONGODB_URI=mongodb://localhost:27017/saknly

   # JWT
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_very_long_and_random
   JWT_EXPIRES_IN=30d

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

3. **Start the server**

   ```bash
   # Development mode with auto-restart
   npm run dev

   # Production mode
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint                          | Description            | Access  |
| ------ | --------------------------------- | ---------------------- | ------- |
| POST   | `/api/auth/register`              | Register new user      | Public  |
| POST   | `/api/auth/login`                 | User login             | Public  |
| GET    | `/api/auth/me`                    | Get current user       | Private |
| GET    | `/api/auth/verify/:token`         | Verify email           | Public  |
| POST   | `/api/auth/forgot-password`       | Request password reset | Public  |
| POST   | `/api/auth/reset-password/:token` | Reset password         | Public  |
| PUT    | `/api/auth/change-password`       | Change password        | Private |
| POST   | `/api/auth/logout`                | Logout user            | Private |

### User Endpoints

| Method | Endpoint             | Description         | Access      |
| ------ | -------------------- | ------------------- | ----------- |
| GET    | `/api/users`         | Get all users       | Admin       |
| GET    | `/api/users/profile` | Get user profile    | Private     |
| PUT    | `/api/users/profile` | Update user profile | Private     |
| PUT    | `/api/users/avatar`  | Update user avatar  | Private     |
| DELETE | `/api/users/avatar`  | Delete user avatar  | Private     |
| GET    | `/api/users/stats`   | Get user statistics | Admin       |
| GET    | `/api/users/:id`     | Get user by ID      | Owner/Admin |
| PUT    | `/api/users/:id`     | Update user         | Admin       |
| DELETE | `/api/users/:id`     | Delete user         | Admin       |

### Property Endpoints

| Method | Endpoint                             | Description                       | Access      |
| ------ | ------------------------------------ | --------------------------------- | ----------- |
| GET    | `/api/properties`                    | Get all properties (with filters) | Public      |
| POST   | `/api/properties`                    | Create new property               | Private     |
| GET    | `/api/properties/user/my-properties` | Get user properties               | Private     |
| GET    | `/api/properties/stats`              | Get property statistics           | Admin       |
| GET    | `/api/properties/:id`                | Get property by ID/slug           | Public      |
| PUT    | `/api/properties/:id`                | Update property                   | Owner/Admin |
| DELETE | `/api/properties/:id`                | Delete property                   | Owner/Admin |
| POST   | `/api/properties/:id/favorite`       | Toggle favorite                   | Private     |

### Query Parameters for Property Search

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 12, max: 100)
- `search`: Search in title, description, address
- `type`: Property type (apartment, house, villa, etc.)
- `category`: rent or sale
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `bedrooms`: Number of bedrooms
- `bathrooms`: Number of bathrooms
- `city`: City name
- `amenities`: Array of amenities
- `sortBy`: Sort field (price, createdAt, views)
- `sortOrder`: asc or desc

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📝 Data Models

### User Model

- Personal information (name, email, phone)
- Authentication (password, verification status)
- Profile (avatar, language, address)
- Preferences (property types, price range, notifications)
- Role-based access control

### Property Model

- Basic information (title, description, type, category)
- Pricing and area details
- Location with coordinates support
- Image gallery with Cloudinary integration
- Amenities and features
- Owner and agent references
- Approval workflow for admin control
- Views and favorites tracking

## 🛡️ Security Features

- **Rate Limiting**: Prevents API abuse
- **CORS**: Configured for frontend domain
- **Helmet**: Security headers
- **Input Validation**: Joi validation schemas
- **Password Hashing**: bcrypt with salt rounds
- **JWT Security**: Secure token generation and validation
- **File Upload Security**: Type and size validation

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=8000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/saknly
JWT_SECRET=your_production_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLIENT_URL=https://your-frontend-domain.com
```

### Docker Deployment (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@saknly.com or create an issue in the repository.

---

**Made with ❤️ by the Saknly Team**
