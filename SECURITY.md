# MTS Lab — Production Security Architecture & Data Protection Standard

## Overview
The **MTS Lab (Mobile Technology Station) Repair Management OS v2.0** is engineered for high-availability, zero-trust security, and multi-device cloud synchronization. It connects all authorized mobile, desktop, and tablet clients to a single centralized database layer.

---

## 1. Centralized Data Architecture & Multi-Device Sync
- **Single Source of Truth**: All operational data (Staff accounts, Customer profiles, Repair jobs, Status tracking, Inventory items, Payments, Reports, and System Settings) are backed by a centralized database infrastructure.
- **Bi-Directional Firestore Real-time Engine**: Express / Prisma middleware automatically pushes every create, update, or delete mutation to Firestore while pulling remote changes on API route execution (`syncRouteMiddleware`).
- **Cross-Device Support**: Staff can log in from Windows, macOS, Linux, Android, iOS, or iPadOS using any modern browser (Chrome, Safari, Firefox, Edge) with guaranteed identical real-time data state.

---

## 2. Authentication & Session Security
- **Bcrypt Password Hashing**: Standard password hashing algorithms prevent plaintext storage. Passwords are stripped before returning user objects in API payloads.
- **JWT Access & Refresh Tokens**: Short-lived access tokens (1 hour) with server-managed refresh tokens, allowing multi-device sign-in and session revocation (`/api/auth/logout-all`).
- **Google OAuth Approval System**: Server-enforced Google account access request limits (maximum 3 attempts stored in the database). Super Admins must manually evaluate and approve or reject access requests.

---

## 3. Backend Role-Based Access Control (RBAC)
Server-side authorization (`authorize(['SUPER_ADMIN', ...])`) ensures resource-level protection regardless of frontend state:
- **SUPER_ADMIN**: Full platform administration, staff lifecycle management, role assignment, access request approval, and global audit logging.
- **RECEPTIONIST**: Customer registration, repair ticket creation, payment collection, device return processing, and status lookup.
- **TECHNICIAN**: Assigned repair queue management, status workflow updates, technical notes, and estimated completion dates.
- **CUSTOMER**: Public status tracking restricted to specific repair ticket or verified customer phone numbers (`/api/track`).

---

## 4. Rate Limiting & Threat Prevention
- **Brute Force Protection**: Rate limiters applied to authentication endpoints (`/api/auth/login`, `/api/auth/forgot-password`).
- **Tracking Rate Limiting**: Dedicated rate limiter (`trackingLimiter`) on `/api/track` prevents ticket number enumeration or automated scraping.
- **Enumeration Defense**: Error messages maintain safe generic feedback (e.g. "Invalid email or password").

---

## 5. Audit Logging & Compliance
All state-changing operations create immutable `AuditLog` records containing:
- `userId`
- `action` (e.g., `LOGIN_SUCCESS`, `REPAIR_CREATED`, `USER_UPDATED`)
- `resource` & `resourceId`
- `details`
- Timestamp and client IP metadata

---

## 6. Cloud File Storage
- **Cloudinary Integration**: Safe image uploads for device condition photos and avatar images through server-managed upload streams, hiding API secrets from client bundles.
