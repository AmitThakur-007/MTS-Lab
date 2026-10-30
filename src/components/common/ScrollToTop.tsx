import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// In-memory scroll position map for seamless Back/Forward navigation restoration
const scrollPositionMap = new Map<string, number>();

/**
 * ScrollToTop ensures that navigating to new pages (PUSH) resets scroll to top,
 * while Back/Forward navigation (POP) preserves and restores the previous scroll position seamlessly.
 */
export default function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  const currentKey = location.pathname + location.search;
  const prevKeyRef = useRef<string>(currentKey);

  // Continuously track scroll position of the current page
  useEffect(() => {
    const handleScroll = () => {
      scrollPositionMap.set(currentKey, window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentKey]);

  useEffect(() => {
    if (navType === 'POP') {
      // Back or Forward button pressed: restore saved scroll position
      const savedY = scrollPositionMap.get(currentKey);
      if (typeof savedY === 'number') {
        requestAnimationFrame(() => {
          window.scrollTo({
            top: savedY,
            left: 0,
            behavior: 'instant' as ScrollBehavior,
          });
        });
      }
    } else if (navType === 'PUSH') {
      // Fresh navigation: reset scroll to top
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior,
      });
    }

    prevKeyRef.current = currentKey;
  }, [currentKey, navType]);

  return null;
}
