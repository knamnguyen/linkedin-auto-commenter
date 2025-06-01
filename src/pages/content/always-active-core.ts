// Always Active Core - TypeScript version for easy integration
// This script spoofs browser visibility and focus states to keep tabs "active"

// Type definitions
type VisibilityState = 'visible' | 'hidden' | 'prerender';

interface AlwaysActiveConfig {
  enabled: boolean;
  spoofVisibility: boolean;
  spoofFocus: boolean;
  blockBlur: boolean;
  blockMouseLeave: boolean;
  keepAnimations: boolean;
}

interface AlwaysActiveAPI {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  configure: (newConfig: Partial<AlwaysActiveConfig>) => void;
  getConfig: () => AlwaysActiveConfig;
}

// Extend Document interface for webkit properties
interface Document {
  webkitVisibilityState?: VisibilityState;
  webkitHidden?: boolean;
}

// Extend Window interface
interface Window {
  alwaysActive: AlwaysActiveAPI;
}

(function(): void {
  'use strict';
  
  // Configuration - you can modify these to enable/disable specific features
  const config: AlwaysActiveConfig = {
    enabled: true,
    spoofVisibility: true,
    spoofFocus: true,
    blockBlur: true,
    blockMouseLeave: true,
    keepAnimations: true
  };

  // Helper function to block events
  const blockEvent = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // 1. SPOOF VISIBILITY STATE
  if (config.spoofVisibility) {
    // Override document.visibilityState to always return 'visible'
    Object.defineProperty(document, 'visibilityState', {
      get(): VisibilityState { return 'visible'; },
      configurable: true
    });

    // Override document.hidden to always return false
    Object.defineProperty(document, 'hidden', {
      get(): boolean { return false; },
      configurable: true
    });

    // Webkit-specific properties for Chromium browsers
    Object.defineProperty(document, 'webkitVisibilityState', {
      get(): VisibilityState { return 'visible'; },
      configurable: true
    });

    Object.defineProperty(document, 'webkitHidden', {
      get(): boolean { return false; },
      configurable: true
    });

    // Block visibility change events
    let firstVisibilityChange: boolean = true;
    document.addEventListener('visibilitychange', (e: Event): void => {
      if (config.enabled) {
        if (firstVisibilityChange) {
          firstVisibilityChange = false;
          return; // Allow the first event to pass through
        }
        blockEvent(e);
      }
    }, true);

    document.addEventListener('webkitvisibilitychange', (e: Event): void => {
      if (config.enabled) blockEvent(e);
    }, true);

    // Block page hide events
    window.addEventListener('pagehide', (e: PageTransitionEvent): void => {
      if (config.enabled) blockEvent(e);
    }, true);
  }

  // 2. SPOOF FOCUS STATE
  if (config.spoofFocus) {
    // Override document.hasFocus() to always return true
    Document.prototype.hasFocus = new Proxy(Document.prototype.hasFocus, {
      apply(target: () => boolean, self: Document, args: unknown[]): boolean {
        if (config.enabled) return true;
        return Reflect.apply(target, self, args);
      }
    });

    // Block focus events (except the first one)
    let firstFocus: boolean = true;
    const handleFocus = (e: FocusEvent): void => {
      if (config.enabled && (e.target === document || e.target === window)) {
        if (firstFocus) {
          firstFocus = false;
          return;
        }
        blockEvent(e);
      }
    };
    document.addEventListener('focus', handleFocus, true);
    window.addEventListener('focus', handleFocus, true);
  }

  // 3. BLOCK BLUR EVENTS
  if (config.blockBlur) {
    const handleBlur = (e: FocusEvent): void => {
      if (config.enabled && (e.target === document || e.target === window)) {
        blockEvent(e);
      }
    };
    document.addEventListener('blur', handleBlur, true);
    window.addEventListener('blur', handleBlur, true);
  }

  // 4. BLOCK MOUSE LEAVE EVENTS
  if (config.blockMouseLeave) {
    window.addEventListener('mouseleave', (e: MouseEvent): void => {
      if (config.enabled && (e.target === document || e.target === window)) {
        blockEvent(e);
      }
    }, true);

    window.addEventListener('mouseout', (e: MouseEvent): void => {
      if (config.enabled && (e.target === document.documentElement || e.target === document.body)) {
        blockEvent(e);
      }
    }, true);
  }

  // 5. KEEP ANIMATIONS RUNNING
  if (config.keepAnimations) {
    let lastTime: number = 0;
    
    // Override requestAnimationFrame to keep running even when tab is "hidden"
    window.requestAnimationFrame = new Proxy(window.requestAnimationFrame, {
      apply(
        target: (callback: FrameRequestCallback) => number,
        self: Window,
        args: [FrameRequestCallback]
      ): number {
        if (config.enabled && document.hidden) {
          // Simulate 60fps when tab would normally be throttled
          const currTime: number = Date.now();
          const timeToCall: number = Math.max(0, 16 - (currTime - lastTime));
          const id: number = setTimeout((): void => {
            args[0](performance.now());
          }, timeToCall) as unknown as number;
          lastTime = currTime + timeToCall;
          return id;
        }
        return Reflect.apply(target, self, args);
      }
    });

    // Override cancelAnimationFrame to work with our custom implementation
    window.cancelAnimationFrame = new Proxy(window.cancelAnimationFrame, {
      apply(
        target: (handle: number) => void,
        self: Window,
        args: [number]
      ): void {
        if (config.enabled && document.hidden) {
          clearTimeout(args[0]);
          return;
        }
        return Reflect.apply(target, self, args);
      }
    });
  }

  // 6. UTILITY FUNCTIONS FOR YOUR EXTENSION
  
  // Function to enable/disable the always-active functionality
  (window as Window).alwaysActive = {
    enable: (): void => { 
      config.enabled = true; 
    },
    
    disable: (): void => { 
      config.enabled = false; 
    },
    
    isEnabled: (): boolean => config.enabled,
    
    // Configure specific features
    configure: (newConfig: Partial<AlwaysActiveConfig>): void => {
      Object.assign(config, newConfig);
    },
    
    // Get current configuration
    getConfig: (): AlwaysActiveConfig => ({ ...config })
  };

  console.log('Always Active Core loaded - Tab will appear active even when in background');
})(); 