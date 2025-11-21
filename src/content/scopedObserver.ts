// Scoped DOM observer - Watches for changes with strict performance limits

import { debounce } from '../lib/utils/debounce';

class ScopedObserver {
  private observer: MutationObserver | null = null;
  private initialized = false;
  private readonly CHAR_CAP = 20000;
  private readonly DEBOUNCE_MS = 500;

  init() {
    if (this.initialized) return;

    this.observer = new MutationObserver(
      debounce(this.handleMutations, this.DEBOUNCE_MS)
    );

    // Observe document body
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.initialized = true;
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.initialized = false;
  }

  private handleMutations = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          this.processNode(node);
        });
      } else if (mutation.type === 'characterData') {
        this.processTextNode(mutation.target);
      }
    }
  };

  private processNode(node: Node) {
    // Skip if not visible
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (!this.isVisible(element)) {
        return;
      }
    }

    // Extract text
    if (node.nodeType === Node.TEXT_NODE) {
      this.processTextNode(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const text = (node as Element).textContent || '';
      if (text.trim().length > 0) {
        this.extractAndAnalyze(text);
      }
    }
  }

  private processTextNode(node: Node) {
    const text = node.textContent || '';
    if (text.trim().length > 0) {
      this.extractAndAnalyze(text.trim());
    }
  }

  private extractAndAnalyze(text: string) {
    // Respect character cap
    if (text.length > this.CHAR_CAP) {
      text = text.substring(0, this.CHAR_CAP);
    }

    // Send to NLP worker for analysis
    // This would be implemented in the full version
    console.log('[ScopedObserver] Extracted text:', text.substring(0, 100));
  }

  private isVisible(element: Element): boolean {
    // Check if element is in viewport and visible
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }
}

export const scopedObserver = new ScopedObserver();
