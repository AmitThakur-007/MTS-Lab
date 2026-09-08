import fs from 'fs';
import path from 'path';
import assert from 'assert';

async function runSupportEmailAudit() {
  console.log('================================================================================');
  console.log('MTS LAB — SUPPORT EMAIL REPLACEMENT AUDIT & VERIFICATION');
  console.log('================================================================================');

  const OLD_EMAIL = 'mtslabcustomerservice@gmail.com';
  const NEW_EMAIL = 'support@mobiletechnologystation.com.np';

  // 1. Check for any leftover occurrences in src/
  console.log('\n--- 1. Checking for zero residual occurrences of old email in src/ ---');
  function scanDir(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        scanDir(filePath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html')) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  const srcFiles = scanDir(path.join(process.cwd(), 'src'));
  let foundOldCount = 0;
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(OLD_EMAIL)) {
      console.error(`❌ Old email found in: ${file}`);
      foundOldCount++;
    }
  }
  assert.strictEqual(foundOldCount, 0, 'No files in src/ should contain the old email');
  console.log('  ✓ PASS: Exactly 0 occurrences of old email in src/');

  // 2. Check each target file for the new email and mailto link
  console.log('\n--- 2. Verifying new email and mailto link across target components ---');
  const targetFiles = [
    { file: 'src/components/Footer.tsx', label: 'Footer Component' },
    { file: 'src/pages/Home.tsx', label: 'Home Page' },
    { file: 'src/pages/Contact.tsx', label: 'Contact Page' },
    { file: 'src/pages/About.tsx', label: 'About Page' },
    { file: 'src/pages/Terms.tsx', label: 'Terms Page' },
    { file: 'src/pages/Privacy.tsx', label: 'Privacy Page' },
  ];

  for (const target of targetFiles) {
    const fullPath = path.join(process.cwd(), target.file);
    assert(fs.existsSync(fullPath), `${target.label} exists`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.includes(NEW_EMAIL), `${target.label} contains new email ${NEW_EMAIL}`);
    assert(content.includes(`mailto:${NEW_EMAIL}`), `${target.label} contains mailto:${NEW_EMAIL}`);
    console.log(`  ✓ PASS: ${target.label} contains verified display text and mailto link`);
  }

  // 3. Contact page has two occurrences (direct text link and support CTA button)
  console.log('\n--- 3. Verifying Contact.tsx dual email link integration ---');
  const contactContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Contact.tsx'), 'utf8');
  const contactMailtoMatches = (contactContent.match(new RegExp(`mailto:${NEW_EMAIL}`, 'g')) || []).length;
  assert.strictEqual(contactMailtoMatches, 2, 'Contact.tsx should have exactly 2 mailto links for the support email');
  console.log('  ✓ PASS: Contact.tsx has 2 verified mailto links (Inbox Support + Support Desk Button)');

  // 4. Check Responsive Handling
  console.log('\n--- 4. Checking responsive text wrapping and overflow prevention ---');
  const footerContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Footer.tsx'), 'utf8');
  assert(footerContent.includes('break-all'), 'Footer email uses break-all to prevent horizontal overflow');

  const homeContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Home.tsx'), 'utf8');
  assert(homeContent.includes('break-all') && homeContent.includes('min-w-0'), 'Home email uses break-all and min-w-0');

  const aboutContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/About.tsx'), 'utf8');
  assert(aboutContent.includes('break-all'), 'About email uses break-all');

  const privacyContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Privacy.tsx'), 'utf8');
  assert(privacyContent.includes('truncate'), 'Privacy email uses truncate');

  const termsContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Terms.tsx'), 'utf8');
  assert(termsContent.includes('truncate'), 'Terms email uses truncate');
  console.log('  ✓ PASS: All components implement overflow protection (break-all / truncate / min-w-0)');

  // 5. Test Live HTTP Routes
  console.log('\n--- 5. Checking Live HTTP accessibility of all affected pages ---');
  const routes = ['/', '/about', '/contact', '/terms', '/privacy', '/services', '/shop'];
  for (const route of routes) {
    const res = await fetch(`http://localhost:3000${route}`);
    assert.strictEqual(res.status, 200, `GET ${route} returns HTTP 200`);
    console.log(`  ✓ PASS: http://localhost:3000${route} is accessible (HTTP 200)`);
  }

  console.log('\n================================================================================');
  console.log('ALL SUPPORT EMAIL AUDIT & VERIFICATION CHECKS PASSED (100%)');
  console.log('================================================================================');
}

runSupportEmailAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
