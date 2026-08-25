# MTS Lab — Security & Compliance Audit Checklist

### Authentication & Authorization
- [x] Bcrypt password hashing enforced on all local accounts
- [x] JWT access tokens and rotatable refresh tokens
- [x] Server-side RBAC guards on all REST endpoints (`SUPER_ADMIN`, `RECEPTIONIST`, `TECHNICIAN`, etc.)
- [x] Multi-device support without false single-device blocks
- [x] Google OAuth approval workflow with server-side request limit (3 attempts max)
- [x] Instant session termination and all-session logout capability (`POST /api/auth/logout-all`)

### Data Persistence & Multi-Device Sync
- [x] Centralized database persistence for all modules (Staff, Customers, Repairs, Payments, Inventory, Settings)
- [x] Real-time bi-directional synchronization middleware (`syncToFirestore` and `syncRouteMiddleware`)
- [x] Zero browser-only storage for operational data (localStorage limited to client preferences & session tokens)
- [x] Auto-sync on startup and endpoint request execution

### Input Validation & Threat Defense
- [x] Sanitized search inputs and phone number normalization (+977 Nepal format support)
- [x] Public repair tracking endpoint rate-limited (`trackingLimiter`)
- [x] Response payload filtering to block sensitive internal details on public APIs
- [x] Generic error handling for authentication failures

### Audit Logging & Storage
- [x] Audit logs captured for authentication, user modifications, and status changes
- [x] Zero-dependency file uploads (inline Base64 data URIs with optional Cloudinary cloud storage integration)
- [x] Zero required external database secrets (`file:./dev.db` SQLite + Firebase Firestore bi-directional sync)
