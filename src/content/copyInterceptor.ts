// Copy interceptor - Shows rewrite popup when text is copied

import { showRewritePopup } from './rewritePopup';
import { debounce } from '../lib/utils/debounce';

class CopyInterceptor {
  private initialized = false;
  private lastCopiedText = '';

  init() {
    if (this.initialized) return;

    document.addEventListener('copy', this.handleCopy);
    this.initialized = true;
  }

  destroy() {
    document.removeEventListener('copy', this.handleCopy);
    this.initialized = false;
  }

  private handleCopy = debounce((event: ClipboardEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      return;
    }

    const text = selection.toString().trim();
    
    // Don't show popup for very short selections
    if (text.length < 10) {
      return;
    }

    // Respect character limit
    const MAX_CHARS = 20000;
    if (text.length > MAX_CHARS) {
      console.warn(
        `[Local AI Assistant] Text too long (${text.length} chars), max is ${MAX_CHARS}`
      );
      return;
    }

    this.lastCopiedText = text;

    // Get cursor position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Show rewrite popup near cursor
    showRewritePopup(text, {
      x: rect.right + window.scrollX,
      y: rect.bottom + window.scrollY,
    });
  }, 300);

  getLastCopiedText(): string {
    return this.lastCopiedText;
  }
}

export const copyInterceptor = new CopyInterceptor();
