import type { APIRoute } from "astro";
import { faviconIco } from "../lib/icons";

/**
 * `/favicon.ico` — a real one this time.
 *
 * A route rather than a file in `public/`, because the file that was in
 * `public/` was a PNG named `.ico` and nothing on the site could tell. This is
 * built from the same SVG as every other size on each build.
 */
export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await faviconIco()), {
    headers: {
      "Content-Type": "image/x-icon",
      // A week rather than a year: a favicon is one of the few assets whose URL
      // must never change, so it cannot be cache-busted by renaming it.
      "Cache-Control": "public, max-age=604800",
    },
  });
