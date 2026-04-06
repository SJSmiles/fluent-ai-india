/**
 * 🔹 PurchaseReadinessMapper (used for buy_plan_time → BMBY dropdown ID)
 * 
 * Handles English + German mapping for time-based purchase intent.
 * Maps input text like “in den nächsten 3 Monaten” or “ASAP”
 * → BMBY field IDs like “74916”, “74918”, etc.
 */

export class PurchaseReadinessMapper {
  private textToIdMap: Map<string, string>;
  private idToTextMap: Map<string, { en: string; de: string; category: string }>;
  private timeUnits: Record<string, number>;
  private immediateTerms: string[];

  constructor() {
    this.textToIdMap = new Map([
      // 🇩🇪 German
      ["in den nächsten 3 monaten", "74916"],
      ["in den nächsten 6 monaten", "74917"],
      ["in den nächsten 12 monaten", "74919"],
      ["länger als 6 monate", "74919"],
      ["sofort", "74918"],
      ["3 monate", "74916"],
      ["6 monate", "74917"],
      ["12 monate", "74919"],
      ["nicht besprochen", ""],
      ["über 6 monate", "74919"],
      ["sofortig", "74918"],
      ["dringend", "74918"],
      ["jetzt", "74918"],

      // 🇬🇧 English
      ["within the next 3 months", "74916"],
      ["within the next 6 months", "74917"],
      ["within the next 12 months", "74919"],
      ["longer than 6 months", "74919"],
      ["immediately", "74918"],
      ["immediate", "74918"],
      ["3 months", "74916"],
      ["6 months", "74917"],
      ["12 months", "74919"],
      ["as soon as possible", "74918"],
      ["asap", "74918"],
      ["now", "74918"],
      ["right now", "74918"],
      ["urgent", "74918"],
      ["not discussed", ""]
    ]);

    this.idToTextMap = new Map([
      ["74916", { en: "within the next 3 months", de: "in den nächsten 3 Monaten", category: "3–6 months" }],
      ["74917", { en: "within the next 6 months", de: "in den nächsten 6 Monaten", category: "6–12 months" }],
      ["74918", { en: "immediately", de: "sofort", category: "immediate" }],
      ["74919", { en: "longer than 6 months", de: "länger als 6 Monate", category: "12+ months" }],
      ["", { en: "not discussed", de: "nicht besprochen", category: "unknown" }]
    ]);

    this.timeUnits = {
      week: 0.25, weeks: 0.25,
      month: 1, months: 1,
      year: 12, years: 12,
      day: 0.033, days: 0.033,
      woche: 0.25, wochen: 0.25,
      monat: 1, monate: 1, monaten: 1,
      jahr: 12, jahre: 12, jahren: 12,
      tag: 0.033, tage: 0.033
    };

    this.immediateTerms = [
      "immediately", "immediate", "now", "asap", "as soon as possible",
      "sofort", "jetzt", "sofortig", "right now", "urgent", "dringend",
      "today", "heute", "this week", "diese woche"
    ];
  }

  /**
   * 🔹 Get BMBY field ID for given readiness/buy_plan_time text
   */
  getId(input: string): string | null {
    if (!input || typeof input !== "string") return null;

    const normalized = input.toLowerCase().trim();

    // ✅ Direct dictionary lookup first
    if (this.textToIdMap.has(normalized)) {
      return this.textToIdMap.get(normalized)! || null;
    }

    // ✅ Check for time-based phrase like "in 3 months" or "6 Monate"
    const months = this.parseTimeToMonths(normalized);
    if (months === null) return null;

    if (months < 3) return "74918";  // immediate
    if (months < 6) return "74916";  // 3 months
    if (months <= 12) return "74917"; // 6–12 months
    return "74919"; // longer
  }

  /**
   * 🔹 Reverse lookup — get readable text from ID
   */
  getText(id: string, lang: "en" | "de" = "en"): string {
    const mapping = this.idToTextMap.get(id);
    return mapping ? mapping[lang] : "Unknown";
  }

  /**
   * 🔹 Parse “3 months” / “6 Monate” / “1 year” → months
   */
  private parseTimeToMonths(input: string): number | null {
    if (this.immediateTerms.some(term => input.includes(term))) return 0;

    const patterns = [
      /(\d+(?:\.\d+)?)\s*(week|weeks|month|months|year|years|day|days|woche|wochen|monat|monate|monaten|jahr|jahre|jahren|tag|tage)/i,
      /(\d+(?:\.\d+)?)(week|weeks|month|months|year|years|day|days|woche|wochen|monat|monate|monaten|jahr|jahre|jahren|tag|tage)/i
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const multiplier = this.timeUnits[unit];
        if (multiplier) return value * multiplier;
      }
    }

    if (/^\d+(?:\.\d+)?$/.test(input)) return parseFloat(input);
    if (input.includes("half") && input.includes("year")) return 6;
    if (input.includes("quarter") && input.includes("year")) return 3;
    if (input.includes("halbes jahr")) return 6;

    return null;
  }
}

// ✅ Export singleton instance
export const purchaseReadinessMapper = new PurchaseReadinessMapper();
