import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runScreenshotParse } from "./screenshot-parse.server";
import type { ParseResult } from "./screenshot-parse.types";

export type { ParsedRow, ParsedTable, ParseResult } from "./screenshot-parse.types";

const Input = z.object({
  /** Data URLs (data:image/png;base64,...) — one per screenshot. */
  images: z.array(z.string().min(20)).min(1).max(6),
});

const SingleInput = z.object({ image: z.string().min(20) });

/** Parse a set of screenshots that belong to the same report. */
export const parseScreenshots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ParseResult> => runScreenshotParse(data.images));

/** Parse one screenshot on its own — used by the bulk import queue. */
export const parseScreenshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SingleInput.parse(input))
  .handler(async ({ data }): Promise<ParseResult> => runScreenshotParse([data.image]));
