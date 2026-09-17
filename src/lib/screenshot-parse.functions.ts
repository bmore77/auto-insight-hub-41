import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runScreenshotParse } from "./screenshot-parse.server";
import type { ParseResult } from "./screenshot-parse.types";

export type { ParsedRow, ParsedTable, ParseResult } from "./screenshot-parse.types";

/** Cap payload size so a single request cannot push huge images at the AI gateway. */
const MAX_IMAGE_CHARS = 12_000_000; // ~9MB decoded

const imageSchema = z
  .string()
  .min(20)
  .max(MAX_IMAGE_CHARS)
  .refine((value) => value.startsWith("data:image/"), {
    message: "Only image data URLs are accepted",
  });

const Input = z.object({
  /** Data URLs (data:image/png;base64,...) — one per screenshot. */
  images: z.array(imageSchema).min(1).max(6),
});

const SingleInput = z.object({ image: imageSchema });

/** Parse a set of screenshots that belong to the same report. Requires a signed-in user. */
export const parseScreenshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ParseResult> => runScreenshotParse(data.images));

/** Parse one screenshot on its own — used by the bulk import queue. Requires a signed-in user. */
export const parseScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SingleInput.parse(input))
  .handler(async ({ data }): Promise<ParseResult> => runScreenshotParse([data.image]));
