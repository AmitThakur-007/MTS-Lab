import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Performance Optimization: Ensure touchstart and touchmove event listeners
// default to { passive: true } when passive is unspecified, preventing scroll-blocking
// violations in Google Chrome and ensuring maximum scroll responsiveness across devices.
if (typeof window !== 'undefined' && typeof EventTarget !== 'undefined') {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const passiveEvents = new Set(['touchstart', 'touchmove']);

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    let modOptions = options;
    if (passiveEvents.has(type)) {
      if (typeof modOptions === 'boolean') {
        modOptions = { capture: modOptions, passive: true };
      } else if (typeof modOptions === 'object' && modOptions !== null) {
        if (modOptions.passive === undefined) {
          modOptions = { ...modOptions, passive: true };
        }
      } else if (modOptions === undefined) {
        modOptions = { passive: true };
      }
    }
    return originalAddEventListener.call(this, type, listener, modOptions as AddEventListenerOptions);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

