import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  constructor() {}

  /**
   * Escapes special characters for LaTeX compatibility
   * @param value - The string to escape
   * @returns Escaped string safe for LaTeX
   */
  texEscape(value: string): string {
    const replacements: Record<string, string> = {
      '#': '\\#',
      '%': '\\%',
      $: '\\$',
      _: '\\_',
      '^': '\\^',
      '&': '\\&',
      '²': '$^2$',
      '³': '$^3$',
      ₙ: '$_N$',
      '…': '\\ldots',
      '{': '\\{',
      '}': '\\}',
      '<': '\\textless{}',
      '>': '\\textgreater{}',
      '≤': '$\\le $',
      '≥': '$\\ge $',
      Δ: '$\\Delta $',
      '|': '\\textbar{}',
      '"': '\\textquotedbl{}',
      "'": '\\textquotesingle{}',
      '`': '\\textasciigrave{}',
      '\\': '\\textbackslash{}',
      '\xa0': '~',
      '©': '\\copyright{}',
      '§': '\\S'
    };

    const allowedChars = new Set<string>();
    for (let i = 0x21; i < 0x7f; i++) {
      allowedChars.add(String.fromCharCode(i));
    }
    'ÄÖÜäöüß '.split('').forEach((char) => allowedChars.add(char));

    value = String(value);
    let escaped = '';

    for (const char of value) {
      if (replacements[char]) {
        escaped += replacements[char];
      } else if (allowedChars.has(char)) {
        escaped += char;
      }
      // disallowed characters are omitted
    }

    return escaped;
  }

  /**
   * Helper function to insert text before the first child of an element
   */
  private insertBefore(element: Element, text: string, document: Document): void {
    const textNode = document.createTextNode(text);
    if (element.firstChild) {
      element.insertBefore(textNode, element.firstChild);
    } else {
      element.appendChild(textNode);
    }
  }

  /**
   * Gets all text nodes in an element
   */
  private getTextNodes(element: Element, document: Document, NodeFilter: any): Node[] {
    const textNodes: Node[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }

  /**
   * Gets text content from nodes, similar to BeautifulSoup's stripped_strings
   */
  private getStrippedStrings(element: Element, document: Document, NodeFilter: any): string[] {
    const result: string[] = [];

    // Get all text nodes
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        result.push(text);
      }
    }

    return result;
  }

  /**
   * Formats a number with given decimal places
   * @param value - Number to format
   * @param decimalPlaces - Number of decimal places
   * @returns Formatted number as string
   */
  formatNumber(value: number, decimalPlaces: number): string {
    return value.toFixed(decimalPlaces);
  }

  /**
   * Rounds a Likert scale value
   * @param value - The value to round
   * @param decimalPlaces - Number of decimal places (default: 1)
   * @returns Rounded Likert value as string
   */
  likertRound(value: number, decimalPlaces: number = 1): string {
    const roundedValue = +(value * 4).toFixed(decimalPlaces);
    return (roundedValue / 4).toFixed(decimalPlaces + 2);
  }

  /**
   * Converts a normalized Likert value to display number
   * @param value - The normalized value (0-1)
   * @param decimalPlaces - Number of decimal places (default: 1)
   * @returns Likert number as string
   */
  likertNumber(value: number, decimalPlaces: number = 1): string {
    const roundedValue = +(value * 4 + 1).toFixed(decimalPlaces);
    return this.formatNumber(roundedValue, decimalPlaces);
  }

  /**
   * Calculates Likert number difference
   * @param value - The difference value
   * @param decimalPlaces - Number of decimal places (default: 1)
   * @returns Formatted difference as string
   */
  likertNumberDiff(value: number, decimalPlaces: number = 1): string {
    const roundedValue = +(value * 4).toFixed(decimalPlaces);
    return this.formatNumber(roundedValue, decimalPlaces);
  }

  /**
   * Calculates percentage from a count and total
   * @param count - The count
   * @param allCounts - The total count
   * @param decimalPlaces - Number of decimal places (default: 0)
   * @returns Formatted percentage as string
   */
  countPercentage(count: number, allCounts: number, decimalPlaces: number = 0): string {
    const percentage = (count / allCounts) * 100;
    return this.formatNumber(+percentage.toFixed(decimalPlaces), decimalPlaces);
  }

  /**
   * Converts a decimal to percentage
   * @param value - Decimal value (0-1)
   * @param decimalPlaces - Number of decimal places (default: 0)
   * @returns Formatted percentage as string
   */
  percentage(value: number, decimalPlaces: number = 0): string {
    return (value * 100).toFixed(decimalPlaces);
  }

  /**
   * Floors a number
   * @param value - Number to floor
   * @returns Floor value
   */
  formate(value: number): number {
    return Math.floor(value);
  }

  /**
   * Formats a number with specified decimal places
   * @param value - Number to format
   * @param decimalPlaces - Number of decimal places
   * @returns Formatted number as string
   */
  numberFormat(value: number, decimalPlaces: number): string {
    return value.toFixed(decimalPlaces);
  }

  /**
   * Converts sorted number pairs to key-value objects
   * @param pairs - Array of number pairs
   * @returns Array of key-value objects
   */
  convertSortedToKeyValueArray(pairs: [number, number][]): { key: string; value: number }[] {
    return pairs
      .sort((a, b) => a[0] - b[0])
      .map(([key, value]) => ({
        key: key.toString(),
        value
      }));
  }

  /**
   * Gets text based on default language
   * @param text - Object containing different language versions
   * @param defaultLanguage - The default language key
   * @returns Text in the default language or empty string
   */
  getTextByDefaultLanguage(text: any, defaultLanguage: any): string {
    return text?.[defaultLanguage] ? text?.[defaultLanguage] : text?.default ? text?.default : '';
  }
}
