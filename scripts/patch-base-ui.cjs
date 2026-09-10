/**
 * Patch @base-ui/react to ensure touchstart and touchmove event listeners
 * added by useDismiss use { passive: true } instead of non-passive listeners.
 * This permanently eliminates Chrome [Violation] warnings about scroll-blocking touchstart events.
 */
const fs = require('fs');
const path = require('path');

const targetFiles = [
  'node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.mjs',
  'node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.js',
  'node_modules/@base-ui/react/number-field/scrub-area/NumberFieldScrubArea.mjs',
  'node_modules/@base-ui/react/number-field/scrub-area/NumberFieldScrubArea.js'
];

let totalPatched = 0;

targetFiles.forEach(relPath => {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Patch useDismiss addTargetEventListenerOnce
  if (filePath.includes('useDismiss')) {
    // ESM version
    const oldEsm = `function addTargetEventListenerOnce(event, listener) {
      const target = getTarget(event);
      if (!target) {
        return;
      }
      const unsubscribe = addEventListener(target, event.type, () => {
        listener(event);
        unsubscribe();
      });
    }`;
    const newEsm = `function addTargetEventListenerOnce(event, listener) {
      const target = getTarget(event);
      if (!target) {
        return;
      }
      const isTouch = event.type === 'touchstart' || event.type === 'touchmove';
      const unsubscribe = addEventListener(target, event.type, () => {
        listener(event);
        unsubscribe();
      }, isTouch ? { passive: true } : undefined);
    }`;

    // CJS version
    const oldCjs = `function addTargetEventListenerOnce(event, listener) {
      const target = (0, _element.getTarget)(event);
      if (!target) {
        return;
      }
      const unsubscribe = (0, _addEventListener.addEventListener)(target, event.type, () => {
        listener(event);
        unsubscribe();
      });
    }`;
    const newCjs = `function addTargetEventListenerOnce(event, listener) {
      const target = (0, _element.getTarget)(event);
      if (!target) {
        return;
      }
      const isTouch = event.type === 'touchstart' || event.type === 'touchmove';
      const unsubscribe = (0, _addEventListener.addEventListener)(target, event.type, () => {
        listener(event);
        unsubscribe();
      }, isTouch ? { passive: true } : undefined);
    }`;

    if (content.includes(oldEsm)) {
      content = content.replace(oldEsm, newEsm);
      modified = true;
    } else if (content.includes(oldCjs)) {
      content = content.replace(oldCjs, newCjs);
      modified = true;
    }
  }

  // 2. Patch NumberFieldScrubArea touchstart listener if present
  if (filePath.includes('NumberFieldScrubArea')) {
    const oldEsm = "addEventListener(element, 'touchstart', handleTouchStart);";
    const newEsm = "addEventListener(element, 'touchstart', handleTouchStart, { passive: true });";
    const oldCjs = "(0, _addEventListener.addEventListener)(element, 'touchstart', handleTouchStart);";
    const newCjs = "(0, _addEventListener.addEventListener)(element, 'touchstart', handleTouchStart, { passive: true });";

    if (content.includes(oldEsm)) {
      content = content.replace(oldEsm, newEsm);
      modified = true;
    } else if (content.includes(oldCjs)) {
      content = content.replace(oldCjs, newCjs);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalPatched++;
    console.log(`[patch-base-ui] Successfully patched ${relPath}`);
  }
});

console.log(`[patch-base-ui] Done. Patched ${totalPatched} file(s).`);
