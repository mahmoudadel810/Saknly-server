<div dir="rtl">

# سكنلي — Saknly API

</div>

The REST API behind [Saknly](https://saknly-ruddy.vercel.app), an Arabic-first property marketplace for Egypt with listings for sale, for rent and student housing. It handles accounts and sign-in, listings with photo uploads and admin review, search and filters across Egypt's governorates, wishlists, inquiries, comments, testimonials, a contact inbox, admin analytics and a Gemini-powered chatbot.

**Base URL:** `https://saknly-server-9air.vercel.app/api/saknly/v1` · **Frontend:** [Saknly-client](https://github.com/mahmoudadel810/Saknly-client)

<p align="center">
  <img src="https://raw.githubusercontent.com/mahmoudadel810/Saknly-client/main/docs/screenshots/home.webp" alt="Saknly home page" width="720">
</p>

## Features

- **Accounts**: email sign-up with confirmation, Google sign-in, JWT access and refresh tokens, logout that revokes existing tokens, and password reset by emailed code.
- **Listings**: create, edit and delete with up to 8 photos (re-encoded with sharp, stored on Cloudinary). Listings go live only after an admin approves them, and deleting one also cleans up its images, comments, inquiries and favourites.
- **Search**: filter by category, governorate, city, type, price and area ranges, rooms and amenities, with sorting and pagination. Filter keys are whitelisted and search text is escaped.
- **People and content**: wishlists, property inquiries, comments, testimonials with moderation, and a contact-us inbox.
- **Admin**: an analytics overview, a moderation queue, and user, agency, inquiry and testimonial management. Admins cannot delete themselves, and the last admin cannot be deleted or demoted.
- **Chatbot**: answers questions about real listings, prices and how to use the site, using Google Gemini.
- **Safety**: role and ownership checks on every write, Joi validation, Helmet, a CORS allow-list, and errors that never leak internals.

## Tech stack

Node.js 22 · Express 5 · MongoDB with Mongoose 8 · JWT · Joi · Multer, sharp and Cloudinary · Nodemailer · Google OAuth (Passport) · Google Gemini · Vitest, Supertest and mongodb-memory-server.

## API overview

All routes are under `/api/saknly/v1`. Authenticated requests send `Authorization: Saknly__<token>`.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-confirmation` · `GET /auth/getMe`, `/auth/confirm-email/:token`, `/auth/google` |
| Properties | `GET /properties/allProperties`, `/search`, `/featured`, `/getMostViewedProperties`, `/propertyDetails/:id`, `/similar/:id`, `/myProperties` · `POST /properties/addProperty` · `PUT /properties/updateProperty/:id` · `DELETE /properties/deleteProperty/:id` · favourites `POST/GET/DELETE /properties/:id/favorite` |
| Moderation (admin) | `GET /properties/pending` · `PUT /properties/:id/approve` · `DELETE /properties/:id/deny` · `GET /admin/analytics` |
| Users | `GET /users/me/wishlist` · `POST/DELETE /users/me/wishlist/:propertyId` · admin: `GET /users/get-all-users`, `/users/get-user/:id` · `PUT /users/update-user/:id` · `DELETE /users/delete-user/:id` |
| Agencies | `GET /agencies`, `/agencies/featured`, `/agencies/:id` · admin: `POST /agencies`, `PUT/DELETE /agencies/:id` |
| Inquiries | `POST /property-inquiry/add-property-inquiry` · admin: list, get, update status, delete, stats |
| Comments | `GET/POST /property-comments/:propertyId` |
| Testimonials | `POST /testimonial`, `GET /testimonial` (approved) · admin: `GET /testimonial/all`, `PUT /testimonial/:id/status`, `DELETE /testimonial/:id` |
| Contact | `POST /contact/contact-us` · admin: list, update status, delete |
| Chatbot | `POST /chat` with `{ "question": "..." }` |

## Getting started

Requirements: Node.js 20 or later and a MongoDB database (local or Atlas).

```bash
npm install
# create .env (see below)
npm run seed -- --reset   # optional: demo users, agencies and listings
npm run dev               # http://localhost:5000
```

### Environment variables (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI`, `DB_NAME` | yes | Database connection (`DB_NAME` defaults to `saknly`) |
| `JWT_SECRET` | yes | Signs access and refresh tokens; `JWT_EXPIRES_IN` sets their lifetime |
| `CLIENT_URL` | yes | Frontend URL, used for CORS and email links; add more origins with `CORS_ORIGINS` |
| `BEARER_KEY` | | Authorization prefix (default `Saknly__`) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | for uploads | Photo storage |
| `EMAIL_SERVICE` or `EMAIL_SMTP_HOST`/`PORT`/`USER`/`PASS`, `EMAIL_FROM` | for email | Confirmation and password-reset emails |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALLBACK_URL` | for Google sign-in | Google OAuth |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | for the chatbot | Gemini (model defaults to `gemini-2.5-flash`) |
| `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD` | | Passwords for the seed script; it generates random ones if they are not set |

Features whose variables are missing switch off cleanly; for example, Google sign-in routes are disabled without its keys.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start |
| `npm test` | Run the test suite (Vitest, in-memory MongoDB, no external services) |
| `npm run test:smoke` | Quick smoke checks that need no database |
| `npm run seed -- --reset` | Replace the data with demo content |

## Deployment

Deployed on Vercel as a serverless function: `index.js` exports the Express app and only listens when it runs outside Vercel. Pushing to `main` deploys. Set the environment variables above in the Vercel project, and allow Vercel's IPs (or `0.0.0.0/0`) in your MongoDB Atlas network access list.
