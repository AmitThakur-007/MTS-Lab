import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

async function runTests() {
  console.log('=== STARTING MTS LAB SLIDESHOW CMS & IMAGE UPLOAD VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  const prisma = new PrismaClient();

  try {
    // 1. Generate Auth Tokens
    console.log('--- 1. Authenticating Admin and Super Admin ---');
    let superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', deletedAt: null }
    });

    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: 'admin_slideshow_test@mtslab.com',
          name: 'Slideshow Test Admin',
          role: 'SUPER_ADMIN',
          password: 'testpassword123'
        }
      });
    }

    const adminToken = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    assert(Boolean(adminToken), 'Admin token generated successfully');

    // 2. Test Public Slides Endpoints
    console.log('\n--- 2. Testing Public Slides Endpoints ---');
    const pubSlidesRes = await fetch(`${BASE_URL}/public/slides`);
    assert(pubSlidesRes.status === 200, 'GET /api/public/slides returns HTTP 200');
    const pubSlides: any = await pubSlidesRes.json();
    assert(Array.isArray(pubSlides), 'Public slides endpoint returns array');
    assert(pubSlides.length >= 4, `Contains ${pubSlides.length} active slides in database`);

    const pubHomeSlidesRes = await fetch(`${BASE_URL}/public/home-slides`);
    assert(pubHomeSlidesRes.status === 200, 'GET /api/public/home-slides returns HTTP 200');

    // 3. Test Static Resolution of the 4 Key Hero Images
    console.log('\n--- 3. Testing 4 MTS Lab Hero Slideshow Images ---');
    const heroImagePaths = [
      '/assets/images/front_glass_repair_1786719176945.jpg',
      '/assets/images/display_replace_1786719191504.jpg',
      '/assets/images/back_glass_fix_1786719207185.jpg',
      '/assets/images/phone_repair_lab_1786719222650.jpg'
    ];

    for (const imgPath of heroImagePaths) {
      const res = await fetch(`http://localhost:3000${imgPath}`);
      assert(res.status === 200, `Hero image accessible via HTTP: ${imgPath} (HTTP 200)`);
      const contentType = res.headers.get('content-type');
      assert(Boolean(contentType && contentType.includes('image')), `Content-Type is valid image for ${imgPath}`);
    }

    // 4. Test Multipart FormData Image Upload
    console.log('\n--- 4. Testing Admin Image Upload via Multipart FormData ---');
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const formData = new FormData();
    const blob = new Blob([dummyImageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test_upload_sample.png');

    const formUploadRes = await fetch(`${BASE_URL}/admin/slides/upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: formData
    });

    assert(formUploadRes.status === 200, 'POST /api/admin/slides/upload-image (FormData) returns HTTP 200');
    const formUploadData: any = await formUploadRes.json();
    assert(Boolean(formUploadData.url), `Uploaded image returned URL: ${formUploadData.url}`);
    assert(formUploadData.success === true, 'Upload response contains success: true');

    // Verify uploaded file is accessible
    const checkFormUploaded = await fetch(`http://localhost:3000${formUploadData.url}`);
    assert(checkFormUploaded.status === 200, 'Uploaded file is immediately accessible via HTTP');

    // 5. Test Large Base64 Image Upload (Checking 50MB Limit Fix)
    console.log('\n--- 5. Testing Large Base64 Image Upload (>100KB body) ---');
    // Generate a ~300KB Base64 payload
    const largeBuffer = Buffer.alloc(300 * 1024, 0x41); // 300KB
    const largeBase64 = `data:image/jpeg;base64,${largeBuffer.toString('base64')}`;

    const base64UploadRes = await fetch(`${BASE_URL}/admin/slides/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ base64Image: largeBase64 })
    });

    assert(base64UploadRes.status === 200, 'POST /api/admin/slides/upload-image (Large Base64) returns HTTP 200 without 413 error');
    const base64UploadData: any = await base64UploadRes.json();
    assert(Boolean(base64UploadData.url), `Base64 uploaded image returned URL: ${base64UploadData.url}`);

    // 6. Test Slide CRUD Operations
    console.log('\n--- 6. Testing Slide CRUD Management API ---');
    // Create Slide
    const createSlideRes = await fetch(`${BASE_URL}/admin/slides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'OCA Curved Glass Repair Test',
        description: 'Testing precision glass replacement',
        imageUrl: formUploadData.url,
        buttonText: 'Check Price',
        buttonLink: '/services?focus=search&q=Glass',
        displayOrder: 99,
        status: 'ACTIVE'
      })
    });

    assert(createSlideRes.status === 201, 'POST /api/admin/slides creates new slide (HTTP 201)');
    const createdSlide: any = await createSlideRes.json();
    assert(Boolean(createdSlide.id), `Created slide has database ID: ${createdSlide.id}`);

    // Update Slide
    const updateSlideRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'OCA Curved Glass Repair - Updated Title',
        description: 'Updated description for testing',
        imageUrl: formUploadData.url,
        buttonText: 'View Rates',
        buttonLink: '/services',
        displayOrder: 99,
        status: 'ACTIVE'
      })
    });

    assert(updateSlideRes.status === 200, 'PUT /api/admin/slides/:id updates slide (HTTP 200)');
    const updatedSlide: any = await updateSlideRes.json();
    assert(updatedSlide.title === 'OCA Curved Glass Repair - Updated Title', 'Slide title updated in database');

    // Toggle Status
    const toggleRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}/toggle-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert(toggleRes.status === 200, 'PATCH /api/admin/slides/:id/toggle-status returns HTTP 200');
    const toggledSlide: any = await toggleRes.json();
    assert(toggledSlide.status === 'INACTIVE', 'Slide status toggled to INACTIVE');

    // Delete Slide
    const deleteRes = await fetch(`${BASE_URL}/admin/slides/${createdSlide.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert(deleteRes.status === 200, 'DELETE /api/admin/slides/:id removes slide (HTTP 200)');

    console.log('\n==============================================');
    console.log(`SLIDESHOW CMS TEST RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log('==============================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
