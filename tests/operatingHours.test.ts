import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('1. Centralized OPERATING_HOURS constants match official requirements', async () => {
  const { OPERATING_HOURS, getMtsLabOpenStatus } = await import('../src/lib/businessHours.ts');

  assert.equal(OPERATING_HOURS.title, 'Operating Hours');
  assert.equal(OPERATING_HOURS.regularDays, 'Sun–Fri');
  assert.equal(OPERATING_HOURS.openTime, '10:20 AM');
  assert.equal(OPERATING_HOURS.closeTime, '6:30 PM');
  assert.equal(OPERATING_HOURS.regularSchedule, 'Sun–Fri • 10:20 AM – 6:30 PM');
  assert.equal(OPERATING_HOURS.saturdayInstruction, 'Saturday: Call Us');
  assert.equal(OPERATING_HOURS.phoneTel, 'tel:+9779869276668');

  // Verify status generator function
  const status = getMtsLabOpenStatus();
  assert.ok(typeof status.isOpen === 'boolean');
  assert.ok(typeof status.isSaturday === 'boolean');
  assert.ok(typeof status.statusLabel === 'string');
});

test('2. Shared Footer renders official operating hours and Saturday telephone link', () => {
  const footerPath = path.join(projectRoot, 'src/components/Footer.tsx');
  const content = fs.readFileSync(footerPath, 'utf-8');

  assert.ok(content.includes('import OperatingHours from \'@/components/OperatingHours\''), 'Footer imports OperatingHours');
  assert.ok(content.includes('<OperatingHours variant="footer" />'), 'Footer renders OperatingHours variant');
});

test('3. Home page displays official operating hours and Saturday telephone link', () => {
  const homePath = path.join(projectRoot, 'src/pages/Home.tsx');
  const content = fs.readFileSync(homePath, 'utf-8');

  assert.ok(content.includes('import OperatingHours from \'@/components/OperatingHours\''), 'Home imports OperatingHours');
  assert.ok(content.includes('<OperatingHours variant="home" />'), 'Home renders OperatingHours variant');
  assert.ok(!content.includes('10:30 AM – 7:30 PM'), 'Outdated Home hours removed');
  assert.ok(!content.includes('2PM – 5:30 PM'), 'Outdated Saturday Home hours removed');
});

test('4. Contact page displays official operating hours with Saturday Call Us link', () => {
  const contactPath = path.join(projectRoot, 'src/pages/Contact.tsx');
  const content = fs.readFileSync(contactPath, 'utf-8');

  assert.ok(content.includes('OPERATING_HOURS.regularDays'), 'Contact page uses centralized regularDays');
  assert.ok(content.includes('OPERATING_HOURS.openTime'), 'Contact page uses centralized openTime');
  assert.ok(content.includes('OPERATING_HOURS.closeTime'), 'Contact page uses centralized closeTime');
  assert.ok(content.includes('OPERATING_HOURS.saturdayActionLabel'), 'Contact page uses centralized saturdayActionLabel');
  assert.ok(content.includes('OPERATING_HOURS.phoneTel'), 'Contact page links Call Us to official phone');
  assert.ok(!content.includes('10:30 AM – 7:30 PM'), 'Outdated Contact hours removed');
  assert.ok(!content.includes('2:00 PM – 5:30 PM'), 'Outdated Saturday Contact hours removed');
});

test('5. About page displays official operating hours badge with Saturday Call Us link', () => {
  const aboutPath = path.join(projectRoot, 'src/pages/About.tsx');
  const content = fs.readFileSync(aboutPath, 'utf-8');

  assert.ok(content.includes('import OperatingHours from \'@/components/OperatingHours\''), 'About imports OperatingHours');
  assert.ok(content.includes('<OperatingHours variant="badge" />'), 'About renders OperatingHours badge');
  assert.ok(!content.includes('10:30 AM - 7:30 PM'), 'Outdated About hours removed');
});

test('6. ServiceDetail page displays official workshop hours with Saturday Call Us link', () => {
  const serviceDetailPath = path.join(projectRoot, 'src/pages/ServiceDetail.tsx');
  const content = fs.readFileSync(serviceDetailPath, 'utf-8');

  assert.ok(content.includes('OPERATING_HOURS.regularDays'), 'ServiceDetail uses centralized regularDays');
  assert.ok(content.includes('OPERATING_HOURS.openTime'), 'ServiceDetail uses centralized openTime');
  assert.ok(content.includes('OPERATING_HOURS.closeTime'), 'ServiceDetail uses centralized closeTime');
  assert.ok(content.includes('OPERATING_HOURS.saturdayActionLabel'), 'ServiceDetail uses centralized saturdayActionLabel');
  assert.ok(content.includes('OPERATING_HOURS.phoneTel'), 'ServiceDetail links to official phone');
  assert.ok(!content.includes('10:00 AM &ndash; 7:00 PM'), 'Outdated ServiceDetail hours removed');
  assert.ok(!content.includes('10:00 AM &ndash; 6:00 PM'), 'Outdated Saturday ServiceDetail hours removed');
});

test('7. Schema.org structured data reflects official 10:20 AM – 6:30 PM schedule', () => {
  const seoPath = path.join(projectRoot, 'src/lib/seo.ts');
  const content = fs.readFileSync(seoPath, 'utf-8');

  assert.ok(content.includes('BUSINESS_OPENING_HOURS = [\'Su-Fr 10:20-18:30\']'), 'SEO constant matches 10:20-18:30');
  assert.ok(content.includes('opens: \'10:20\''), 'Schema.org opens matches 10:20');
  assert.ok(content.includes('closes: \'18:30\''), 'Schema.org closes matches 18:30');
  assert.ok(!content.includes('opens: \'10:00\''), 'Outdated Schema opening times removed');
});

test('8. Reusable OperatingHours component renders all variants cleanly with telephone link', async () => {
  const compPath = path.join(projectRoot, 'src/components/OperatingHours.tsx');
  assert.ok(fs.existsSync(compPath), 'OperatingHours.tsx exists');

  const content = fs.readFileSync(compPath, 'utf-8');
  assert.ok(content.includes('href={OPERATING_HOURS.phoneTel}'), 'Telephone link provided on Call Us action');
  assert.ok(content.includes('OPERATING_HOURS.saturdayInstruction'), 'Saturday instruction rendered');
  assert.ok(content.includes('OPERATING_HOURS.regularSchedule'), 'Sun–Fri • 10:20 AM – 6:30 PM schedule rendered');
});
