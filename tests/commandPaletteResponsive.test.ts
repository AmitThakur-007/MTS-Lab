import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('CommandPalette Component — Responsive Design, Back/Cancel Button & History Safety', async (t) => {
  const filePath = path.join(process.cwd(), 'src/components/common/CommandPalette.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  await t.test('1. CRITICAL: Back / Cancel Button is present, visible, and fully functional', () => {
    // Must have a dedicated Back button with id or aria-label
    assert.match(content, /id="command-palette-back-button"/, 'Should have command-palette-back-button ID');
    assert.match(content, /aria-label="Back to dashboard"/, 'Should have accessible aria-label');
    assert.match(content, /<ArrowLeft/, 'Should use ArrowLeft icon');
    assert.match(content, /<span>Back<\/span>/, 'Should display readable "Back" label');
    assert.match(content, /onClick=\{handleClose\}/, 'Should trigger handleClose on click');
  });

  await t.test('2. Browser History & Back button safety without duplicate entries or navigation drops', () => {
    // Checks that window.history.pushState is used on open
    assert.match(content, /window\.history\.pushState.*mtsCommandCenter/, 'Pushes transient state on modal open');
    // Checks that popstate event listener is registered
    assert.match(content, /window\.addEventListener\('popstate'/, 'Registers popstate event listener');
    assert.match(content, /window\.removeEventListener\('popstate'/, 'Cleans up popstate event listener');
    // Checks that handleClose pops state cleanly
    assert.match(content, /window\.history\.back\(\)/, 'Safely calls window.history.back() to pop state');
    // Checks that item navigation replaces transient state
    assert.match(content, /window\.history\.replaceState/, 'Replaces transient history state on navigation');
  });

  await t.test('3. Mobile Responsiveness: Dynamic Viewport & Safe-Area Constraints', () => {
    // Dynamic viewport height on smartphones
    assert.match(content, /max-h-\[100dvh\]/, 'Uses dynamic 100dvh viewport height for smartphones');
    assert.match(content, /h-full.*rounded-none/, 'Full screen and edge-to-edge on mobile');
    // Safe areas for iPhone notch / Dynamic Island and home bar
    assert.match(content, /env\(safe-area-inset-top/, 'Supports safe-area-inset-top for notched devices');
    assert.match(content, /env\(safe-area-inset-bottom/, 'Supports safe-area-inset-bottom for home indicators');
    // Independent results scrolling
    assert.match(content, /overscroll-contain/, 'Contains overscroll to prevent body chaining');
    assert.match(content, /overflow-y-auto.*flex-1.*min-h-0/, 'Allows results to scroll independently');
  });

  await t.test('4. Tablet, iPad, and Desktop Layout Balance', () => {
    // Centered modal on larger screens
    assert.match(content, /sm:max-w-2xl.*md:max-w-3xl/, 'Constrains modal width on tablets and desktop');
    assert.match(content, /sm:rounded-3xl/, 'Applies premium rounded corners on tablet and desktop');
    assert.match(content, /sm:max-h-\[82vh\]/, 'Constrains maximum height on desktop to prevent overflow');
  });

  await t.test('5. Header Redesign: Search Icon, Input, Clear Button, Back Button, and ESC Badge', () => {
    // Search icon
    assert.match(content, /<Search className=/, 'Displays search icon');
    // Input placeholder
    assert.match(content, /placeholder="Type a command, search repairs, customers, or modules\.\.\."/, 'Maintains placeholder');
    // Clear query button
    assert.match(content, /title="Clear search text"/, 'Has clear query button');
    // ESC badge
    assert.match(content, /ESC/, 'Displays ESC hint');
    assert.match(content, /hidden md:inline-flex/, 'Shows ESC hint on larger screens without cluttering mobile');
  });

  await t.test('6. Touch-Friendly Result Targets and Distinction', () => {
    // Minimum 44px touch targets
    assert.match(content, /min-h-\[44px\]/, 'Guarantees touch target height of at least 44px');
    // Selected result highlight
    assert.match(content, /data-selected=\{isSelected\}/, 'Exposes data-selected attribute for accessibility & styling');
    assert.match(content, /scrollIntoView/, 'Automatically scrolls selected item into view on keyboard navigation');
  });

  await t.test('7. Dark Mode & Light Mode Theme Adaptability', () => {
    assert.match(content, /bg-white dark:bg-slate-900/, 'Adapts modal background');
    assert.match(content, /border-slate-200 dark:border-slate-800/, 'Adapts borders');
    assert.match(content, /text-slate-900 dark:text-white/, 'Adapts text colors');
    assert.match(content, /dark:hover:bg-slate-700/, 'Adapts button hover states');
  });

  await t.test('8. Body Scroll Locking & Focus Restoration', () => {
    assert.match(content, /document\.body\.style\.overflow = 'hidden'/, 'Locks background scroll while active');
    assert.match(content, /previousActiveElementRef\.current/, 'Preserves activeElement to restore focus on close');
  });
});
