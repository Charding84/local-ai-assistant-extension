// Rewrite popup UI that appears after copy event

import { sanitizeHTML } from '../lib/utils/sanitizer';

interface Position {
  x: number;
  y: number;
}

interface RewriteSettings {
  length?: 'short' | 'medium' | 'long' | 'custom';
  tone?: string;
  style?: string;
}

let currentPopup: HTMLElement | null = null;
let currentText = '';
let transformWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
  if (!transformWorker) {
    transformWorker = new Worker(
      chrome.runtime.getURL('transformWorker.js'),
      { type: 'module' }
    );
  }
  return transformWorker;
}

export function showRewritePopup(text: string, position: Position) {
  // Remove any existing popup
  if (currentPopup) {
    currentPopup.remove();
  }

  currentText = text;

  // Create popup element
  const popup = document.createElement('div');
  popup.id = 'local-ai-rewrite-popup';
  popup.style.cssText = `
    position: absolute;
    left: ${position.x}px;
    top: ${position.y}px;
    background: white;
    border: 2px solid #4285f4;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    min-width: 300px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `;

  popup.innerHTML = `
    <div style="margin-bottom: 12px; font-weight: 600;">Transform Text</div>
    
    <div style="margin-bottom: 8px;">
      <label style="display: block; margin-bottom: 4px;">Length:</label>
      <select id="length-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="short">Short</option>
        <option value="medium" selected>Medium</option>
        <option value="long">Long</option>
      </select>
    </div>
    
    <div style="margin-bottom: 8px;">
      <label style="display: block; margin-bottom: 4px;">Tone:</label>
      <select id="tone-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="">None</option>
        <option value="formal">Formal</option>
        <option value="casual">Casual</option>
        <option value="professional">Professional</option>
      </select>
    </div>
    
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px;">Style:</label>
      <select id="style-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="">None</option>
        <option value="concise">Concise</option>
        <option value="detailed">Detailed</option>
        <option value="technical">Technical</option>
      </select>
    </div>
    
    <div style="display: flex; gap: 8px;">
      <button id="transform-btn" style="flex: 1; padding: 8px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Transform</button>
      <button id="close-btn" style="padding: 8px 16px; background: #f1f3f4; border: none; border-radius: 4px; cursor: pointer;">Close</button>
    </div>
    
    <div id="result-container" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;"></div>
  `;

  // Add event listeners
  popup.querySelector('#transform-btn')!.addEventListener('click', async () => {
    const settings: RewriteSettings = {
      length: (popup.querySelector('#length-select') as HTMLSelectElement).value as any,
      tone: (popup.querySelector('#tone-select') as HTMLSelectElement).value || undefined,
      style: (popup.querySelector('#style-select') as HTMLSelectElement).value || undefined,
    };

    await transformText(popup, settings);
  });

  popup.querySelector('#close-btn')!.addEventListener('click', () => {
    popup.remove();
    currentPopup = null;
  });

  document.body.appendChild(popup);
  currentPopup = popup;
}

async function transformText(popup: HTMLElement, settings: RewriteSettings) {
  const btn = popup.querySelector('#transform-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Transforming...';

  try {
    const worker = getOrCreateWorker();
    const requestId = `transform_${Date.now()}`;

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      worker.onmessage = (event) => {
        if (event.data.id === requestId) {
          clearTimeout(timeout);
          resolve(event.data);
        }
      };

      worker.postMessage({
        id: requestId,
        type: 'transform',
        payload: {
          text: currentText,
          settings,
        },
      });
    });

    if (result.status === 'ok') {
      showResult(popup, result.result);
    } else {
      showError(popup, result.error || 'Transform failed');
    }
  } catch (error) {
    showError(popup, error instanceof Error ? error.message : 'Unknown error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Transform';
  }
}

function showResult(popup: HTMLElement, result: any) {
  const container = popup.querySelector('#result-container') as HTMLElement;
  container.style.display = 'block';
  
  container.innerHTML = `
    <div style="margin-bottom: 8px; font-size: 12px; color: #666;">
      Rules applied: ${result.rulesApplied.join(', ')}<br>
      Change ratio: ${(result.changeRatio * 100).toFixed(0)}%
    </div>
    
    <textarea id="result-text" style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; resize: vertical;">${sanitizeHTML(result.text)}</textarea>
    
    <div style="display: flex; gap: 8px; margin-top: 8px;">
      <button id="copy-result" style="flex: 1; padding: 6px; background: #34a853; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy</button>
      <button id="replace-result" style="flex: 1; padding: 6px; background: #ea4335; color: white; border: none; border-radius: 4px; cursor: pointer;">Replace</button>
    </div>
  `;

  // Copy button
  container.querySelector('#copy-result')!.addEventListener('click', async () => {
    const textarea = container.querySelector('#result-text') as HTMLTextAreaElement;
    await navigator.clipboard.writeText(textarea.value);
    alert('Copied to clipboard!');
  });

  // Replace button (requires confirmation)
  container.querySelector('#replace-result')!.addEventListener('click', () => {
    if (confirm('Replace the original selected text with this transformed version?')) {
      // This would require more complex logic to replace the original selection
      alert('Replace functionality would be implemented here');
    }
  });
}

function showError(popup: HTMLElement, error: string) {
  const container = popup.querySelector('#result-container') as HTMLElement;
  container.style.display = 'block';
  container.innerHTML = `
    <div style="color: #ea4335; padding: 8px; background: #fce8e6; border-radius: 4px;">
      Error: ${sanitizeHTML(error)}
    </div>
  `;
}
