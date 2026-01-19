/**
 * Layout Debug Utility - DEV ONLY
 *
 * Prints layout metrics to console for debugging scroll issues.
 * Only active in development mode.
 *
 * Usage in any component:
 *   import { debugLayout } from '@/utils/dev/layoutDebug'
 *   onMounted(() => debugLayout('SettingsView'))
 *
 * Or from browser console:
 *   window.__debugLayout?.()
 */

const isDev = import.meta.env.DEV;

interface LayoutMetrics {
  viewport: { width: number; height: number };
  app: { height: string; overflow: string } | null;
  shell: { height: string; overflow: string; minHeight: string } | null;
  content: {
    clientHeight: number;
    scrollHeight: number;
    overflow: string;
    canScroll: boolean;
  } | null;
}

/**
 * Collects layout metrics from the DOM
 */
function collectMetrics(): LayoutMetrics {
  const app = document.querySelector('.app-root') as HTMLElement | null;
  const shell = document.querySelector('.screen-shell') as HTMLElement | null;
  const content = document.querySelector('.screen-content') as HTMLElement | null;

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    app: app
      ? {
          height: getComputedStyle(app).height,
          overflow: getComputedStyle(app).overflow,
        }
      : null,
    shell: shell
      ? {
          height: getComputedStyle(shell).height,
          overflow: getComputedStyle(shell).overflow,
          minHeight: getComputedStyle(shell).minHeight,
        }
      : null,
    content: content
      ? {
          clientHeight: content.clientHeight,
          scrollHeight: content.scrollHeight,
          overflow: getComputedStyle(content).overflowY,
          canScroll: content.scrollHeight > content.clientHeight,
        }
      : null,
  };
}

/**
 * Prints layout debug info to console
 */
export function debugLayout(context: string = 'Unknown'): void {
  if (!isDev) return;

  const metrics = collectMetrics();

  console.group(`🔍 Layout Debug: ${context}`);
  console.log('Viewport:', `${metrics.viewport.width}x${metrics.viewport.height}`);

  if (metrics.app) {
    console.log('App Root:', metrics.app);
  } else {
    console.warn('App Root: NOT FOUND');
  }

  if (metrics.shell) {
    console.log('Screen Shell:', metrics.shell);
  } else {
    console.warn('Screen Shell: NOT FOUND');
  }

  if (metrics.content) {
    const { clientHeight, scrollHeight, overflow, canScroll } = metrics.content;
    console.log('Screen Content:', {
      clientHeight,
      scrollHeight,
      overflow,
      canScroll,
      scrollNeeded: scrollHeight - clientHeight,
    });

    if (!canScroll && scrollHeight > clientHeight) {
      console.error('⚠️ SCROLL ISSUE: Content overflows but cannot scroll!');
    }
  } else {
    console.warn('Screen Content: NOT FOUND');
  }

  console.groupEnd();
}

/**
 * Expose to window for console access in dev mode
 */
if (isDev && typeof window !== 'undefined') {
  (window as unknown as { __debugLayout: typeof debugLayout }).__debugLayout = debugLayout;
}

export default debugLayout;
