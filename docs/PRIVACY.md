# Privacy Model

## Core Guarantee

**The Local AI Assistant Extension processes all data locally within your browser. Zero data is transmitted to external servers by default.**

## Default State

### On Installation
- **Zero host permissions**: Extension cannot access any webpage
- **No content injection**: No scripts run on any site
- **No network calls**: No external APIs contacted
- **No telemetry**: Analytics disabled by default
- **No cloud storage**: All data stays in IndexedDB

### Storage Location
All data is stored in **IndexedDB** within your browser profile:
- **Database name**: `assistant_hub_v1`
- **Location**: `chrome://settings/siteData` → Search "extension"
- **Persistence**: Tied to browser profile, cleared when profile deleted

## Permission Model

### Required Permissions (Granted on Install)

#### `storage`
- **Purpose**: Store whitelist, settings, and feature flags
- **Access**: Extension storage API only (not website data)
- **Data**: Site whitelist, user settings, telemetry opt-in state

#### `scripting`  
- **Purpose**: Inject content scripts **only** on whitelisted sites
- **Access**: Dynamic injection via scripting.executeScript
- **Limitation**: Cannot inject without explicit user opt-in

#### `activeTab`
- **Purpose**: Access current tab metadata (URL, title)
- **Access**: Only when user clicks extension icon
- **Limitation**: No content access, metadata only

### Optional Permissions (Requested on Demand)

#### `clipboardRead` / `clipboardWrite`
- **When requested**: User enables "Copy→Rewrite" feature
- **Purpose**: Read copied text, write transformed text
- **Scope**: Only on whitelisted sites
- **Revocable**: Disable feature to remove permission

#### Host Permissions (`<all_urls>`)
- **When requested**: User clicks "Enable on this site"
- **Purpose**: Inject content scripts on specific site
- **Scope**: Per-hostname, not global
- **Revocable**: Remove site from whitelist

## Two-Step Opt-In Flow

### Step 1: Site Enablement

1. User navigates to website (e.g., `https://example.com`)
2. User clicks extension icon
3. Extension displays: **"Enable on example.com?"**
4. User clicks **"Enable"**
5. Browser prompts: **"Allow extension to access example.com?"**
6. User grants host permission for `example.com`
7. Site added to whitelist (stored in `chrome.storage.local`)

**At this point:** Extension has permission but **no features are active yet**.

### Step 2: Feature Activation

1. Extension displays feature selection modal:
   - ☐ **Copy→Rewrite**: Transform copied text
   - ☐ **Observers**: Watch for DOM changes  
   - ☐ **Autofill**: Smart form filling
2. User selects desired features
3. User clicks **"Confirm & Reload"**
4. If clipboard features selected, browser prompts: **"Allow clipboard access?"**
5. User grants clipboard permission
6. Page reloads, content script injected with feature flags

**Only now** are features active on the site.

### Revoking Access

**From Extension:**
1. Options page → Whitelisted Sites
2. Find site (e.g., `example.com`)
3. Click **"Remove"**
4. Host permission removed
5. Content scripts unloaded

**From Browser:**
1. `chrome://extensions/` → Local AI Assistant → Details
2. Permissions → Site Access
3. Remove specific site or set to "On click"

## Data Flows

### What Data is Collected?

#### Locally Stored (IndexedDB)
- **Copied text**: When using Copy→Rewrite feature
- **Transformed text**: Results of local transforms
- **Rewrite history**: Source, result, settings, timestamp, site
- **Saved items**: User-saved highlights, annotations, summaries
- **Action graphs**: User-created automation workflows
- **Undo stack**: Last 10 actions per site
- **Predictive scores**: Autofill frequency data per site

#### Chrome Extension Storage
- **Site whitelist**: Hostnames and enabled features
- **Settings**: Character limit, retention period, telemetry opt-in
- **Feature flags**: Per-site feature enablement

### What Data is NOT Collected?

- **Browsing history**: Extension does not track visited pages
- **Passwords**: No access to password managers or form data
- **Cookies**: No cookie access
- **Cross-site data**: Each site's data is isolated
- **Personal identifiers**: No user IDs, emails, or tracking tokens

### Data Retention

**Default Policy:**
- **Rewrite history**: 30 days (configurable)
- **Saved items**: Indefinite (user must delete)
- **Undo stack**: 10 actions per site (LIFO, automatic)
- **LRU cache**: 100 entries (automatic eviction)

**User Control:**
- Settings → Data Retention → Set days (0-365)
- Dashboard → Export → Download JSON/CSV
- Options → Advanced → Clear All Data

### Data Export

**Export Formats:**
- **JSON**: Full database dump with schema
- **CSV**: Flattened tables for spreadsheets

**Export Process:**
1. Dashboard → Export
2. Select format (JSON or CSV)
3. Select data types (all or specific stores)
4. Click **"Download"**
5. File saved locally via browser download

**Data is NOT uploaded anywhere—only downloaded to your device.**

## Telemetry (Opt-In Only)

### Default State
Telemetry is **disabled by default** and requires **explicit opt-in**.

### What Would Be Collected (If Enabled)
- **Feature usage counts**: How often each feature is used (no content)
- **Performance metrics**: Transform latency, error rates (no text)
- **Error logs**: Stack traces from crashes (no personal data)

