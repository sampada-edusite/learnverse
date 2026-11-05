import { Platform } from 'react-native';

export const isFullscreenSupported = (): boolean => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }
  return !!(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );
};

export const isFullscreenActive = (): boolean => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};

export const toggleFullscreen = async (): Promise<boolean> => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }

  try {
    if (!isFullscreenActive()) {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      return true;
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      return false;
    }
  } catch (e) {
    console.warn('Fullscreen toggle not permitted or failed:', e);
    return isFullscreenActive();
  }
};
