import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`\x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passed++;
  } else {
    console.error(`\x1b[31m✘ FAIL\x1b[0m: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('  MTS Lab — iPhone Input Auto-Zoom Fix Verification Suite');
console.log('================================================================\n');

// 1. Viewport & Accessibility Verification
const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

assert(
  indexHtml.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0" />'),
  'Standard responsive viewport meta tag is present'
);
assert(
  !indexHtml.includes('user-scalable=no') && !indexHtml.includes('maximum-scale=1'),
  'Pinch-to-zoom is fully permitted (no user-scalable=no or maximum-scale=1)'
);

// 2. SEO & AEO Integrity
assert(
  indexHtml.includes('<title>MTS Lab – Smartphone Hardware &amp; Chip-Level Repair Lab Kathmandu</title>'),
  'Primary SEO title is intact'
);
assert(
  indexHtml.includes('https://www.mobiletechnologystation.com.np/'),
  'Canonical URL and OpenGraph URL are intact'
);
assert(
  indexHtml.includes('"@type": "LocalBusiness"'),
  'Structured JSON-LD schema is intact'
);

// 3. Global CSS Auto-Zoom Prevention Rules
const indexCssPath = path.resolve(process.cwd(), 'src/index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

assert(
  indexCss.includes('@media screen and (max-width: 767px)'),
  'Mobile breakpoint media query (< 768px) is configured in index.css'
);
assert(
  indexCss.includes('font-size: 16px !important;'),
  '16px !important font-size enforcement is declared for mobile form controls'
);
assert(
  indexCss.includes('@supports (-webkit-touch-callout: none)'),
  'iOS WebKit touch devices are targeted via @supports (-webkit-touch-callout: none)'
);
assert(
  indexCss.includes(':not([type="checkbox"]):not([type="radio"])'),
  'Checkbox and radio buttons are preserved and excluded from 16px font-size rule'
);
assert(
  indexCss.includes(':not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="hidden"])'),
  'Non-text buttons and utility input types are excluded from 16px rule'
);

// 4. Component-Level Typography Protection
const inputTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ui/input.tsx'), 'utf8');
assert(
  inputTsx.includes('sanitizeInputClassName'),
  'Input component includes sanitizeInputClassName utility'
);
assert(
  inputTsx.includes('text-base'),
  'Input component defaults to text-base (16px) on mobile viewports'
);

const textareaTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ui/textarea.tsx'), 'utf8');
assert(
  textareaTsx.includes('sanitizeInputClassName'),
  'Textarea component utilizes sanitizeInputClassName utility'
);

const selectTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ui/select.tsx'), 'utf8');
assert(
  selectTsx.includes('sanitizeInputClassName'),
  'SelectTrigger utilizes sanitizeInputClassName utility'
);

// 5. Public Pages Audit
const homeTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Home.tsx'), 'utf8');
assert(
  homeTsx.includes('id="home-quick-repair-search-input"') && homeTsx.includes('text-base md:text-sm'),
  'Home.tsx quick repair search input uses text-base on mobile'
);

const servicesTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Services.tsx'), 'utf8');
assert(
  servicesTsx.includes('id="repair-catalog-search-input"') && servicesTsx.includes('text-base md:text-sm'),
  'Services.tsx catalog search input uses text-base on mobile'
);

const trackingTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Tracking.tsx'), 'utf8');
assert(
  trackingTsx.includes('text-base md:text-sm pl-3.5 focus-visible:ring-slate-900'),
  'Tracking.tsx repair number and phone inputs use text-base on mobile'
);

const contactTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Contact.tsx'), 'utf8');
assert(
  contactTsx.includes('id="contact-name"') && contactTsx.includes('text-base md:text-sm px-3.5 py-2.5'),
  'Contact.tsx name input uses text-base on mobile'
);
assert(
  contactTsx.includes('id="contact-phone"') && contactTsx.includes('text-base md:text-sm px-3.5 py-2.5'),
  'Contact.tsx phone input uses text-base on mobile'
);
assert(
  contactTsx.includes('id="contact-subject"') && contactTsx.includes('text-base md:text-sm px-3.5 py-2.5'),
  'Contact.tsx subject select uses text-base on mobile'
);
assert(
  contactTsx.includes('id="contact-message"') && contactTsx.includes('text-base md:text-sm p-3.5 rounded-lg'),
  'Contact.tsx message textarea uses text-base on mobile'
);

const loginTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Login.tsx'), 'utf8');
assert(
  loginTsx.includes('Work Email') && loginTsx.includes('text-base md:text-sm font-medium'),
  'Login.tsx email and password inputs use text-base on mobile'
);

// 6. Production Bundle Output Check
const distDir = path.resolve(process.cwd(), 'dist/assets');
if (fs.existsSync(distDir)) {
  const cssFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.css'));
  if (cssFiles.length > 0) {
    const cssContent = fs.readFileSync(path.join(distDir, cssFiles[0]), 'utf8');
    assert(
      cssContent.includes('16px'),
      'Compiled production CSS bundle contains 16px font-size rule'
    );
    assert(
      cssContent.includes('max-width:767px') || cssContent.includes('max-width: 767px'),
      'Compiled production CSS bundle contains mobile max-width media query'
    );
  } else {
    console.warn('No CSS bundle found in dist/assets to inspect.');
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('----------------------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mAll iPhone Input Auto-Zoom Verification Checks Passed Successfully!\x1b[0m\n');
}
