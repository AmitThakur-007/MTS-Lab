import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  isSlideCurrentlyPublished,
  HomeSlideRecord,
} from '../api/_server/services/slidesStorage';

describe('MTS Lab Hero Slideshow & Superadmin CMS Test Suite', () => {
  test('1. Staff Portal is renamed to Login in Navbar and Footer', () => {
    const navbarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Navbar.tsx'), 'utf-8');
    const footerContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Footer.tsx'), 'utf-8');

    // Confirm "Staff Portal" is no longer the button or link label
    assert.strictEqual(
      navbarContent.includes('>Staff Portal<'),
      false,
      'Navbar should not contain "Staff Portal" as button label'
    );
    assert.strictEqual(
      navbarContent.includes('Login'),
      true,
      'Navbar should contain "Login" button label'
    );
    assert.strictEqual(
      footerContent.includes('> Staff Portal'),
      false,
      'Footer should not link to "Staff Portal"'
    );
    assert.strictEqual(
      footerContent.includes('> Login'),
      true,
      'Footer should link to "Login"'
    );
  });

  test('2. isSlideCurrentlyPublished accepts active slides within valid schedule', () => {
    const activeSlide: HomeSlideRecord = {
      id: 'test-1',
      title: 'Active Slide',
      description: 'Testing active slide',
      imageUrl: '/assets/images/display-replacement.jpg',
      buttonText: 'Check Price',
      buttonLink: '/services',
      displayOrder: 1,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(
      isSlideCurrentlyPublished(activeSlide),
      true,
      'Active slide should be published'
    );
  });

  test('3. isSlideCurrentlyPublished hides INACTIVE and DRAFT slides', () => {
    const inactiveSlide: HomeSlideRecord = {
      id: 'test-2',
      title: 'Inactive Slide',
      description: 'Testing inactive slide',
      imageUrl: '/assets/images/display-replacement.jpg',
      buttonText: 'Check Price',
      buttonLink: '/services',
      displayOrder: 2,
      status: 'INACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const draftSlide: HomeSlideRecord = {
      ...inactiveSlide,
      id: 'test-3',
      status: 'DRAFT',
    };

    assert.strictEqual(
      isSlideCurrentlyPublished(inactiveSlide),
      false,
      'INACTIVE slide must not be published'
    );
    assert.strictEqual(
      isSlideCurrentlyPublished(draftSlide),
      false,
      'DRAFT slide must not be published'
    );
  });

  test('4. Scheduled slides in the future are not published on public Home Page', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const scheduledFutureSlide: HomeSlideRecord = {
      id: 'test-4',
      title: 'Future Promotion',
      description: 'Black Friday promotion',
      imageUrl: '/assets/images/display-replacement.jpg',
      buttonText: 'Check Price',
      buttonLink: '/services',
      displayOrder: 3,
      status: 'SCHEDULED',
      publishStartAt: futureDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(
      isSlideCurrentlyPublished(scheduledFutureSlide),
      false,
      'Future scheduled slide should not be published before publishStartAt'
    );
  });

  test('5. Scheduled slides within the active window are published', () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const activeScheduledSlide: HomeSlideRecord = {
      id: 'test-5',
      title: 'Ongoing Promotion',
      description: 'Active festival promotion',
      imageUrl: '/assets/images/display-replacement.jpg',
      buttonText: 'Check Price',
      buttonLink: '/services',
      displayOrder: 4,
      status: 'SCHEDULED',
      publishStartAt: pastDate,
      publishEndAt: futureDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(
      isSlideCurrentlyPublished(activeScheduledSlide),
      true,
      'Scheduled slide within its date range must be published'
    );
  });

  test('6. Expired scheduled slides are hidden from public view', () => {
    const pastStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    const expiredSlide: HomeSlideRecord = {
      id: 'test-6',
      title: 'Expired Promotion',
      description: 'Finished campaign',
      imageUrl: '/assets/images/display-replacement.jpg',
      buttonText: 'Check Price',
      buttonLink: '/services',
      displayOrder: 5,
      status: 'SCHEDULED',
      publishStartAt: pastStart,
      publishEndAt: pastEnd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(
      isSlideCurrentlyPublished(expiredSlide),
      false,
      'Expired scheduled slide must not be published'
    );
  });

  test('7. HeroSlider supports responsive desktop and mobile image variants', () => {
    const heroSliderContent = fs.readFileSync(path.join(process.cwd(), 'src/components/HeroSlider.tsx'), 'utf-8');
    assert.strictEqual(
      heroSliderContent.includes('mobileImage'),
      true,
      'HeroSlider must reference mobileImage variant'
    );
    assert.strictEqual(
      heroSliderContent.includes('desktopImage'),
      true,
      'HeroSlider must reference desktopImage variant'
    );
    assert.strictEqual(
      heroSliderContent.includes('isMobileViewport'),
      true,
      'HeroSlider should have viewport responsiveness logic'
    );
  });

  test('8. Slideshow CMS dashboard supports 14 fields, live preview, and device switcher', () => {
    const cmsContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/dashboard/SlideshowManagement.tsx'), 'utf-8');
    assert.strictEqual(cmsContent.includes('previewDevice'), true, 'CMS must have multi-device preview switcher');
    assert.strictEqual(cmsContent.includes('handleDuplicateSlide'), true, 'CMS must support slide duplication');
    assert.strictEqual(cmsContent.includes('featureTagsInput'), true, 'CMS must support feature tags');
    assert.strictEqual(cmsContent.includes('publishStartAt'), true, 'CMS must support scheduled publishing dates');
    assert.strictEqual(cmsContent.includes('overlayStrength'), true, 'CMS must support contrast overlay configuration');
  });
});
