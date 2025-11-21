import { describe, it, expect } from 'vitest';
import {
  sanitizeHTML,
  sanitizeText,
  stripHTML,
  sanitizeURL,
  validateFieldValue,
} from '../../src/lib/utils/sanitizer';

describe('Sanitizer', () => {
  describe('sanitizeHTML', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeHTML(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should handle quotes', () => {
      const input = '"quoted" and \'single\'';
      const result = sanitizeHTML(input);
      expect(result).toContain('quot');
    });
  });

  describe('sanitizeText', () => {
    it('should escape all special characters', () => {
      const input = '<>"\'/&';
      const result = sanitizeText(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&quot;');
      expect(result).toContain('&#x27;');
      expect(result).toContain('&#x2F;');
    });
  });

  describe('stripHTML', () => {
    it('should remove all HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const result = stripHTML(input);
      expect(result).toBe('Hello world');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should preserve text content', () => {
      const input = '<div>Test <span>content</span> here</div>';
      const result = stripHTML(input);
      expect(result).toContain('Test');
      expect(result).toContain('content');
      expect(result).toContain('here');
    });
  });

  describe('sanitizeURL', () => {
    it('should allow valid HTTP URLs', () => {
      const input = 'http://example.com';
      const result = sanitizeURL(input);
      expect(result).toBe(input);
    });

    it('should allow valid HTTPS URLs', () => {
      const input = 'https://example.com/path?query=1';
      const result = sanitizeURL(input);
      expect(result).toBe(input);
    });

    it('should reject javascript: URLs', () => {
      const input = 'javascript:alert(1)';
      const result = sanitizeURL(input);
      expect(result).toBe('');
    });

    it('should reject data: URLs', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeURL(input);
      expect(result).toBe('');
    });

    it('should handle invalid URLs', () => {
      const input = 'not a url';
      const result = sanitizeURL(input);
      expect(result).toBe('');
    });
  });

  describe('validateFieldValue', () => {
    it('should validate email addresses', () => {
      expect(validateFieldValue('test@example.com', 'email')).toBe(true);
      expect(validateFieldValue('invalid-email', 'email')).toBe(false);
      expect(validateFieldValue('@example.com', 'email')).toBe(false);
    });

    it('should validate URLs', () => {
      expect(validateFieldValue('https://example.com', 'url')).toBe(true);
      expect(validateFieldValue('not a url', 'url')).toBe(false);
    });

    it('should validate phone numbers', () => {
      expect(validateFieldValue('123-456-7890', 'tel')).toBe(true);
      expect(validateFieldValue('(555) 123-4567', 'tel')).toBe(true);
      expect(validateFieldValue('invalid', 'tel')).toBe(false);
    });

    it('should validate numbers', () => {
      expect(validateFieldValue('123', 'number')).toBe(true);
      expect(validateFieldValue('123.45', 'number')).toBe(true);
      expect(validateFieldValue('abc', 'number')).toBe(false);
    });

    it('should allow any value for unknown types', () => {
      expect(validateFieldValue('anything', 'text')).toBe(true);
      expect(validateFieldValue('', 'unknown')).toBe(true);
    });
  });
});
