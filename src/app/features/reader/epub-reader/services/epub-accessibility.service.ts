import { Injectable, inject } from '@angular/core';
import { ThemeOption, CustomColorPalette } from '../../../../core/models/document.model';
import { EpubReaderSettingsService } from './epub-reader-settings.service';

/**
 * Manages accessibility features applied to the epub.js iframe content:
 * bionic reading, word highlighting, custom color palette, and letter spacing.
 *
 * Provided at the component level. Call `setRendition()` after the epub.js
 * rendition is created, and `destroy()` on component teardown.
 */
@Injectable()
export class EpubAccessibilityService {
  private settings = inject(EpubReaderSettingsService);
  private rendition: any = null;

  /** Bind the epub.js rendition so DOM helpers can operate on it. */
  setRendition(rendition: any): void {
    this.rendition = rendition;
  }

  /** Remove all rendered-event listeners. Call from ngOnDestroy. */
  destroy(): void {
    if (this.rendition) {
      this.rendition.off('rendered', this.bionicRenderedHandler);
      this.rendition.off('rendered', this.wordHighlightRenderedHandler);
      this.rendition.off('rendered', this.customPaletteRenderedHandler);
    }
  }

  // ---------------------------------------------------------------------------
  // Letter spacing
  // ---------------------------------------------------------------------------

  /** Apply letter spacing override to the epub rendition */
  applyLetterSpacing(): void {
    if (!this.rendition) return;
    this.rendition.themes.override('letter-spacing', `${this.settings.letterSpacing()}em`);
  }

  // ---------------------------------------------------------------------------
  // Bionic reading
  // ---------------------------------------------------------------------------

  /**
   * Apply or remove bionic reading mode. Bionic reading bolds the first
   * portion of each word so the brain can "auto-complete" the rest.
   */
  applyBionicReading(): void {
    if (!this.rendition) return;

    try {
      const contents = this.rendition.getContents();
      if (!contents || contents.length === 0) return;

      const iframe = contents[0];
      const doc = iframe.document as Document;
      if (!doc) return;

      if (this.settings.bionicReading()) {
        this.injectBionicReading(doc);
      } else {
        this.removeBionicReading(doc);
      }
    } catch (error) {
      console.warn('Could not apply bionic reading:', error);
    }

    // Re-apply on page changes
    if (this.settings.bionicReading()) {
      this.rendition.off('rendered', this.bionicRenderedHandler);
      this.rendition.on('rendered', this.bionicRenderedHandler);
    } else {
      this.rendition.off('rendered', this.bionicRenderedHandler);
    }
  }

