'use client';
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import { startNavigation, completeNavigation, cancelNavigation, setCurrentUrl } from '@/store/slices/navigationSlice';

// Global navigation manager instance
let navigationManager = null;

class NavigationDetectionManager {
  constructor(dispatch, router) {
    this.dispatch = dispatch;
    this.router = router;
    this.isInitialized = false;
    this.originalRouterMethods = {};
    this.loadingActive = false;
    this.currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    this.lastNavigationType = null; // Track navigation type for better timing
    this.navigationStartTime = null;
    
    // Bind methods to preserve context
    this.handleLinkClick = this.handleLinkClick.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handlePopState = this.handlePopState.bind(this);
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    
    this.interceptRouterMethods();
    this.setupLinkClickDetection();
    this.setupCompletionDetection();
    this.isInitialized = true;
    
    console.log('🚀 Navigation Detection Manager initialized');
  }

  // Layer 1: Programmatic Navigation Detection
  interceptRouterMethods() {
    if (!this.router) return;

    // Store original methods
    this.originalRouterMethods = {
      push: this.router.push.bind(this.router),
      replace: this.router.replace.bind(this.router),
      back: this.router.back.bind(this.router),
      forward: this.router.forward.bind(this.router),
      refresh: this.router.refresh.bind(this.router)
    };

    // Override router.push
    this.router.push = (href, options) => {
      console.log('🔗 Router.push detected:', href);
      this.startNavigationInstantly({ url: href, method: 'push' });
      return this.originalRouterMethods.push(href, options);
    };

    // Override router.replace
    this.router.replace = (href, options) => {
      console.log('🔄 Router.replace detected:', href);
      this.startNavigationInstantly({ url: href, method: 'replace' });
      return this.originalRouterMethods.replace(href, options);
    };

    // Override router.back
    this.router.back = () => {
      console.log('⬅️ Router.back detected');
      this.startNavigationInstantly({ method: 'back' });
      return this.originalRouterMethods.back();
    };

    // Override router.forward
    this.router.forward = () => {
      console.log('➡️ Router.forward detected');
      this.startNavigationInstantly({ method: 'forward' });
      return this.originalRouterMethods.forward();
    };

    // Override router.refresh
    this.router.refresh = () => {
      console.log('🔃 Router.refresh detected');
      this.startNavigationInstantly({ method: 'refresh' });
      return this.originalRouterMethods.refresh();
    };
  }

  // Layer 2: Link Click Detection
  setupLinkClickDetection() {
    // High priority capture phase to catch clicks before any other handlers
    document.addEventListener('click', this.handleLinkClick, { 
      capture: true, 
      passive: false 
    });
  }

  handleLinkClick(event) {
    // Find the closest anchor element
    let target = event.target;
    while (target && target !== document) {
      if (target.tagName === 'A') break;
      target = target.parentElement;
    }

    if (!target || target.tagName !== 'A') return;

    const href = target.getAttribute('href');
    const targetAttr = target.getAttribute('target');
    const noLoading = target.hasAttribute('data-no-loading') || 
                     target.closest('[data-no-loading]');

    // Skip if developer opted out
    if (noLoading) return;

    // Skip if no href
    if (!href) return;

    // Skip anchors (same page)
    if (href.startsWith('#')) return;

    // Skip mailto/tel links
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

    // Skip external links
    if (href.startsWith('http') && !href.startsWith(window.location.origin)) return;

    // Skip if target="_blank" or similar
    if (targetAttr && targetAttr !== '_self') return;

    // Skip if modifier keys are pressed
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    // Skip if same URL
    const currentPath = window.location.pathname + window.location.search;
    const linkPath = href.startsWith('/') ? href : new URL(href, window.location.origin).pathname + new URL(href, window.location.origin).search;
    if (linkPath === currentPath) return;

    // This is a valid navigation link - start loading immediately
    console.log('🖱️ Navigation link clicked:', href);
    this.startNavigationInstantly({ url: href, method: 'link-click' });
  }

