import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { config } from '../api/_server/config/supabase';

const BASE_URL = 'http://127.0.0.1:3000';

// Generate authentic 1x1 test image buffers
function generateValidJpeg(): Buffer {
  // Minimal valid JPEG stream (SOI, APP0, SOF0, SOS, EOI)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9
  ]);
}

function generateValidPng(): Buffer {
  // Minimal valid 1x1 PNG stream
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a,
    0x2d, 0xb4,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82 // IEND
  ]);
}

function generateValidWebp(): Buffer {
  // Minimal valid 1x1 WebP
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x1a, 0x00, 0x00, 0x00, // Size
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x4c, // VP8L
    0x0d, 0x00, 0x00, 0x00, // Size
    0x2f, 0x00, 0x00, 0x00, 0x00, 0x07, 0x88, 0x81, 0x08, 0x00, 0x00, 0x00, 0x00
  ]);
}

async function runSecurityAudit() {
  console.log('\n🔒 ========================================================');
  console.log('   MTS LAB — LEADERSHIP PHOTO SECURITY AUDIT & TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // Generate test tokens
  const superAdminToken = jwt.sign(
    { email: 'mtsmobilelab@gmail.com' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const technicianToken = jwt.sign(
    { email: 'omprakashthakur950rt@gmail.com' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const receptionistToken = jwt.sign(
    { email: 'pramilashrestha597@gmail.com' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const managerToken = jwt.sign(
    { email: 'aashishshing58@gmail.com' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { email: 'customer.regular@example.com' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  console.log('--- TEST GROUP 1: PUBLIC / UNAUTHENTICATED USERS BLOCKED ---');
  // 1.1: Request without authorization header
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 401, 'Unauthenticated public request returns 401 Unauthorized', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Unauthenticated public request returns 401', err.message);
  }

  // 1.2: Request with bogus token
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid.bogus.token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 401, 'Public request with bogus token returns 401 Unauthorized', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Public request with bogus token returns 401', err.message);
  }

  // 1.3: Request from non-staff customer account
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 401, 'Non-staff customer request returns 401 Unauthorized', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Non-staff customer request returns 401 Unauthorized', err.message);
  }

  // 1.4: Direct request to /api/team/update-photo alias without token returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/team/update-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 401, 'Direct /api/team/update-photo without token returns 401 Unauthorized', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Direct /api/team/update-photo returns 401 Unauthorized', err.message);
  }

  console.log('\n--- TEST GROUP 2: NON-ADMIN AUTHENTICATED USERS BLOCKED ---');
  // 2.1: Technician role
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${technicianToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 403, 'Technician role returns 403 Forbidden', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Technician role returns 403 Forbidden', err.message);
  }

  // 2.2: Receptionist role
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${receptionistToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 403, 'Receptionist role returns 403 Forbidden', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Receptionist role returns 403 Forbidden', err.message);
  }

  // 2.3: Manager role
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 403, 'Manager role returns 403 Forbidden', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Manager role returns 403 Forbidden', err.message);
  }

  console.log('\n--- TEST GROUP 3: TARGET VALIDATION & IDOR PREVENTION ---');
  // 3.1: Path traversal attempt
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: '../../etc/passwd', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 400, 'Path traversal target rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Path traversal target rejected', err.message);
  }

  // 3.2: Non-whitelisted target
  try {
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'random-user-id', base64: generateValidJpeg().toString('base64') })
    });
    assert(res.status === 400, 'Arbitrary non-leadership target rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Arbitrary non-leadership target rejected', err.message);
  }

  console.log('\n--- TEST GROUP 4: FILE VALIDATION & FORMAT ENFORCEMENT ---');
  // 4.1: Malicious SVG / Script payload
  try {
    const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: svgPayload })
    });
    assert(res.status === 400, 'Malicious SVG payload rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Malicious SVG rejected', err.message);
  }

  // 4.2: HTML payload
  try {
    const htmlPayload = Buffer.from('<html><body>Fake Image</body></html>').toString('base64');
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: htmlPayload })
    });
    assert(res.status === 400, 'HTML file rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'HTML file rejected', err.message);
  }

  // 4.3: Executable binary payload
  try {
    const exePayload = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00').toString('base64');
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: exePayload })
    });
    assert(res.status === 400, 'Executable binary payload rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Executable binary rejected', err.message);
  }

  // 4.4: Oversized file (> 5MB)
  try {
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    // Add JPEG header to bypass signature check
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;
    oversizedBuffer[3] = 0xe0;

    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: oversizedBuffer.toString('base64') })
    });
    assert(res.status === 400, 'Oversized file (>5MB) rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Oversized file rejected', err.message);
  }

  // 4.5: Polyglot JPEG with embedded malicious script
  try {
    const polyglotBuf = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.from('<script>alert("xss")</script>')
    ]);
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: polyglotBuf.toString('base64') })
    });
    assert(res.status === 400, 'Polyglot JPEG with script tag rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Polyglot JPEG with script rejected', err.message);
  }

  // 4.6: Polyglot JPEG with embedded PHP script
  try {
    const polyglotPhp = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.from('<?php phpinfo(); ?>')
    ]);
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'ceo', base64: polyglotPhp.toString('base64') })
    });
    assert(res.status === 400, 'Polyglot JPEG with PHP script rejected with 400 Bad Request', `Got ${res.status}`);
  } catch (err: any) {
    assert(false, 'Polyglot JPEG with PHP rejected', err.message);
  }

  console.log('\n--- TEST GROUP 5: ATOMIC STORAGE & INTEGRITY PRESERVATION ---');
  // 5.1: Verify original CEO image exists and is preserved on disk
  const ceoPhotoPath = path.join(process.cwd(), 'public', 'images', 'team', 'sabita-thakur.jpg');
  const founderPhotoPath = path.join(process.cwd(), 'public', 'images', 'team', 'manish-sharma.jpg');
  const technicalHeadPhotoPath = path.join(process.cwd(), 'public', 'images', 'team', 'amit-sharma.jpg');

  assert(fs.existsSync(ceoPhotoPath), 'CEO photo exists in public/images/team/sabita-thakur.jpg');
  assert(fs.existsSync(founderPhotoPath), 'Founder photo exists in public/images/team/manish-sharma.jpg');
  assert(fs.existsSync(technicalHeadPhotoPath), 'Technical Head photo exists in public/images/team/amit-sharma.jpg');

  const preSize = fs.statSync(ceoPhotoPath).size;
  const preBuffer = fs.readFileSync(ceoPhotoPath);

  // Attempt invalid update: verify old file is NOT destroyed or wiped
  await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ target: 'ceo', base64: 'corrupted-data' })
  });

  const postSize = fs.statSync(ceoPhotoPath).size;
  assert(preSize === postSize, 'Pre-existing photo remains untouched on failed update attempt');

  console.log('\n--- TEST GROUP 6: AUTHORIZED ADMIN UPDATE SUCCEEDS ---');
  // 6.1: Super Admin updates Founder photo with authentic PNG
  try {
    const pngBuf = generateValidPng();
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'founder', base64: pngBuf.toString('base64') })
    });
    const data = await res.json();
    assert(res.status === 200, 'Super Admin updates Founder photo successfully (200 OK)', `Got ${res.status}`);
    assert(data.success === true, 'Response contains success: true');
    assert(typeof data.url === 'string' && data.url.includes('/images/team/manish-sharma.jpg?v='), 'Response contains cache-busted URL (?v=)');

    // Restore high-res photo from src/assets if available
    const assetFounder = path.join(process.cwd(), 'src', 'assets', 'team', 'manish-sharma.jpg');
    if (fs.existsSync(assetFounder)) {
      fs.copyFileSync(assetFounder, founderPhotoPath);
    }
  } catch (err: any) {
    assert(false, 'Super Admin Founder update failed', err.message);
  }

  // 6.2: Super Admin updates Technical Head photo with authentic WebP
  try {
    const webpBuf = generateValidWebp();
    const res = await fetch(`${BASE_URL}/api/admin/team/update-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'technical-head', base64: webpBuf.toString('base64') })
    });
    const data = await res.json();
    assert(res.status === 200, 'Super Admin updates Technical Head photo successfully (200 OK)', `Got ${res.status}`);
    assert(typeof data.url === 'string' && data.url.includes('/images/team/amit-sharma.jpg?v='), 'Response contains cache-busted URL (?v=)');

    // Restore high-res photo from src/assets if available
    const assetTech = path.join(process.cwd(), 'src', 'assets', 'team', 'amit-sharma.jpg');
    if (fs.existsSync(assetTech)) {
      fs.copyFileSync(assetTech, technicalHeadPhotoPath);
    }
  } catch (err: any) {
    assert(false, 'Super Admin Technical Head update failed', err.message);
  }

  console.log('\n--- TEST GROUP 7: FRONTEND ABOUT.TSX SECURITY AUDIT ---');
  const aboutFile = path.join(process.cwd(), 'src', 'pages', 'About.tsx');
  const aboutContent = fs.readFileSync(aboutFile, 'utf8');

  assert(aboutContent.includes("const canEditPhotos = !!user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');"),
    'About.tsx contains strict canEditPhotos authorization check for SUPER_ADMIN or ADMIN');

  assert(aboutContent.includes('{canEditPhotos && ('),
    'About.tsx wraps photo change controls inside canEditPhotos condition');

  assert(aboutContent.includes('id={`change-photo-${getTargetKey(leader.shortRole)}`}'),
    'About.tsx renders unique change-photo ID for leadership cards');

  assert(aboutContent.includes('accept="image/jpeg,image/png,image/webp"'),
    'About.tsx restricts file input to JPEG, PNG, and WebP');

  // Verify public elements still intact
  assert(aboutContent.includes('Sabita Thakur'), 'About.tsx retains CEO Sabita Thakur');
  assert(aboutContent.includes('Manish Thakur'), 'About.tsx retains Founder Manish Thakur');
  assert(aboutContent.includes('Amit Thakur'), 'About.tsx retains Technical Head Amit Thakur');
  assert(aboutContent.includes('object-[center_18%]'), 'About.tsx preserves optical framing for CEO image');

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