  bionicRenderedHandler = () => {
    if (!this.settings.bionicReading() || !this.rendition) return;
    try {
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        const doc = contents[0].document as Document;
        if (doc) this.injectBionicReading(doc);
      }
    } catch {
      // Silently ignore
    }
  };

  /**
   * Walk through all text nodes and wrap the first portion of each word
   * in a `<b class="bionic-bold">` element.
   */
  private injectBionicReading(doc: Document): void {
    // Remove existing bionic markup first
    this.removeBionicReading(doc);

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'B'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains('bionic-bold')) return NodeFilter.FILTER_REJECT;
        return node.textContent && node.textContent.trim().length > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const textNodes: Text[] = [];
    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      textNodes.push(currentNode as Text);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const fragment = doc.createDocumentFragment();

      // Split by word boundaries while preserving whitespace
      const parts = text.split(/(\s+)/);
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          fragment.appendChild(doc.createTextNode(part));
        } else if (part.length > 0) {
          // Bold the first ~half of the word (min 1 char)
          const boldLen = Math.max(1, Math.ceil(part.length * 0.5));
          const boldPart = part.slice(0, boldLen);
          const restPart = part.slice(boldLen);

          const b = doc.createElement('b');
          b.className = 'bionic-bold';
          b.style.fontWeight = '700';
          b.textContent = boldPart;
          fragment.appendChild(b);

          if (restPart) {
            fragment.appendChild(doc.createTextNode(restPart));
          }
        }
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }

  /** Remove all bionic reading markup from the document */
  private removeBionicReading(doc: Document): void {
    const bolds = doc.querySelectorAll('b.bionic-bold');
    bolds.forEach((b) => {
      const parent = b.parentNode;
      if (parent) {
        parent.replaceChild(doc.createTextNode(b.textContent || ''), b);
        parent.normalize(); // Merge adjacent text nodes
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Word (sentence) highlighting
  // ---------------------------------------------------------------------------

  /**
   * Toggle sentence-level highlighting on page content.
   * When enabled, the current sentence is highlighted as the user reads.
   */
  applyWordHighlighting(): void {
    if (!this.rendition) return;

    if (this.settings.wordHighlighting()) {
      this.rendition.off('rendered', this.wordHighlightRenderedHandler);
      this.rendition.on('rendered', this.wordHighlightRenderedHandler);
      this.injectWordHighlightStyles();
    } else {
      this.rendition.off('rendered', this.wordHighlightRenderedHandler);
      this.removeWordHighlightStyles();
    }
  }

  wordHighlightRenderedHandler = () => {
    if (!this.settings.wordHighlighting() || !this.rendition) return;
    this.injectWordHighlightStyles();
  };

  /**
   * Inject CSS-based sentence highlighting into the epub iframe.
   * Uses a hover-like effect to highlight the sentence the user is reading.
   */
  private injectWordHighlightStyles(): void {
    if (!this.rendition) return;

    try {
      const contents = this.rendition.getContents();
      if (!contents || contents.length === 0) return;

      const doc = contents[0].document as Document;
      if (!doc) return;

      // Remove existing style if any
      const existing = doc.getElementById('word-highlight-style');
      if (existing) existing.remove();

      const style = doc.createElement('style');
      style.id = 'word-highlight-style';

      const theme = this.settings.theme();
      const isHighContrast = theme === 'high-contrast-light' || theme === 'high-contrast-dark';
      const isDark = theme === 'dark' || theme === 'high-contrast-dark';

      let highlightBg: string;
      let highlightOutline: string;
      if (isHighContrast && isDark) {
        highlightBg = 'rgba(255, 255, 0, 0.25)';
        highlightOutline = '2px solid rgba(255, 255, 0, 0.5)';
      } else if (isHighContrast) {
        highlightBg = 'rgba(0, 0, 238, 0.12)';
        highlightOutline = '2px solid rgba(0, 0, 238, 0.3)';
      } else if (isDark) {
        highlightBg = 'rgba(79, 172, 254, 0.15)';
        highlightOutline = 'none';
      } else {
        highlightBg = 'rgba(79, 172, 254, 0.12)';
        highlightOutline = 'none';
      }

      style.textContent = `
        p:hover, li:hover, span:hover, blockquote:hover, h1:hover, h2:hover, h3:hover, h4:hover, h5:hover, h6:hover {
          background: ${highlightBg} !important;
          outline: ${highlightOutline};
          outline-offset: 2px;
          border-radius: 3px;
          transition: background 0.15s ease;
        }
      `;

      doc.head.appendChild(style);
    } catch (error) {
      console.warn('Could not inject word highlight styles:', error);
    }
  }

  /** Remove sentence highlight styles from the epub iframe */
  private removeWordHighlightStyles(): void {
    if (!this.rendition) return;

    try {
      const contents = this.rendition.getContents();
      if (!contents || contents.length === 0) return;

      const doc = contents[0].document as Document;
      if (!doc) return;

      const existing = doc.getElementById('word-highlight-style');
      if (existing) existing.remove();
    } catch {
      // Silently ignore
    }
  }

  // ---------------------------------------------------------------------------
  // Custom color palette
  // ---------------------------------------------------------------------------

  /**
   * Apply a custom color palette to the epub rendition.
   * Overrides the theme colors with user-specified values.
   */
  applyCustomColorPalette(): void {
    if (!this.rendition) return;

    const palette = this.settings.customColorPalette();

    if (palette) {
      this.rendition.themes.override('background', palette.background);
      this.rendition.themes.override('color', palette.text);

      // Also inject link color overrides
      try {
        const contents = this.rendition.getContents();
        if (contents && contents.length > 0) {
          const doc = contents[0].document as Document;
          if (doc) {
            const existing = doc.getElementById('custom-palette-style');
            if (existing) existing.remove();

            const style = doc.createElement('style');
            style.id = 'custom-palette-style';
            style.textContent = `
              body { background: ${palette.background} !important; color: ${palette.text} !important; }
              a, a:link, a:visited { color: ${palette.link} !important; }
            `;
            doc.head.appendChild(style);
          }
        }
      } catch {
        // Silently ignore
      }

      // Re-apply on page changes
      this.rendition.off('rendered', this.customPaletteRenderedHandler);
      this.rendition.on('rendered', this.customPaletteRenderedHandler);
    } else {
      // Remove custom palette overrides — re-select the current theme
      this.rendition.off('rendered', this.customPaletteRenderedHandler);
      this.rendition.themes.select(this.settings.theme());
      this.removeCustomPaletteStyles();
    }
  }

  customPaletteRenderedHandler = () => {
    if (!this.settings.customColorPalette() || !this.rendition) return;
    const palette = this.settings.customColorPalette()!;
    try {
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        const doc = contents[0].document as Document;
        if (doc) {
          const existing = doc.getElementById('custom-palette-style');
          if (existing) existing.remove();

          const style = doc.createElement('style');
          style.id = 'custom-palette-style';
          style.textContent = `
            body { background: ${palette.background} !important; color: ${palette.text} !important; }
            a, a:link, a:visited { color: ${palette.link} !important; }
          `;
          doc.head.appendChild(style);
        }
      }
    } catch {
      // Silently ignore
    }
  };

  /** Remove custom palette styles from the epub iframe */
  private removeCustomPaletteStyles(): void {
    if (!this.rendition) return;
    try {
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        const doc = contents[0].document as Document;
        if (doc) {
          const existing = doc.getElementById('custom-palette-style');
          if (existing) existing.remove();
        }
      }
    } catch {
      // Silently ignore
    }
  }
}
