# AutoSuite Security Specification (Phase 0)

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every Firestore path not explicitly allowed is denied (`allow read, write: if false;`).
2. **Role Integrity & No Self-Escalation**: Users creating their own `/users/{uid}` document can only assign `role: 'CUSTOMER'` and `permissions: []`. Only verified `SUPER_ADMIN` or `BUSINESS_ADMIN` (or bootstrapped admin `dushimec515@gmail.com` with `email_verified == true`) can elevate roles to `STAFF`, `BUSINESS_ADMIN`, or `SUPER_ADMIN`.
3. **Private Vehicle Registration Isolation**: Public `/vehicles/{vehicleId}` documents NEVER store `registrationNumber` or `vin`. Sensitive registration data lives exclusively in `/vehicle_private/{vehicleId}` readable only by verified `STAFF` and `ADMIN` accounts.
4. **Customer Data Isolation**: Customers can only `get`, `list`, `create`, and cancel their own `/bookings`, `/inquiries`, `/favorites`, `/notifications`, and `/payments`. Unauthenticated or cross-customer reads are rejected.
5. **Booking Terminal Locking & Atomic Overlap Prevention**: Completed, rejected, or cancelled bookings cannot be mutated by customers. Only `ADMIN` or `STAFF` can approve/reject/activate/complete bookings or record manual payments. Booking confirmation atomically updates `/vehicle_schedules/{vehicleId}` inside a Firestore `runTransaction`.
6. **Temporal & Key Integrity**: Document creation validates required and allowed keys (`hasAll` + `hasOnly`), string `.size()` bounds, ID regex `^[a-zA-Z0-9_\-]+$`, and server timestamp `request.time`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Role Escalation on Create**: Customer creates `/users/{uid}` with `{ role: "SUPER_ADMIN" }`.
2. **Role Escalation on Update**: Customer updates `/users/{uid}` changing `role` to `"BUSINESS_ADMIN"`.
3. **Ghost Shadow Field**: Customer creates `/inquiries/{id}` with extra field `{ isApprovedOverride: true }`.
4. **Cross-Customer Booking Read**: Customer A executes `get` or `list` on `/bookings` belonging to Customer B.
5. **Unverified Email Write**: User with `email_verified == false` attempts to create a booking or inquiry.
6. **Spoofed Customer ID**: Customer A creates a booking with `customerId: "customer_b_uid"`.
7. **Unauthorized Payment Recording**: Customer attempts to create a `/payments/{id}` document to mark their own booking paid.
8. **Private Registration Leak**: Unauthenticated visitor or `CUSTOMER` attempts to read `/vehicle_private/{vehicleId}`.
9. **Terminal State Bypass**: Customer attempts to update a `COMPLETED` or `CONFIRMED` booking's `totalAmountCents` or `status` back to `CONFIRMED`.
10. **ID Poisoning / Resource Exhaustion**: Attacker creates `/inquiries/{1500_char_id}` or sends a 50KB `message`.
11. **Audit Log Tampering**: Staff or customer attempts to `update` or `delete` `/audit_logs/{id}`.
12. **Client-Side Timestamp Forgery**: Attacker sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
