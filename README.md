# AutoSuite — Commercial Automotive Sales & Fleet Rental System

AutoSuite is a full-stack automotive dealership and fleet rental management installation developed for individual dealerships, car rental companies, and combined automotive businesses.

## Key Capabilities

- **Configurable Business Modes**: Supports `SALES_ONLY`, `RENTAL_ONLY`, and `COMBINED` storefront & admin workflows.
- **Buyer-Branded Public Website**: Configurable business name, tagline, hero copy, currency, pickup/return locations, and rental policies.
- **Private Asset Isolation**: Public vehicle listings exclude private registration numbers and VINs, which are stored in staff-restricted `/vehicle_private` records.
- **Conflict-Free Rental Scheduling**: Rental approvals execute inside database transactions against `/vehicle_schedules/{vehicleId}` to guarantee zero overlapping confirmed bookings.
- **Integer-Cents Monetary Precision**: All rental quotes, deposits, manual payments, and outstanding balances are computed in integer minor units.
- **Role-Based Access Control**: Enforces `SUPER_ADMIN`, `BUSINESS_ADMIN`, `STAFF`, and `CUSTOMER` permissions across UI and Firestore security rules.

## Scripts

- `npm run dev` — Starts the Express API + Vite development server on port `3000`.
- `npm run build` — Builds the production React bundle into `dist/`.
- `npm run start` — Starts the production Express server serving `dist/` and `/api/*`.
- `npm run lint` — Runs TypeScript type checking (`tsc --noEmit`).

## API & OpenAPI Documentation

When the server is running, interactive OpenAPI documentation is available at:

- `/api/docs`
- `/api/openapi.json`
- `/api/health`

## Optional Integrations

Configure optional secrets in your environment:

- `RESEND_API_KEY` & `RESEND_FROM_EMAIL` — Enables transactional email delivery for booking confirmations and inquiries.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — Optional Cloudflare R2 storage settings (falls back to validated local `/uploads` storage when unset).
