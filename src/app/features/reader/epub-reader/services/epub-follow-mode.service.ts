import { Injectable, signal } from '@angular/core';

export interface FollowModeWord {
  text: string;
  node: Text;
  offset: number;
}

/**
 * Manages follow mode (word-by-word auto-highlighting) for the epub reader.
 *
 * Provided at the component level. Call `setRendition()` after the epub.js
 * rendition is created. The component supplies a `nextPageFn` callback used
 * when follow mode reaches the end of a page.
 */
@Injectable()
export class EpubFollowModeService {
  private rendition: any = null;
  private words: FollowModeWord[] = [];
  private currentIndex = 0;
  private timer: any = null;
  private isPaused = false;
  private currentRange: Range | null = null;
  private speedWpm = 250;
  private nextPageFn: (() => Promise<void>) | null = null;
  private isActiveGetter: () => boolean = () => false;

  /** Exposed as a signal so the template can react. */
  paused = signal<boolean>(false);

  /** Bind the epub.js rendition so DOM helpers can operate on it. */
  setRendition(rendition: any): void {
    this.rendition = rendition;
  }

  /**
   * Configure runtime callbacks.
   * @param nextPageFn Called when follow mode reaches end-of-page.
   * @param isActive A getter returning whether follow mode is still enabled.
   * @param speed Initial WPM.
   */
  configure(
    nextPageFn: () => Promise<void>,
    isActive: () => boolean,
    speed: number,
  ): void {
    this.nextPageFn = nextPageFn;
    this.isActiveGetter = isActive;
    this.speedWpm = speed;
  }

  /** Update the WPM speed (e.g. when the user changes it in settings). */
  setSpeed(wpm: number): void {
    this.speedWpm = wpm;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  start(): void {
    if (!this.rendition) return;

    try {
      // Stop any existing timer
      this.cleanup();

      // Get the current page's text content
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        const iframe = contents[0];
        const doc = iframe.document;

        if (doc && doc.body) {
          this.words = this.extractWordsFromDocument(doc);
          this.currentIndex = 0;
          this.isPaused = false;

          if (this.words.length > 0) {
            this.highlightCurrentWord();
            this.paused.set(false);
            this.startTimer();
          }
        }
      }
    } catch (error) {
      console.warn('Could not initialize follow mode:', error);
    }
  }

  cleanup(): void {
    // Clear timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Remove highlights
    if (this.rendition) {
      try {
        const contents = this.rendition.getContents();
        if (contents && contents.length > 0) {
          const iframe = contents[0];
          const doc = iframe.document;
          if (doc) {
            this.removeCurrentHighlight(doc);
          }
        }
      } catch {
        // Silently ignore cleanup errors
      }
    }

    // Reset state
    this.words = [];
    this.currentIndex = 0;
    this.currentRange = null;
    this.paused.set(false);
    this.isPaused = false;
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    this.paused.set(this.isPaused);

    if (this.isPaused) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    } else {
      this.startTimer();
    }
  }

  advance(): void {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.highlightCurrentWord();
      if (!this.isPaused) {
        this.startTimer();
      }
    } else {
      // End of current page — move to next page
      this.isPaused = true; // Pause during page transition
      if (this.nextPageFn) {
        this.nextPageFn().then(() => {
          setTimeout(() => {
            if (this.isActiveGetter()) {
              this.start();
            }
          }, 300);
        });
      }
    }
  }

  retreat(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.highlightCurrentWord();
      // Manual control — pause auto-advance
      if (!this.isPaused) {
        this.togglePause();
      }
    }
  }

  restartTimer(): void {
    if (this.isActiveGetter() && !this.isPaused) {
      this.startTimer();
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private startTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (this.isPaused) return;

    // delay = (60 000 ms / min) / WPM
    const delayMs = 60000 / this.speedWpm;

    this.timer = setTimeout(() => {
      this.advance();
    }, delayMs);
  }

  /**
   * Extract words with their text-node references for accurate highlighting.
   */
  private extractWordsFromDocument(
    doc: Document,
  ): FollowModeWord[] {
    const words: FollowModeWord[] = [];

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.textContent && node.textContent.trim().length > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      const textNode = currentNode as Text;
      const text = textNode.textContent || '';

      const wordMatches = text.matchAll(/\S+/g);
      for (const match of wordMatches) {
        words.push({ text: match[0], node: textNode, offset: match.index! });
      }
    }

    return words;
  }

  private highlightCurrentWord(): void {
    if (!this.rendition || this.words.length === 0) return;
    if (this.currentIndex >= this.words.length) return;

    try {
      const contents = this.rendition.getContents();
      if (!contents || contents.length === 0) return;

      const iframe = contents[0];
      const doc = iframe.document;
      if (!doc) return;

      // Remove previous highlight
      this.removeCurrentHighlight(doc);

      const wordInfo = this.words[this.currentIndex];

      // Create a range for the current word
      const range = doc.createRange();
      range.setStart(wordInfo.node, wordInfo.offset);
      range.setEnd(wordInfo.node, wordInfo.offset + wordInfo.text.length);

      this.currentRange = range;

      // Create highlight span
      const highlight = doc.createElement('span');
      highlight.className = 'follow-mode-highlight';
      highlight.style.cssText = `
        background-color: rgba(255, 215, 0, 0.5);
        border-radius: 3px;
        padding: 2px 0;
        transition: background-color 0.2s ease;
        box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
      `;

      try {
        range.surroundContents(highlight);
        highlight.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      } catch (e) {
        console.warn('Could not wrap word, range may span elements:', e);
      }
    } catch (error) {
      console.warn('Error highlighting word:', error);
    }
  }

  private removeCurrentHighlight(doc: Document): void {
    const existingHighlights = doc.querySelectorAll('.follow-mode-highlight');
    existingHighlights.forEach((highlight) => {
      const parent = highlight.parentNode;
      if (parent) {
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
      }
    });

    this.currentRange = null;
  }
}
