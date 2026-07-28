/** Shared, client-safe types for Tableau screenshot parsing. */

export type ParsedRow = {
  name: string;
  current: number | null;
  previous: number | null;
  /** 0–100 model confidence for this row's values. */
  confidence: number;
  /** Row-level notes from the model (glare, truncation, ambiguous digits…). */
  warnings: string[];
};

export type ParsedTable = {
  metric: "leads" | "sales" | "adSpend" | "closeRate" | "unknown";
  title: string;
  rows: ParsedRow[];
};

export type ParseResult = {
  tables: ParsedTable[];
  periodLabel: string | null;
  /** yyyy-mm-dd read off the screenshot, when the date is visible. */
  reportDate: string | null;
  warnings: string[];
};
