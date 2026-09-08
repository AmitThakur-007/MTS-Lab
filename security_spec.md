# Security Specification: MTS Lab Firestore Security (Phase 0)

## 1. System Overview & Core Data Invariants
- **Multi-Tenant / Branch Relational Integrity**: A repair order or staff profile belongs to an authorized Branch. Sub-resources and repair logs must reference an existing valid repair/branch.
- **Role-Based Access Control (RBAC)**: User roles (`SUPER_ADMIN`, `ADMIN`, `TECHNICIAN`, `RECEPTIONIST`) are strictly enforced. Standard authenticated users cannot escalate their role, alter other users' roles, or bypass approval gates.
- **PII Isolation**: Customer names, phone numbers, and user profile data (emails, addresses, phone numbers) are protected. Public access is strictly forbidden for user records and customer repair logs; public clients can only query public catalogues (e.g. `repairPrices`, `homeSlides`, `products`).
- **Immutability & Timestamps**: Primary identity references (`userId`, `createdById`, `createdAt`, `repairNumber`) are immutable post-creation. All timestamps must match `request.time`.
- **Default Deny**: All unmapped documents and invalid key mutations reject by default.

---

## 2. The "Dirty Dozen" Malicious Payloads (Attack Vectors)

1. **Payload 1 (Privilege Escalation on Register/Create)**:
   - *Attack*: A non-admin user creates their own `/users/{uid}` profile with `role: "SUPER_ADMIN"` or `accountStatus: "APPROVED"`.
   - *Expected Result*: `PERMISSION_DENIED`.
2. **Payload 2 (Shadow Fields Injection on Repair)**:
   - *Attack*: A user creates a repair document with unmapped arbitrary fields like `{ backdoor: true, role: "admin" }` violating schema size/keys.
   - *Expected Result*: `PERMISSION_DENIED`.
3. **Payload 3 (Immutability Bypass on Repair Number / Creator)**:
   - *Attack*: A technician updates a repair document modifying `createdById` or changing `repairNumber`.
   - *Expected Result*: `PERMISSION_DENIED`.
4. **Payload 4 (Client-Forged Timestamps)**:
   - *Attack*: Creating/updating a record with a fake backdated timestamp `{ createdAt: "2020-01-01T00:00:00Z" }` instead of server `request.time`.
   - *Expected Result*: `PERMISSION_DENIED`.
5. **Payload 5 (Unauthenticated/Unauthorized Public Catalogue Tampering)**:
   - *Attack*: Anonymous or regular technician client writing/deleting `/repairPrices/{id}` or `/homeSlides/{id}`.
   - *Expected Result*: `PERMISSION_DENIED`.
6. **Payload 6 (PII Data Leak via Blanket List Query)**:
   - *Attack*: An unauthenticated or low-privilege user attempting an unconstrained list read on `/users` or `/accessRequests`.
   - *Expected Result*: `PERMISSION_DENIED`.
7. **Payload 7 (Path Traversal / Poisoned ID Injection)**:
   - *Attack*: Injecting an oversized 2KB path key or special characters `../../../etc/passwd` into document ID paths.
   - *Expected Result*: `PERMISSION_DENIED` (via `isValidId()` guard).
8. **Payload 8 (Terminal State Tampering)**:
   - *Attack*: A user updating a repair order after it has reached `DELIVERED` or `CANCELLED` status without Admin privilege.
   - *Expected Result*: `PERMISSION_DENIED`.
9. **Payload 9 (Cross-User Profile Hijacking)**:
   - *Attack*: User `uid_A` writing or updating data in `/users/uid_B`.
   - *Expected Result*: `PERMISSION_DENIED`.
10. **Payload 10 (Access Request Self-Approval)**:
    - *Attack*: A pending user directly patching their own `/accessRequests/{id}` document to `status: "APPROVED"`.
    - *Expected Result*: `PERMISSION_DENIED`.
11. **Payload 11 (Audit Log Forgery / Deletion)**:
    - *Attack*: A user modifying or deleting historical entries in `/auditLogs/{id}`.
    - *Expected Result*: `PERMISSION_DENIED` (Audit logs are strictly write/create append-only or admin-restricted).
12. **Payload 12 (Denial of Wallet / Unbounded Array Bomb)**:
    - *Attack*: Submitting an array or string property exceeding maximum length boundaries (e.g. 500,000 characters).
    - *Expected Result*: `PERMISSION_DENIED`.
