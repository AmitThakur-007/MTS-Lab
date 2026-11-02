import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// Test Suite: MTS Lab Premium WhatsApp Live Chat Widget Architecture, Responsive Sizing & Security
// Validates all requirements specified in Master Prompt

test('1. Official WhatsApp Business phone number and Click-to-Chat URL format', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  assert.ok(fs.existsSync(widgetPath), 'WhatsAppChatWidget.tsx must exist');

  const content = fs.readFileSync(widgetPath, 'utf-8');

  // Official WhatsApp Number: +977 9869276668 / wa.me/9779869276668
  assert.ok(content.includes("MTS_WHATSAPP_PHONE = '9779869276668'"), 'Defines correct WhatsApp phone constant');
  assert.ok(content.includes("https://wa.me/${MTS_WHATSAPP_PHONE}"), 'Constructs wa.me URL targeting 9779869276668');
  assert.ok(content.includes('+977 9869276668'), 'Defines display phone number');
});

test('2. Welcome message exact text and header copy', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  const expectedWelcome =
    'Namaste! Welcome to MTS LAB. Need help with your smartphone repair? Send us a message and our team will assist you.';
  assert.ok(content.includes(expectedWelcome), 'Contains exact requested welcome message');

  assert.ok(content.includes('Welcome to MTS LAB!'), 'Header displays "Welcome to MTS LAB!"');
  assert.ok(content.includes('How can we help you today?'), 'Header displays "How can we help you today?"');
  assert.ok(content.includes('aria-label="Close WhatsApp chat"'), 'Close button has accessible aria-label');
});

test('3. Genuine business hours support availability (no fake online status)', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  // Must import genuine business hours logic from businessHours.ts
  assert.ok(content.includes('getMtsLabOpenStatus'), 'Consumes getMtsLabOpenStatus for genuine live status');
  assert.ok(content.includes('OPERATING_HOURS'), 'References OPERATING_HOURS');
  assert.ok(!content.includes('fake') && !content.includes('Always Online'), 'Does not use fake status');
});

test('4. All 7 Predefined Quick Inquiry Templates match exact specifications', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  const templates = [
    { label: 'iPhone Repair', text: 'Namaste MTS LAB, I need help with iPhone repair. Please provide details.' },
    { label: 'Samsung Repair', text: 'Namaste MTS LAB, I need help with Samsung smartphone repair. Please provide details.' },
    { label: 'Display Replacement', text: 'Namaste MTS LAB, I need a display replacement. Please share the available options and price.' },
    { label: 'Battery Replacement', text: 'Namaste MTS LAB, I need a smartphone battery replacement. Please provide details.' },
    { label: 'Back Panel Replacement', text: 'Namaste MTS LAB, I need a back panel replacement. Please provide details.' },
    { label: 'Repair Status', text: 'Namaste MTS LAB, I would like to check my repair status. My repair number is: ' },
    { label: 'Other Inquiry', text: 'Namaste MTS LAB, I have an inquiry: ' },
  ];

  for (const item of templates) {
    assert.ok(content.includes(item.label), `Includes quick inquiry label: ${item.label}`);
    assert.ok(content.includes(item.text), `Includes exact template: ${item.text}`);
  }
});

test('5. Customer Message input, character limiter, and empty validation handling', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  assert.ok(content.includes('MAX_MESSAGE_LENGTH = 500'), 'Enforces 500 character upper limit');
  assert.ok(content.includes('cleanMessage = message.trim()'), 'Trims whitespace before validation');
  assert.ok(content.includes('setValidationError'), 'Displays inline validation error on empty message');
  assert.ok(content.includes('role="alert"'), 'Accessible alert role on validation container');
  assert.ok(content.includes('textarea'), 'Renders multiline textarea');
});

test('6. Unicode and URL encoding for English and Nepali text', () => {
  const nepaliSample = 'नमस्ते MTS LAB, मेरो Samsung फोनको स्क्रिन फेर्नु पर्नेछ। मूल्य कति पर्छ?';
  const encoded = encodeURIComponent(nepaliSample);
  assert.ok(encoded.includes('%E0%A4%A8'), 'Successfully encodes Devanagari characters');

  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');
  assert.ok(content.includes('encodeURIComponent(cleanMessage)'), 'Uses encodeURIComponent on cleaned customer text');
  assert.ok(content.includes("window.open(whatsappUrl, '_blank'"), 'Opens WhatsApp in a new tab');
  assert.ok(content.includes("'noopener,noreferrer'"), 'Includes security rel flags');
});

test('7. Responsive Layout targets and 3-tier internal flex architecture', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  // Flex column and min-h-0 container
  assert.ok(content.includes('flex flex-col min-h-0 overflow-hidden'), 'Outer container is flex-col with min-h-0 overflow-hidden');

  // Section A: Header flex-none
  assert.ok(content.includes('flex-none bg-slate-950'), 'Header is flex-none');

  // Section B: Body flex-1 min-h-0 overflow-y-auto
  assert.ok(content.includes('flex-1 min-h-0 overflow-y-auto'), 'Body is flex-1 min-h-0 with internal scroll only');

  // Section C: Footer flex-none
  assert.ok(content.includes('flex-none p-3.5'), 'Footer is flex-none');

  // Mobile and Laptop clamped dimensions (avoids full-screen blowout)
  assert.ok(content.includes('sm:w-[380px]'), 'Desktop width target 380px');
  assert.ok(content.includes('calc(100dvh-40px)'), 'Desktop max-height bounded by 100dvh');
  assert.ok(content.includes('calc(100vw-24px)'), 'Mobile width clamped with 24px viewport margin');
  assert.ok(content.includes('calc(100dvh-80px)'), 'Mobile height clamped with space from screen top');
  assert.ok(content.includes('safe-area-inset-bottom'), 'Respects safe-area-inset-bottom');
});

test('8. Floating trigger button hides when chat is open to avoid overlapping', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  assert.ok(content.includes('!isOpen &&'), 'Floating button only renders when chat is not open');
  assert.ok(content.includes('Chat with MTS LAB'), 'Floating button tooltip label');
  assert.ok(content.includes('aria-expanded={isOpen}'), 'Accessible aria-expanded attribute on trigger');
});

test('9. Public layout integration and strict dashboard exclusion', () => {
  const appPath = path.join(projectRoot, 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  assert.ok(appContent.includes('WhatsAppChatWidget'), 'App.tsx imports and renders WhatsAppChatWidget');

  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const widgetContent = fs.readFileSync(widgetPath, 'utf-8');
  assert.ok(
    widgetContent.includes("location.pathname.startsWith('/dashboard')"),
    'Widget strictly hides on dashboard routes'
  );
});

test('10. Dark Mode & Light Mode support without hardcoded color clashes', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  assert.ok(content.includes('useAppTheme'), 'Consumes MTS Lab global ThemeContext');
  assert.ok(content.includes('dark:bg-[#0c1322]'), 'Includes custom dark theme background');
  assert.ok(content.includes('dark:text-slate-100'), 'Includes light text for dark mode');
  assert.ok(content.includes('bg-[#25D366]'), 'Preserves official WhatsApp green brand color on CTA');
});

test('11. Keyboard navigation (Escape closes widget)', () => {
  const widgetPath = path.join(projectRoot, 'src/components/common/WhatsAppChatWidget.tsx');
  const content = fs.readFileSync(widgetPath, 'utf-8');

  assert.ok(content.includes("e.key === 'Escape'"), 'Closes widget on Escape key press');
});