  // Layer 3: Completion & Cleanup Detection
  setupCompletionDetection() {
    // Browser back/forward detection with proper timing
    window.addEventListener('popstate', this.handlePopState);
    
    // Page unload detection (for full reloads)
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    
    // Visibility change (for when user navigates away)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.loadingActive) {
        console.log('👁️ Page hidden - completing navigation');
        this.completeNavigationInstantly();
      }
    });
  }

  handlePopState(event) {
    console.log('⬅️➡️ PopState detected (back/forward)');
    
    // For browser navigation, start loading immediately
    this.startNavigationInstantly({ method: 'popstate' });
    
    // Browser navigation needs a bit more time to complete
    // We'll let the pathname change detection handle completion
  }

  handleBeforeUnload() {
    if (this.loadingActive) {
      console.log('🚪 Page unloading - completing navigation');
      this.completeNavigationInstantly();
    }
  }

  // Core methods
  startNavigationInstantly(details = {}) {
    // Prevent double triggers
    if (this.loadingActive) {
      console.log('⚠️ Navigation already active, skipping...', details);
      return;
    }

    this.loadingActive = true;
    this.lastNavigationType = details.method;
    this.navigationStartTime = Date.now();
    console.log('🚀 Starting navigation instantly:', details);
    
    this.dispatch(startNavigation({
      url: details.url,
      method: details.method,
      timestamp: this.navigationStartTime
    }));

    // Adjust safety timeout based on navigation type
    const timeoutDuration = details.method === 'popstate' ? 3000 : 8000; // Shorter for browser nav
    setTimeout(() => {
      if (this.loadingActive) {
        console.warn(`⏰ Navigation safety timeout (${timeoutDuration}ms) triggered - auto-completing`);
        this.completeNavigationInstantly();
      }
    }, timeoutDuration);
  }

  completeNavigationInstantly() {
    if (!this.loadingActive) {
      console.log('ℹ️ Navigation already completed, skipping...');
      return;
    }
    
    this.loadingActive = false;
    this.lastNavigationType = null;
    this.navigationStartTime = null;
    console.log('✅ Completing navigation instantly');
    
    this.dispatch(completeNavigation());
  }

  cancelNavigationInstantly() {
    if (!this.loadingActive) return;
    
    this.loadingActive = false;
    this.lastNavigationType = null;
    this.navigationStartTime = null;
    console.log('❌ Canceling navigation');
    
    this.dispatch(cancelNavigation());
  }

  // Route completion detection
  onRouteComplete(newUrl) {
    if (newUrl !== this.currentUrl) {
      const oldUrl = this.currentUrl;
      this.currentUrl = newUrl;
      this.dispatch(setCurrentUrl(newUrl));
      
      console.log('🎯 Route completion detected:', { 
        from: oldUrl, 
        to: newUrl, 
        type: this.lastNavigationType,
        duration: this.navigationStartTime ? Date.now() - this.navigationStartTime : 'unknown'
      });
      
      // Adjust completion delay based on navigation type
      const completionDelay = this.lastNavigationType === 'popstate' ? 150 : 80;
      
      setTimeout(() => {
        if (this.loadingActive) { // Double-check we're still loading
          this.completeNavigationInstantly();
        }
      }, completionDelay);
    }
  }

  cleanup() {
    if (!this.isInitialized) return;

    // Restore original router methods
    if (this.router && this.originalRouterMethods.push) {
      this.router.push = this.originalRouterMethods.push;
      this.router.replace = this.originalRouterMethods.replace;
      this.router.back = this.originalRouterMethods.back;
      this.router.forward = this.originalRouterMethods.forward;
      this.router.refresh = this.originalRouterMethods.refresh;
    }

    // Remove event listeners
    document.removeEventListener('click', this.handleLinkClick, { capture: true });
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    this.isInitialized = false;
    console.log('🧹 Navigation Detection Manager cleaned up');
  }
}

// Hook to manage navigation detection
export const useNavigationDetection = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const managerRef = useRef(null);

  useEffect(() => {
    // Initialize manager once
    if (!navigationManager) {
      navigationManager = new NavigationDetectionManager(dispatch, router);
      managerRef.current = navigationManager;
    }

    navigationManager.init();

    return () => {
      // Don't cleanup on every effect - only on component unmount
    };
  }, [dispatch, router]);

  // Detect route completion
  useEffect(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (navigationManager) {
      // Add a small delay to ensure the route change is fully processed
      // This is especially important for browser back/forward navigation
      const timer = setTimeout(() => {
        navigationManager.onRouteComplete(currentUrl);
      }, 50); // Small delay to let browser navigation settle

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup();
        navigationManager = null;
      }
    };
  }, []);
};

export default NavigationDetectionManager;
