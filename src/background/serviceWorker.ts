// Background service worker - handles extension lifecycle and permissions

import { actionRouter } from './actionRouter';

// Storage keys
const WHITELIST_KEY = 'siteWhitelist';
const SETTINGS_KEY = 'extensionSettings';

interface SitePermissions {
  enabled: boolean;
  features: {
    copyRewrite: boolean;
    observers: boolean;
    autofill: boolean;
  };
  addedAt: number;
}

interface Whitelist {
  [hostname: string]: SitePermissions;
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async details => {
  console.log('Extension installed:', details.reason);

  // Initialize storage
  const { [WHITELIST_KEY]: existing } = await chrome.storage.local.get(
    WHITELIST_KEY
  );

  if (!existing) {
    await chrome.storage.local.set({ [WHITELIST_KEY]: {} });
  }

  await chrome.storage.local.set({
    [SETTINGS_KEY]: {
      telemetryEnabled: false,
      maxCharLimit: 20000,
      retentionDays: 30,
    },
  });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  actionRouter(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Action router error:', error);
      sendResponse({ error: error.message });
    });

  return true; // Keep channel open for async response
});

// Handle extension icon click
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !tab.url) return;

  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;

    // Open options page with site context
    await chrome.tabs.create({
      url: `options.html?site=${encodeURIComponent(hostname)}`,
    });
  } catch (error) {
    console.error('Error handling icon click:', error);
  }
});

// Permission change handler
chrome.permissions.onAdded.addListener(permissions => {
  console.log('Permissions added:', permissions);
});

chrome.permissions.onRemoved.addListener(permissions => {
  console.log('Permissions removed:', permissions);
});

// Helper to check if site is whitelisted
export async function isSiteWhitelisted(hostname: string): Promise<boolean> {
  const { [WHITELIST_KEY]: whitelist } = await chrome.storage.local.get(
    WHITELIST_KEY
  );
  return whitelist?.[hostname]?.enabled || false;
}

// Helper to get site permissions
export async function getSitePermissions(
  hostname: string
): Promise<SitePermissions | null> {
  const { [WHITELIST_KEY]: whitelist } = await chrome.storage.local.get(
    WHITELIST_KEY
  );
  return whitelist?.[hostname] || null;
}
