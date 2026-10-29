import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('1. Official MTS Lab Logo asset files exist and are valid PNGs', () => {
  const primaryLogoPath = path.join(projectRoot, 'public/images/mts-lab-logo.png');
  const mirroredLogoPath = path.join(projectRoot, 'public/assets/images/mts-lab-logo.png');
  const uploadedAssetPath = path.join(projectRoot, 'public/assets/aistudio/Glossy_Smartphone_Repair_Icon_cab5d123.png');

  assert.ok(fs.existsSync(primaryLogoPath), 'Primary logo asset exists at /public/images/mts-lab-logo.png');
  assert.ok(fs.existsSync(mirroredLogoPath), 'Mirrored logo asset exists at /public/assets/images/mts-lab-logo.png');
  assert.ok(fs.existsSync(uploadedAssetPath), 'Uploaded source asset exists in /public/assets/aistudio/');

  // Verify PNG signature (0x89, 'P', 'N', 'G')
  const buffer = fs.readFileSync(primaryLogoPath);
  assert.ok(buffer.length > 100000, `Logo file size should be substantial (actual: ${buffer.length} bytes)`);
  assert.equal(buffer[0], 0x89, 'PNG magic byte 0');
  assert.equal(buffer[1], 0x50, 'PNG magic byte 1 (P)');
  assert.equal(buffer[2], 0x4e, 'PNG magic byte 2 (N)');
  assert.equal(buffer[3], 0x47, 'PNG magic byte 3 (G)');
});

test('2. BrandLogo component exists and exports official constants and fallback', () => {
  const componentPath = path.join(projectRoot, 'src/components/BrandLogo.tsx');
  assert.ok(fs.existsSync(componentPath), 'BrandLogo.tsx component exists');

  const content = fs.readFileSync(componentPath, 'utf-8');
  assert.ok(content.includes('export const OFFICIAL_LOGO_SRC = \'/images/mts-lab-logo.png\''), 'Has OFFICIAL_LOGO_SRC constant');
  assert.ok(content.includes('export const OFFICIAL_LOGO_ALT'), 'Has OFFICIAL_LOGO_ALT constant');
  assert.ok(content.includes('export default function BrandLogo'), 'Default exports BrandLogo component');
  assert.ok(content.includes('brand-fallback-blue'), 'Contains high-fidelity SVG fallback definition');
  assert.ok(content.includes('onError={handleImageError}'), 'Handles image error with graceful fallback');
});

test('3. Public Footer imports and displays BrandLogo', () => {
  const footerPath = path.join(projectRoot, 'src/components/Footer.tsx');
  const content = fs.readFileSync(footerPath, 'utf-8');

  assert.ok(content.includes('import BrandLogo from \'@/components/BrandLogo\''), 'Footer imports BrandLogo');
  assert.ok(content.includes('<BrandLogo'), 'Footer renders <BrandLogo');
  assert.ok(!content.includes('>M</div>'), 'Old "M" text placeholder removed from Footer brand block');
});

test('4. DashboardLayout displays official BrandLogo across desktop sidebar and mobile header', () => {
  const layoutPath = path.join(projectRoot, 'src/components/DashboardLayout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf-8');

  assert.ok(content.includes('import BrandLogo from \'@/components/BrandLogo\''), 'DashboardLayout imports BrandLogo');
  // Check sidebar brand
  assert.ok(content.includes('<BrandLogo\n                variant="icon"\n                size="md"'), 'Sidebar brand uses BrandLogo');
  // Check mobile top bar brand
  assert.ok(content.includes('<BrandLogo\n                variant="icon"\n                size="xs"'), 'Mobile header brand uses BrandLogo');
  assert.ok(!content.includes('>M</span>'), 'Old "M" text placeholder removed from mobile header');
});

test('5. Authentication and security screens display official BrandLogo', () => {
  const pages = [
    { file: 'src/pages/Login.tsx', name: 'Login' },
    { file: 'src/pages/ForgotPassword.tsx', name: 'ForgotPassword' },
    { file: 'src/pages/ResetPassword.tsx', name: 'ResetPassword' },
    { file: 'src/pages/PendingApproval.tsx', name: 'PendingApproval' },
    { file: 'src/pages/RejectedAccess.tsx', name: 'RejectedAccess' },
  ];

  for (const { file, name } of pages) {
    const fullPath = path.join(projectRoot, file);
    assert.ok(fs.existsSync(fullPath), `${name} page exists`);
    const content = fs.readFileSync(fullPath, 'utf-8');
    assert.ok(content.includes('BrandLogo'), `${name} imports or renders BrandLogo`);
    assert.ok(!content.includes('const mtsLogo = \'/apple-touch-icon.png\''), `${name} no longer uses apple-touch-icon placeholder for logo`);
  }
});

test('6. Public pages and components reference official logo asset cleanly', () => {
  const navbarPath = path.join(projectRoot, 'src/components/Navbar.tsx');
  const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
  assert.ok(navbarContent.includes('/images/mts-lab-logo.png'), 'Navbar references official logo asset');

  const emblemPath = path.join(projectRoot, 'src/components/common/MtsEmblem.tsx');
  const emblemContent = fs.readFileSync(emblemPath, 'utf-8');
  assert.ok(emblemContent.includes('/images/mts-lab-logo.png'), 'MtsEmblem references official logo asset');

  const aboutPath = path.join(projectRoot, 'src/pages/About.tsx');
  const aboutContent = fs.readFileSync(aboutPath, 'utf-8');
  assert.ok(aboutContent.includes('/images/mts-lab-logo.png'), 'About page references official logo asset');
});
