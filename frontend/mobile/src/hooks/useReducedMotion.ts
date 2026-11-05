import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to detect if the user has requested reduced motion in system accessibility settings.
 * Ensures young learners with vestibular or motion sensitivities have a gentle, comfortable experience.
 */
export const useReducedMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        // Fallback gracefully on environments where AccessibilityInfo is unmocked
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      }
    );

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  return reduceMotion;
};
