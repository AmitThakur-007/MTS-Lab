import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Public UI pages and layout components that must have dark mode classes
const PUBLIC_UI_FILES = [
  'src/components/Navbar.tsx',
  'src/components/Footer.tsx',
  'src/components/common/ThemeToggle.tsx',
  'src/pages/Home.tsx',
  'src/pages/Services.tsx',
  'src/pages/Shop.tsx',
  'src/pages/Tracking.tsx',
  'src/pages/Contact.tsx',
  'src/pages/About.tsx',
  'src/pages/ServiceDetail.tsx',
  'src/pages/Terms.tsx',
  'src/pages/Privacy.tsx',
  'src/pages/NotFound.tsx',
];

test('Theme System Architecture & CSS Configuration', () => {
  const cssPath = path.resolve(process.cwd(), 'src/index.css');
  assert.ok(fs.existsSync(cssPath), 'src/index.css must exist');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Must declare custom dark variant for Tailwind v4
  assert.ok(
    cssContent.includes('@custom-variant dark (&:where(.dark, .dark *));'),
    'src/index.css must declare custom dark variant'
  );

  // Must declare semantic dark CSS variables
  assert.ok(
    cssContent.includes('.dark {') || cssContent.includes('.dark'),
    'src/index.css must contain .dark block with CSS variables'
  );
  assert.ok(cssContent.includes('--background:'), 'src/index.css must define --background');
  assert.ok(cssContent.includes('--foreground:'), 'src/index.css must define --foreground');
});

test('ThemeContext & Real-Time Listener', () => {
  const contextPath = path.resolve(process.cwd(), 'src/context/ThemeContext.tsx');
  assert.ok(fs.existsSync(contextPath), 'src/context/ThemeContext.tsx must exist');
  const contextContent = fs.readFileSync(contextPath, 'utf8');

  // Must support 'light' | 'dark' | 'system'
  assert.ok(contextContent.includes("'light'"), 'Must support light theme');
  assert.ok(contextContent.includes("'dark'"), 'Must support dark theme');
  assert.ok(contextContent.includes("'system'"), 'Must support system theme');

  // Must store in localStorage under MTSLAB_THEME_PREFERENCE_STORAGE_KEY
  assert.ok(
    contextContent.includes('mtslab-theme-preference'),
    'Must persist theme selection in localStorage under mtslab-theme-preference key'
  );

  // Must apply .dark class to root element
  assert.ok(
    contextContent.includes("root.classList.add('dark')") || contextContent.includes("root.classList.add('dark'"),
    'Must add .dark class when dark mode is enabled'
  );

  // Must listen to prefers-color-scheme media query
  assert.ok(
    contextContent.includes('prefers-color-scheme: dark'),
    'Must attach mediaQuery listener for system theme preference changes'
  );

  // Must export useAppTheme and useTheme hook aliases
  assert.ok(contextContent.includes('export function useAppTheme'), 'Must export useAppTheme');
  assert.ok(contextContent.includes('export const useTheme'), 'Must export useTheme alias');
});

test('ThemeToggle Component Integration', () => {
  const togglePath = path.resolve(process.cwd(), 'src/components/common/ThemeToggle.tsx');
  assert.ok(fs.existsSync(togglePath), 'src/components/common/ThemeToggle.tsx must exist');
  const toggleContent = fs.readFileSync(togglePath, 'utf8');

  // Accessible attributes
  assert.ok(toggleContent.includes('aria-label'), 'ThemeToggle must include aria-label');
  assert.ok(
    toggleContent.includes('useAppTheme') || toggleContent.includes('useTheme'),
    'ThemeToggle must consume theme hook'
  );

  // Verify Navbar integrates ThemeToggle
  const navbarContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Navbar.tsx'), 'utf8');
  assert.ok(
    navbarContent.includes('ThemeToggle'),
    'Navbar must import and render ThemeToggle'
  );

  // Verify Footer integrates ThemeToggle
  const footerContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Footer.tsx'), 'utf8');
  assert.ok(
    footerContent.includes('ThemeToggle'),
    'Footer must import and render ThemeToggle'
  );
});

test('Public Pages Dark Mode Coverage Audit', () => {
  for (const relPath of PUBLIC_UI_FILES) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Count occurrences of dark: classes
    const darkOccurrences = (content.match(/dark:/g) || []).length;
    assert.ok(
      darkOccurrences >= 3,
      `Expected ${relPath} to have comprehensive dark: classes (found ${darkOccurrences})`
    );

    // Verify key slate surface variants are used in pages
    if (relPath.includes('src/pages/')) {
      const hasDarkSurface =
        content.includes('dark:bg-slate-900') ||
        content.includes('dark:bg-slate-950') ||
        content.includes('dark:bg-slate-800');
      assert.ok(
        hasDarkSurface,
        `${relPath} should contain dark background surfaces (dark:bg-slate-900 / dark:bg-slate-950)`
      );

      const hasDarkText =
        content.includes('dark:text-white') ||
        content.includes('dark:text-slate-100') ||
        content.includes('dark:text-slate-200') ||
        content.includes('dark:text-slate-300');
      assert.ok(
        hasDarkText,
        `${relPath} should contain high-contrast dark text classes`
      );
    }
  }
});

test('MTS Lab Official Brand & Contact Information Integrity', () => {
  const contactContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Contact.tsx'), 'utf8');
  const servicesContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Services.tsx'), 'utf8');

  // Primary mobile phone
  assert.ok(contactContent.includes('9869276668'), 'Contact page must preserve 9869276668 hotline');
  assert.ok(servicesContent.includes('9869276668'), 'Services page must preserve 9869276668 phone');

  // Landline
  assert.ok(contactContent.includes('015364307'), 'Contact page must preserve 015364307 landline');
  assert.ok(servicesContent.includes('015364307'), 'Services page must preserve 015364307 landline');

  // Location
  assert.ok(contactContent.includes('New Road'), 'Contact page must preserve New Road location');
});
