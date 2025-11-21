// Content script bootstrap - Only runs on whitelisted sites

import { copyInterceptor } from './copyInterceptor';
import { scopedObserver } from './scopedObserver';

interface SitePermissions {
  enabled: boolean;
  features: {
    copyRewrite: boolean;
    observers: boolean;
    autofill: boolean;
  };
}

// Check if we should initialize
async function checkPermissions(): Promise<SitePermissions | null> {
  try {
    const hostname = window.location.hostname;
    const response = await chrome.runtime.sendMessage({
      action: 'checkPermissions',
      payload: { hostname },
    });
    return response;
  } catch (error) {
    console.error('Failed to check permissions:', error);
    return null;
  }
}

// Initialize enabled features
async function initializeFeatures(permissions: SitePermissions) {
  const { features } = permissions;

  console.log('[Local AI Assistant] Initializing on', window.location.hostname);
  console.log('[Local AI Assistant] Enabled features:', features);

  // Initialize Copy→Rewrite
  if (features.copyRewrite) {
    copyInterceptor.init();
    console.log('[Local AI Assistant] Copy→Rewrite enabled');
  }

  // Initialize Observers
  if (features.observers) {
    scopedObserver.init();
    console.log('[Local AI Assistant] Observers enabled');
  }

  // Initialize Autofill
  if (features.autofill) {
    // Autofill initialization would go here
    console.log('[Local AI Assistant] Autofill enabled');
  }
}

// Main bootstrap
(async function bootstrap() {
  // Don't run on extension pages
  if (window.location.protocol === 'chrome-extension:') {
    return;
  }

  const permissions = await checkPermissions();

  if (!permissions || !permissions.enabled) {
    console.log(
      '[Local AI Assistant] Not enabled on',
      window.location.hostname
    );
    return;
  }

  await initializeFeatures(permissions);
})();

// Listen for permission changes
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'permissionsChanged') {
    // Reload page to reinitialize with new permissions
    window.location.reload();
  }
  sendResponse({ received: true });
  return true;
});