### What is NEVER Collected (Even If Opted In)
- **Text content**: Your copied or transformed text
- **URLs**: Websites you visit
- **Personal data**: Names, emails, identifiers

### How to Opt In
1. Options page → Privacy
2. Check **"Enable telemetry"**
3. Click **"Save"**
4. Confirmation modal: **"Data will be collected locally only"**

**Note:** Current version stores telemetry **locally only**. No remote transmission is implemented.

### How to Opt Out
1. Options page → Privacy
2. Uncheck **"Enable telemetry"**
3. Click **"Clear telemetry data"**

## Network Isolation

### Code-Level Guarantees

#### No Network APIs in Core Code
The following are **strictly prohibited** in core modules:
- `fetch()`
- `XMLHttpRequest`
- `navigator.sendBeacon()`
- WebSocket
- External `<script>` tags
- External CSS imports

#### Static Analysis
CI pipeline scans built bundles for:
```bash
grep -r "fetch\|XMLHttpRequest\|sendBeacon" dist/
```
Build **fails** if any matches found in core modules.

#### Runtime Monitoring (Tests)
Integration tests use Playwright's network interception:
```typescript
page.route('**/*', route => {
  if (route.request().url().startsWith('http')) {
    throw new Error(`Unexpected network call: ${route.request().url()}`);
  }
});
```

### What About Updates?

**Extension updates** are delivered via Chrome Web Store:
- **Update manifest**: Google servers
- **Extension code**: Google CDN
- **Frequency**: User-controlled (auto or manual)

**Extension does NOT check for updates itself**. Updates are handled entirely by Chrome's extension platform.

## Third-Party Dependencies

### Runtime Dependencies
- **idb** (8.0.0): IndexedDB wrapper (local storage only)
- **lunr** (2.3.9): Client-side search (no network)

### Build Dependencies
- TypeScript, Vite, Playwright, ESLint, Prettier (dev only, not bundled)

**All dependencies are audited for:**
- No telemetry
- No network calls
- No external script loading
- No data exfiltration

### Dependency Audit
```bash
npm audit
npm run audit-licenses
```

## Comparison to Cloud-Based Alternatives

| Feature | Local AI Assistant | Cloud AI Extension |
|---------|-------------------|-------------------|
| **Data location** | Your browser | Third-party servers |
| **Network calls** | Zero | Every operation |
| **Latency** | <300ms | 500-5000ms |
| **Offline mode** | Fully functional | Requires internet |
| **Privacy** | Complete | Depends on provider |
| **Cost** | Free | Often subscription |
| **Capabilities** | Deterministic | Generative AI |

## Frequently Asked Questions

### Can the extension see my passwords?
**No.** The extension has no access to password managers, autofill data, or credential storage.

### Does it track my browsing history?
**No.** The extension only accesses sites where you explicitly grant permission.

### Can it read my email or social media?
**Only if you enable it on those sites**, and even then, it only processes text you explicitly copy or select.

### What happens if I uninstall?
All local data (IndexedDB, extension storage) is **permanently deleted**. Export data first if you want to keep it.

### Can I use it in Incognito mode?
**Yes**, but you must enable "Allow in Incognito" in `chrome://extensions/`. Data is still stored locally but cleared when Incognito window closes.

### Does it work offline?
**Yes, completely.** All processing is local, no internet required.

### How do I verify no data is sent?
1. Open Chrome DevTools (F12)
2. Network tab
3. Use extension features
4. Verify **zero network requests** from extension origin

**Or** use Playwright tests:
```bash
npm run test:network-isolation
```

## Security Best Practices

### For Users
1. **Only enable on trusted sites**: Limit host permissions
2. **Review permissions regularly**: Options → Whitelisted Sites
3. **Export data periodically**: Backup to local files
4. **Keep extension updated**: Enable auto-updates
5. **Report issues**: Use GitHub Issues for bugs

### For Developers
1. **Never add network calls** to core modules
2. **Sanitize all inputs**: Use sanitizer utilities
3. **Test permission boundaries**: Integration tests required
4. **Document data flows**: Update this file for new features
5. **Run CI before merge**: Network isolation tests must pass

## Compliance

### GDPR (EU)
- **No personal data collection** by default
- **User consent required** for optional features
- **Right to delete**: Clear data button in options
- **Data portability**: Export JSON/CSV
- **No cross-border transfer**: Data never leaves browser

### CCPA (California)
- **Opt-in for telemetry**: Disabled by default
- **Do Not Sell**: Not applicable (no data sharing)
- **Access and deletion**: Export and clear data options

### Browser Permissions API
- **Follows Chrome's permission model**: Host permissions, clipboard, storage
- **Revocable permissions**: Users can remove at any time
- **Minimal permissions**: Only request what's needed

## Changes to This Policy

This privacy model is versioned with the extension. Changes are documented in:
- **Git history**: `git log docs/PRIVACY.md`
- **Release notes**: GitHub Releases
- **In-app notifications**: For breaking privacy changes (if any)

**Current version**: 1.0.0 (2025-11-20)

## Contact

Privacy concerns or questions:
- **Email**: charding405@gmail.com
- **GitHub Issues**: [Privacy label](https://github.com/Charding84/local-ai-assistant-extension/labels/privacy)

**Security vulnerabilities**: Please email directly, do NOT open public issues.
