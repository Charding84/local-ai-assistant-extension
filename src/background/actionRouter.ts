// Routes messages to appropriate handlers

interface Message {
  action: string;
  payload?: unknown;
}

interface Sender {
  tab?: chrome.tabs.Tab;
  url?: string;
}

export async function actionRouter(
  message: Message,
  sender: Sender
): Promise<unknown> {
  const { action, payload } = message;

  switch (action) {
    case 'checkPermissions':
      return handleCheckPermissions(payload as { hostname: string });

    case 'requestSiteAccess':
      return handleRequestSiteAccess(payload as { hostname: string });

    case 'enableFeature':
      return handleEnableFeature(
        payload as { hostname: string; feature: string }
      );

    case 'disableFeature':
      return handleDisableFeature(
        payload as { hostname: string; feature: string }
      );

    case 'removeSiteAccess':
      return handleRemoveSiteAccess(payload as { hostname: string });

    case 'injectContent':
      return handleInjectContent(payload as { tabId: number });

    case 'openDashboard':
      return handleOpenDashboard();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function handleCheckPermissions(payload: {
  hostname: string;
}): Promise<{ enabled: boolean; features: unknown }> {
  const { hostname } = payload;
  const whitelist = await chrome.storage.local.get('siteWhitelist');
  const sitePerms = whitelist.siteWhitelist?.[hostname];

  return {
    enabled: sitePerms?.enabled || false,
    features: sitePerms?.features || {},
  };
}

async function handleRequestSiteAccess(payload: {
  hostname: string;
}): Promise<{ success: boolean }> {
  const { hostname } = payload;

  // Request host permissions
  const granted = await chrome.permissions.request({
    origins: [`*://${hostname}/*`],
  });

  if (granted) {
    // Add to whitelist
    const whitelist = await chrome.storage.local.get('siteWhitelist');
    const updated = {
      ...whitelist.siteWhitelist,
      [hostname]: {
        enabled: true,
        features: {
          copyRewrite: false,
          observers: false,
          autofill: false,
        },
        addedAt: Date.now(),
      },
    };

    await chrome.storage.local.set({ siteWhitelist: updated });
  }

  return { success: granted };
}

async function handleEnableFeature(payload: {
  hostname: string;
  feature: string;
}): Promise<{ success: boolean }> {
  const { hostname, feature } = payload;
  const whitelist = await chrome.storage.local.get('siteWhitelist');
  const sitePerms = whitelist.siteWhitelist?.[hostname];

  if (!sitePerms) {
    throw new Error('Site not whitelisted');
  }

  const updated = {
    ...whitelist.siteWhitelist,
    [hostname]: {
      ...sitePerms,
      features: {
        ...sitePerms.features,
        [feature]: true,
      },
    },
  };

  await chrome.storage.local.set({ siteWhitelist: updated });
  return { success: true };
}

async function handleDisableFeature(payload: {
  hostname: string;
  feature: string;
}): Promise<{ success: boolean }> {
  const { hostname, feature } = payload;
  const whitelist = await chrome.storage.local.get('siteWhitelist');
  const sitePerms = whitelist.siteWhitelist?.[hostname];

  if (!sitePerms) {
    throw new Error('Site not whitelisted');
  }

  const updated = {
    ...whitelist.siteWhitelist,
    [hostname]: {
      ...sitePerms,
      features: {
        ...sitePerms.features,
        [feature]: false,
      },
    },
  };

  await chrome.storage.local.set({ siteWhitelist: updated });
  return { success: true };
}

async function handleRemoveSiteAccess(payload: {
  hostname: string;
}): Promise<{ success: boolean }> {
  const { hostname } = payload;

  // Remove from whitelist
  const whitelist = await chrome.storage.local.get('siteWhitelist');
  const updated = { ...whitelist.siteWhitelist };
  delete updated[hostname];

  await chrome.storage.local.set({ siteWhitelist: updated });

  // Remove host permissions
  await chrome.permissions.remove({
    origins: [`*://${hostname}/*`],
  });

  return { success: true };
}

async function handleInjectContent(payload: {
  tabId: number;
}): Promise<{ success: boolean }> {
  const { tabId } = payload;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['contentBootstrap.js'],
  });

  return { success: true };
}

async function handleOpenDashboard(): Promise<{ success: boolean }> {
  await chrome.tabs.create({ url: 'dashboard.html' });
  return { success: true };
}
