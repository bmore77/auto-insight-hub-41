import type { ParseResult } from "./screenshot-parse.types";

const SYSTEM = `You read screenshots of Tableau dealership performance dashboards and return structured data.

Rules:
- Each screenshot may contain several tables side by side (e.g. "Lead Performance by Store", "Sales by Dealership", "Close Rate by Dealership").
- For every table, classify the metric as one of: "leads", "sales", "adSpend", "closeRate", "unknown".
- For every data row return the store/dealership name exactly as printed, the CURRENT period value and the PREVIOUS period value.
- Strip currency symbols, % signs, and thousands separators; return plain numbers. Percentages become a number out of 100 (e.g. 12.4% -> 12.4).
- For every row give "confidence": an integer 0-100 for how certain you are of the name AND both numbers (crisp, unambiguous text = 90-100; blurry, cropped, overlapping or guessed digits = below 70).
- For every row give "warnings": a short array of plain-English strings explaining anything uncertain (e.g. "previous value partially cut off"). Empty array when clean.
- If a value is unreadable, use null, lower the confidence and add a warning.
- If a report date or date range is printed anywhere, return "reportDate" as the END date of the period in yyyy-mm-dd, and "periodLabel" as the printed range text. Use null when no date is visible — never guess.
- Ignore totals/grand total rows.
- Do not invent stores or numbers.

Return ONLY minified JSON, no prose, no markdown fences, in this shape:
{"reportDate":string|null,"periodLabel":string|null,"tables":[{"metric":"leads","title":string,"rows":[{"name":string,"current":number|null,"previous":number|null,"confidence":number,"warnings":[string]}]}]}`;

const METRICS = ["leads", "sales", "adSpend", "closeRate"] as const;

const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function runScreenshotParse(images: string[]): Promise<ParseResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured for this project.");

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: "Extract every dealership performance table from these screenshots.",
    },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
  if (res.status === 402)
    throw new Error("AI credits exhausted — add credits in workspace settings.");
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Screenshot parsing failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: ParseResult;
  try {
    parsed = JSON.parse(cleaned) as ParseResult;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("Could not read a table from that screenshot. Try a sharper crop.");
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as ParseResult;
  }

  const warnings: string[] = [];
  const tables = (parsed.tables ?? [])
    .map((t) => ({
      metric: METRICS.includes(t.metric as never) ? t.metric : ("unknown" as const),
      title: t.title ?? "Untitled table",
      rows: (t.rows ?? [])
        .filter((r) => r && typeof r.name === "string" && r.name.trim())
        .map((r) => {
          const conf =
            typeof r.confidence === "number" && Number.isFinite(r.confidence)
              ? Math.max(0, Math.min(100, Math.round(r.confidence)))
              : 70;
          const rowWarnings = Array.isArray(r.warnings)
            ? r.warnings.filter((w): w is string => typeof w === "string" && !!w.trim())
            : [];
          const current = typeof r.current === "number" ? r.current : null;
          const previous = typeof r.previous === "number" ? r.previous : null;
          if (current === null) rowWarnings.push("Current value could not be read.");
          if (previous === null) rowWarnings.push("Previous value could not be read.");
          return {
            name: r.name.trim(),
            current,
            previous,
            confidence: current === null || previous === null ? Math.min(conf, 55) : conf,
            warnings: rowWarnings,
          };
        }),
    }))
    .filter((t) => t.rows.length > 0);

  if (tables.length === 0) warnings.push("No tables were detected in the upload.");
  for (const t of tables) {
    if (t.metric === "unknown") {
      warnings.push(`"${t.title}" — metric could not be identified; pick it manually.`);
    }
  }
  if (!isIsoDate(parsed.reportDate)) {
    warnings.push("No report date was visible — set the date manually.");
  }

  return {
    tables,
    periodLabel: typeof parsed.periodLabel === "string" ? parsed.periodLabel : null,
    reportDate: isIsoDate(parsed.reportDate) ? parsed.reportDate : null,
    warnings,
  };
}
