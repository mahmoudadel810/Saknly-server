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

Node.js 22 · Express 5 · MongoDB with Mongoose 8 · RabbitMQ (amqplib) · JWT · Joi · Multer, sharp and Cloudinary · Nodemailer · Google OAuth (Passport) · Google Gemini · Docker Compose · Vitest, Supertest and mongodb-memory-server.

## API overview

All routes are under `/api/saknly/v1`. Authenticated requests send `Authorization: Saknly__<token>`.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-confirmation` · `GET /auth/getMe`, `/auth/confirm-email/:token`, `/auth/google` · `POST /auth/google/mobile` (`{ idToken }`, for the mobile app) |
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
| `GOOGLE_MOBILE_CLIENT_IDS` | optional | More Google client IDs (comma separated) whose ID tokens `POST /auth/google/mobile` accepts, besides `GOOGLE_CLIENT_ID`. The mobile endpoint needs only `GOOGLE_CLIENT_ID`, not the secret |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | for the chatbot | Gemini (model defaults to `gemini-2.5-flash`) |
| `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD` | | Passwords for the seed script; it generates random ones if they are not set |
| `RABBITMQ_URL` | for the queue | RabbitMQ connection. Without it, emails and Cloudinary deletes run inline as before |
| `QUEUE_PUBLISH_TIMEOUT_MS`, `QUEUE_RETRY_DELAYS_MS` | | Publish confirm timeout (default 3000) and retry delays (default `10000,30000,60000`) |

Features whose variables are missing switch off cleanly; for example, Google sign-in routes are disabled without its keys.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start |
| `npm test` | Run the test suite (Vitest, in-memory MongoDB, no external services) |
| `npm run test:smoke` | Quick smoke checks that need no database |
| `npm run seed -- --reset` | Replace the data with demo content |
| `npm run worker` | Start the queue worker (needs `RABBITMQ_URL`) |
| `node scripts/queue-smoke.js` | End-to-end queue check against the compose stack |

## Message queue (RabbitMQ)

Slow side effects — notification emails and Cloudinary deletes — leave the request: the API publishes an event and a separate **worker** process does the work. The queue is optional: with `RABBITMQ_URL` unset, or when a publish fails, the API does the work inline exactly as before.

**Producers (API)** and **consumers (worker)**

| Event | Published by | Consumed by |
|---|---|---|
| `user.registered`, `user.confirmation_resent` | register, resend confirmation | email, audit |
| `user.password_changed` | reset password | email, audit |
| `property.approved`, `property.denied` | admin approve / deny | email, audit |
| `property.deleted` | owner or admin delete | audit |
| `inquiry.created` | new inquiry | email, audit |
| `media.delete` | property delete/deny/update, agency logo change | media cleanup |

Forgot-password emails stay synchronous: the reset code is removed if the email can't be delivered, so the request needs the result. The chatbot stays synchronous too.

**Exchanges and queues**

| Exchange | Type | Queues (binding) |
|---|---|---|
| `saknly.events` | topic | `email.notifications` (`user.*`, `property.approved`, `property.denied`, `inquiry.created`) · `audit.log` (`#`) |
| `saknly.media` | direct | `media.cleanup` (`media.delete`) |
| `saknly.dlx` | direct | `<queue>.dlq`, one per work queue |

- **Topic** routes each event by pattern. `audit.log` bound to `#` receives every event, which covers broadcasting. A separate **fanout** exchange would only pay off once several services need every event and don't care about routing keys.
- **Direct** routes media jobs to the one queue that handles them.

**Message flow** (an admin approves a listing):

```
PUT /properties/:id/approve
  → propertyController saves the listing, calls dispatchEmail('property.approved', {...})
  → publisher: confirm channel, persistent message, messageId, x-attempt=1; waits for the broker confirm
  → saknly.events (topic) ──property.approved──┬→ email.notifications
                                               └→ audit.log
  → API responds 200 (the email is not awaited)
worker (prefetch 10, manual ack)
  → email.notifications: claim messageId → render template → sendEmail → ack
       on error: → email.notifications.retry.N (TTL 10s / 30s / 60s) → back to email.notifications
       after the 4th failed attempt: nack → saknly.dlx → email.notifications.dlq
  → audit.log: upsert AuditLog by messageId (ids only, no emails or links) → ack
```

