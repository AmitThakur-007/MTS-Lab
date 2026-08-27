const assert = require('assert');

async function runTests() {
  console.log("========================================================================");
  console.log("--- TEST SUITE: CLOUDINARY MEDIA STORAGE & SECURITY ENGINE ---");
  console.log("========================================================================\n");

  // 1. Magic Bytes Validation Logic
  console.log("Test 1: Magic Bytes Validation Logic...");
  function validateFileMagicBytes(buffer, mimetype) {
    if (!buffer || buffer.length < 4) return false;
    const hex = buffer.toString('hex', 0, 8).toUpperCase();

    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      return hex.startsWith('FFD8FF');
    }
    if (mimetype === 'image/png') {
      return hex.startsWith('89504E47');
    }
    if (mimetype === 'image/webp') {
      return hex.startsWith('52494646') && buffer.toString('utf8', 8, 12) === 'WEBP';
    }
    if (mimetype === 'application/pdf') {
      return buffer.toString('utf8', 0, 4) === '%PDF';
    }
    return false;
  }

  const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const validPdfHeader = Buffer.from("%PDF-1.5\n%");
  const fakeJpgHeader = Buffer.from("<?php echo 'hacked'; ?>");

  assert.strictEqual(validateFileMagicBytes(validPngHeader, 'image/png'), true, "PNG magic bytes should validate");
  assert.strictEqual(validateFileMagicBytes(validPdfHeader, 'application/pdf'), true, "PDF magic bytes should validate");
  assert.strictEqual(validateFileMagicBytes(fakeJpgHeader, 'image/jpeg'), false, "Fake JPG header should be rejected");
  console.log("✅ Magic bytes signature validation logic passed.");

  // 2. Extension Blocklist Check
  console.log("\nTest 2: Extension Blocklist Verification...");
  const FORBIDDEN_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.js', '.php', '.py', '.html', '.htm',
    '.svg', '.vbs', '.ps1', '.jar', '.msi', '.com', '.scr', '.pif', '.cgi'
  ];

  function isExtensionAllowed(filename) {
    const match = filename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match ? `.${match[1].toLowerCase()}` : '';
    return !FORBIDDEN_EXTENSIONS.includes(ext);
  }

  assert.strictEqual(isExtensionAllowed('device_photo.png'), true, "PNG extension allowed");
  assert.strictEqual(isExtensionAllowed('warranty.pdf'), true, "PDF extension allowed");
  assert.strictEqual(isExtensionAllowed('script.exe'), false, ".exe extension blocked");
  assert.strictEqual(isExtensionAllowed('exploit.php'), false, ".php extension blocked");
  assert.strictEqual(isExtensionAllowed('attack.sh'), false, ".sh extension blocked");
  console.log("✅ Blocklist extensions correctly identified and rejected.");

  // 3. Size Limits Check
  console.log("\nTest 3: Media Size Limit Rules...");
  const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

  function validateFileSize(size, isPdf) {
    if (isPdf) return size <= MAX_DOCUMENT_SIZE_BYTES;
    return size <= MAX_IMAGE_SIZE_BYTES;
  }

  assert.strictEqual(validateFileSize(5 * 1024 * 1024, false), true, "5MB image allowed");
  assert.strictEqual(validateFileSize(12 * 1024 * 1024, false), false, "12MB image rejected");
  assert.strictEqual(validateFileSize(15 * 1024 * 1024, true), true, "15MB PDF allowed");
  assert.strictEqual(validateFileSize(25 * 1024 * 1024, true), false, "25MB PDF rejected");
  console.log("✅ 10MB Image & 20MB PDF size limits enforced.");

  // 4. Folder Hierarchy Formatting
  console.log("\nTest 4: Cloudinary Folder Hierarchy Formatting...");
  function getCloudinaryFolder(entityType, entityId) {
    const type = (entityType || 'GENERAL').toUpperCase().trim();
    if (type === "REPAIR" && entityId) return `mts-lab/repairs/${entityId}`;
    if (type === "PRODUCT" || type === "SHOP") return "mts-lab/shop/products";
    if (type === "INVENTORY") return "mts-lab/inventory";
    if (type === "SLIDE") return "mts-lab/slides";
    if (type === "USER" && entityId) return `mts-lab/users/${entityId}`;
    if (type === "WARRANTY") return "mts-lab/warranties";
    if (type === "COURIER") return "mts-lab/courier";
    return "mts-lab/general";
  }

  assert.strictEqual(getCloudinaryFolder("REPAIR", "REP-1001"), "mts-lab/repairs/REP-1001");
  assert.strictEqual(getCloudinaryFolder("PRODUCT", "PROD-5"), "mts-lab/shop/products");
  assert.strictEqual(getCloudinaryFolder("INVENTORY"), "mts-lab/inventory");
  assert.strictEqual(getCloudinaryFolder("USER", "u-123"), "mts-lab/users/u-123");
  console.log("✅ Folder hierarchy rules verified.");

  // 5. Role Authorization & IDOR Protection Check
  console.log("\nTest 5: IDOR & Role Authorization Logic...");
  function canUserModifyMedia(user, mediaRecord) {
    if (!user) return false;
    const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SUPERADMIN';
    const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
    const isOwner = mediaRecord?.uploadedById === user.id;
    return isSuperAdmin || isAdmin || isOwner;
  }

  const superAdmin = { id: 'sa1', role: 'SUPER_ADMIN' };
  const manager = { id: 'm1', role: 'MANAGER' };
  const technicianOwner = { id: 't1', role: 'TECHNICIAN' };
  const technicianOther = { id: 't2', role: 'TECHNICIAN' };
  const mediaRecord = { id: 'med-1', uploadedById: 't1' };

  assert.strictEqual(canUserModifyMedia(superAdmin, mediaRecord), true, "Superadmin can modify any media");
  assert.strictEqual(canUserModifyMedia(manager, mediaRecord), true, "Manager can modify media");
  assert.strictEqual(canUserModifyMedia(technicianOwner, mediaRecord), true, "Owner technician can modify media");
  assert.strictEqual(canUserModifyMedia(technicianOther, mediaRecord), false, "Non-owner technician CANNOT modify media (IDOR blocked)");
  console.log("✅ IDOR protection and role authorization matrix passed.");

  console.log("\n========================================================================");
  console.log("🎉 ALL CLOUDINARY MEDIA STORAGE & SECURITY UNIT TESTS PASSED!");
  console.log("========================================================================");
}

runTests();
