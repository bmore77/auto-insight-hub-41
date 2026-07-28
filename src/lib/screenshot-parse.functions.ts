import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  /** Data URLs (data:image/png;base64,...) — one per screenshot. */
  images: z.array(z.string().min(20)).min(1).max(6),
});

export type ParsedRow = {
  name: string;
  current: number | null;
  previous: number | null;
  confidence: "high" | "low";
};

export type ParsedTable = {
  metric: "leads" | "sales" | "adSpend" | "closeRate" | "unknown";
  title: string;
  rows: ParsedRow[];
};

export type ParseResult = {
  tables: ParsedTable[];
  periodLabel: string | null;
  warnings: string[];
};

const SYSTEM = `You read screenshots of Tableau dealership performance dashboards and return structured data.

Rules:
- Each screenshot may contain several tables side by side (e.g. "Lead Performance by Store", "Sales by Dealership", "Close Rate by Dealership").
- For every table, classify the metric as one of: "leads", "sales", "adSpend", "closeRate", "unknown".
- For every data row return the store/dealership name exactly as printed, the CURRENT period value and the PREVIOUS period value.
- Strip currency symbols, % signs, and thousands separators; return plain numbers. Percentages become a number out of 100 (e.g. 12.4% -> 12.4).
- If a value is unreadable, use null and mark the row confidence "low". Otherwise "high".
- Ignore totals/grand total rows.
- Do not invent stores or numbers.

Return ONLY minified JSON, no prose, no markdown fences, in this shape:
{"periodLabel":string|null,"tables":[{"metric":"leads","title":string,"rows":[{"name":string,"current":number|null,"previous":number|null,"confidence":"high"|"low"}]}]}`;

export const parseScreenshots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ParseResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured for this project.");

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: "Extract every dealership performance table from these screenshots.",
      },
      ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits in workspace settings.");
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
        metric: (["leads", "sales", "adSpend", "closeRate"] as const).includes(
          t.metric as never,
        )
          ? t.metric
          : ("unknown" as const),
        title: t.title ?? "Untitled table",
        rows: (t.rows ?? [])
          .filter((r) => r && typeof r.name === "string" && r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            current: typeof r.current === "number" ? r.current : null,
            previous: typeof r.previous === "number" ? r.previous : null,
            confidence: r.confidence === "low" ? ("low" as const) : ("high" as const),
          })),
      }))
      .filter((t) => t.rows.length > 0);

    if (tables.length === 0) warnings.push("No tables were detected in the upload.");
    for (const t of tables) {
      if (t.metric === "unknown") {
        warnings.push(`"${t.title}" — metric could not be identified; pick it manually.`);
      }
    }

    return { tables, periodLabel: parsed.periodLabel ?? null, warnings };
  });
