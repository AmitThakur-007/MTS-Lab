import jwt from 'jsonwebtoken';
import { config } from '../api/_server/config/supabase';

const BASE_URL = 'http://localhost:3000/api';

async function runSlideshowVerification() {
  console.log('================================================================');
  console.log('🚀 MTS LAB SLIDESHOW CMS ROOT CAUSE & FULL CRUD VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  // 1. Generate Super Admin Token for Amit Thakur
  const adminToken = jwt.sign(
    {
      id: 'bd2bd9a4-f6a6-4168-871f-7ed8f9731591',
      email: 'amitsharma64017900@gmail.com',
      role: 'SUPER_ADMIN',
      name: 'Amit Thakur'
    },
    config.jwtSecret,
    { expiresIn: '2h' }
  );

  console.log('--- 1. Verification of the exact reported failing endpoint ---');
  // Reported: Cannot GET /api/admin/slides/05a101ca-1cc4-4ef0-a2b4-cd2d8751552c
  const reportedSlideId = '05a101ca-1cc4-4ef0-a2b4-cd2d8751552c';
  const resReportedAdmin = await fetch(`${BASE_URL}/admin/slides/${reportedSlideId}`);
  assert(resReportedAdmin.status === 200, `GET /api/admin/slides/${reportedSlideId} returns HTTP 200 OK (Root Cause Fixed!)`);
  const slideReportedData = await resReportedAdmin.json();
  assert(slideReportedData.id === reportedSlideId, `Slide ID matches: ${slideReportedData.id}`);
  assert(Boolean(slideReportedData.title), `Slide has title: "${slideReportedData.title}"`);
  assert(Boolean(slideReportedData.imageUrl), `Slide has imageUrl: "${slideReportedData.imageUrl}"`);

  // Public alias: GET /api/slides/:id
  const resReportedPublic = await fetch(`${BASE_URL}/slides/${reportedSlideId}`);
  assert(resReportedPublic.status === 200, `GET /api/slides/${reportedSlideId} returns HTTP 200 OK`);

  // 404 on nonexistent slide
  const resNonExistent = await fetch(`${BASE_URL}/admin/slides/ffffffff-ffff-ffff-ffff-ffffffffffff`);
  assert(resNonExistent.status === 404, `GET /api/admin/slides/:id for non-existent slide returns HTTP 404`);

  console.log('\n--- 2. Testing Image Uploads ---');
  // A. Multipart FormData with field 'image'
  const dummyPixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const fd1 = new FormData();
  fd1.append('image', new Blob([dummyPixel], { type: 'image/png' }), 'test_pixel_1.png');

  const uploadRes1 = await fetch(`${BASE_URL}/admin/slides/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: fd1
  });
  assert(uploadRes1.status === 200, 'POST /api/admin/slides/upload-image (FormData "image") returns HTTP 200');
  const uploadData1 = await uploadRes1.json();
  assert(Boolean(uploadData1.url), `Uploaded image URL returned: ${uploadData1.url}`);
  assert(uploadData1.success === true, 'Upload response contains success: true');

  // Verify accessibility
  if (uploadData1.url && uploadData1.url.startsWith('/')) {
    const fileCheck = await fetch(`http://localhost:3000${uploadData1.url}`);
    assert(fileCheck.status === 200, `Local image asset accessible via HTTP 200: ${uploadData1.url}`);
  }

  // B. Multipart FormData with field 'file'
  const fd2 = new FormData();
  fd2.append('file', new Blob([dummyPixel], { type: 'image/png' }), 'test_pixel_2.png');

  const uploadRes2 = await fetch(`${BASE_URL}/admin/slides/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: fd2
  });
  assert(uploadRes2.status === 200, 'POST /api/admin/slides/upload-image (FormData "file") returns HTTP 200');
  const uploadData2 = await uploadRes2.json();
  assert(Boolean(uploadData2.url), `Upload with field "file" succeeded: ${uploadData2.url}`);

  // C. Base64 payload
  const b64Payload = `data:image/png;base64,${dummyPixel.toString('base64')}`;
  const uploadRes3 = await fetch(`${BASE_URL}/admin/slides/upload-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ base64Image: b64Payload })
  });
  assert(uploadRes3.status === 200, 'POST /api/admin/slides/upload-image (Base64) returns HTTP 200');
  const uploadData3 = await uploadRes3.json();
  assert(Boolean(uploadData3.url), `Base64 upload returned URL: ${uploadData3.url}`);

  console.log('\n--- 3. Testing Slide Creation ---');
  const newSlidePayload = {
    title: 'Precision Micro-Soldering Lab Test',
    description: 'BGA Reballing and specialized logic board trace repairs with 6-month warranty.',
    imageUrl: uploadData1.url,
    buttonText: 'Check Price',
    buttonLink: '/services?focus=motherboard',
    displayOrder: 10,
    status: 'ACTIVE'
  };

  const createRes = await fetch(`${BASE_URL}/admin/slides`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify(newSlidePayload)
  });
  assert(createRes.status === 201, 'POST /api/admin/slides creates slide with HTTP 201');
  const createdSlide = await createRes.json();
  assert(Boolean(createdSlide.id), `Created slide assigned ID: ${createdSlide.id}`);
  assert(createdSlide.title === newSlidePayload.title, 'Created slide title matches');

  console.log('\n--- 4. Testing Slide Retrieval by ID ---');
  const getCreatedRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`);
  assert(getCreatedRes.status === 200, `GET /api/admin/slides/${createdSlide.id} returns HTTP 200`);
  const fetchedCreated = await getCreatedRes.json();
  assert(fetchedCreated.id === createdSlide.id, 'Fetched slide matches created ID');

  console.log('\n--- 5. Testing Slide Update (PUT and PATCH) ---');
  // PUT update
  const putRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      title: 'Precision Micro-Soldering - Updated Title',
      imageUrl: uploadData2.url
    })
  });
  assert(putRes.status === 200, 'PUT /api/admin/slides/:id returns HTTP 200');
  const putData = await putRes.json();
  assert(putData.title === 'Precision Micro-Soldering - Updated Title', 'Slide title updated successfully');
  assert(putData.imageUrl === uploadData2.url, 'Slide image updated successfully');

  // PATCH partial update
  const patchRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      description: 'Newly patched description for lab repairs.'
    })
  });
  assert(patchRes.status === 200, 'PATCH /api/admin/slides/:id returns HTTP 200');
  const patchData = await patchRes.json();
  assert(patchData.description === 'Newly patched description for lab repairs.', 'Slide description updated via PATCH');

  console.log('\n--- 6. Testing Slide Activation / Deactivation ---');
  // Deactivate via toggle-status
  const toggleRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}/toggle-status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(toggleRes.status === 200, 'PATCH /api/admin/slides/:id/toggle-status returns HTTP 200');
  const toggledData = await toggleRes.json();
  assert(toggledData.status === 'INACTIVE', 'Slide status toggled to INACTIVE');

  // Check public active list — inactive slide MUST NOT be present
  const publicSlidesRes1 = await fetch(`${BASE_URL}/slides`);
  const publicSlides1: any[] = await publicSlidesRes1.json();
  const foundInPublicWhenInactive = publicSlides1.some(s => s.id === createdSlide.id);
  assert(!foundInPublicWhenInactive, 'Deactivated slide is NOT present in public homepage slideshow');

  // Check admin all list — inactive slide MUST be present
  const adminSlidesRes = await fetch(`${BASE_URL}/admin/slides`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminSlides: any[] = await adminSlidesRes.json();
  const foundInAdmin = adminSlides.some(s => s.id === createdSlide.id);
  assert(foundInAdmin, 'Deactivated slide remains accessible in Admin CMS list');

  // Re-activate via explicit status endpoint
  const statusRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'ACTIVE' })
  });
  assert(statusRes.status === 200, 'PATCH /api/admin/slides/:id/status returns HTTP 200');
  const statusData = await statusRes.json();
  assert(statusData.status === 'ACTIVE', 'Slide status set back to ACTIVE');

  // Check public list — now it MUST appear
  const publicSlidesRes2 = await fetch(`${BASE_URL}/slides`);
  const publicSlides2: any[] = await publicSlidesRes2.json();
  const foundInPublicWhenActive = publicSlides2.some(s => s.id === createdSlide.id);
  assert(foundInPublicWhenActive, 'Activated slide now appears on public homepage slideshow');

  console.log('\n--- 7. Testing Slide Reordering ---');
  const reorderRes = await fetch(`${BASE_URL}/admin/slides/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      slides: [
        { id: createdSlide.id, displayOrder: 1 }
      ]
    })
  });
  assert(reorderRes.status === 200, 'PUT /api/admin/slides/reorder returns HTTP 200');

  console.log('\n--- 8. Testing Slide Deletion ---');
  const deleteRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(deleteRes.status === 200, 'DELETE /api/admin/slides/:id returns HTTP 200');

  // Verify 404 after deletion
  const getAfterDeleteRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`);
  assert(getAfterDeleteRes.status === 404, 'GET deleted slide returns HTTP 404');

  // Verify absence from public list
  const publicAfterDeleteRes = await fetch(`${BASE_URL}/slides`);
  const publicAfterDelete: any[] = await publicAfterDeleteRes.json();
  const foundAfterDelete = publicAfterDelete.some(s => s.id === createdSlide.id);
  assert(!foundAfterDelete, 'Deleted slide is removed from homepage slideshow');

  console.log('\n================================================================');
  console.log(`SLIDESHOW CMS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSlideshowVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