**Reliability**
- Exchanges and queues are durable, and messages are persistent.
- The API awaits the publisher confirm before responding, because a frozen serverless function would drop an unconfirmed publish.
- Consumers ack manually, and only after the work succeeded.
- A failed message waits in a per-delay retry queue, which avoids head-of-line blocking from per-message TTLs. After 3 retries it goes to the DLQ. Errors that can't be fixed by retrying (bad payload, rejected recipient) go straight to the DLQ.
- Delivery is at-least-once, so the email consumer claims each `messageId` in MongoDB (`ProcessedMessage`, 7-day TTL), and a duplicate or redelivered copy is skipped. While another worker holds a claim, the copy waits in a retry queue without using up an attempt.
- A worker that crashes mid-message leaves its claim behind. The redelivered copy takes over once the claim is 2 minutes old and sends the email then. SMTP connection, greeting and idle timeouts are set well inside that window, which makes taking over a slow but still-live send unlikely (not impossible: a send that keeps trickling data can outlast it). Each claim carries a token, so a holder can only release its own claim, and a failure to mark a sent email `done` is logged rather than retried.
- When a publish fails, the API falls back to inline work under the same `messageId`. The inline email claims that id just like the worker, so a message the broker stored anyway (its confirm arrived after `QUEUE_PUBLISH_TIMEOUT_MS`) is still sent once. The audit row is written by the API in that case, and the consumer's upsert on the same `messageId` adds nothing.
- A retried approval email is skipped when the listing was deleted or sent back to review in the meantime.
- Approve and deny are single atomic updates on a listing still waiting for review: when two admins act at once, the first wins and the other gets a 409, so only one email goes out.
- On SIGTERM the worker stops taking messages, finishes the in-flight ones, then exits. Anything unacked is redelivered.
- Nothing replays the DLQ automatically. Inspect it in the RabbitMQ UI and move messages back by hand (or with the shovel plugin).

**Scaling (competing consumers):** run more worker replicas on the same queues. `prefetch` caps the unacked messages per replica (email 10, media 5, audit 20), so a burst of Cloudinary deletes spreads across replicas instead of piling onto one. Locally:

```bash
docker compose up -d --build              # RabbitMQ, MongoDB, Mailpit, API and one worker
docker compose up -d --scale worker=3     # three competing workers
```

- RabbitMQ UI: http://localhost:15672 (`guest`/`guest`).
- Mailpit catches every email at http://localhost:8025, so nothing is really sent.
- `docker compose stop mailpit` makes SMTP fail, which lets you watch the retries and the DLQ.

**Image processing** still runs in the upload request, because sharp and Cloudinary sit inside the multer storage engine and a worker can't read a serverless request's file. Queueing it would mean uploading the original first, then letting a worker re-encode it and swap the URL on the listing.

## Deployment

Deployed on Vercel as a serverless function: `index.js` exports the Express app and only listens when it runs outside Vercel. Pushing to `main` deploys. Set the environment variables above in the Vercel project, and allow Vercel's IPs (or `0.0.0.0/0`) in your MongoDB Atlas network access list.

Vercel can't run a long-lived consumer, so the worker runs on Render (`render.yaml`). Switch the queue on in this order:
1. **Broker:** create a CloudAMQP instance (the free Little Lemur plan: 20 connections, 1M messages a month) in AWS `us-east-1`, near Vercel's `iad1`. Copy its AMQPS URL.
2. **Worker:** in Render, choose New → Blueprint and pick this repo. Render reads `render.yaml` and asks for each value: `RABBITMQ_URL` from step 1, and the rest copied from the Vercel project. Background workers have no free instance (Starter plan). Wait for the log line `started with 3 consumer(s)`.
3. **API:** only then set `RABBITMQ_URL` on Vercel and redeploy. Doing this before the worker runs leaves emails waiting in the queue.

MongoDB Atlas must allow the worker's connections: add the outbound IP ranges listed on the Render service's Connect → Outbound tab, or keep `0.0.0.0/0` as for Vercel. Render blocks outbound port 25, so use SMTP on 465 or 587 (or `EMAIL_SERVICE`).

To switch the queue off again, remove `RABBITMQ_URL` from Vercel and redeploy: the API goes back to inline work, and the worker drains whatever is left.
