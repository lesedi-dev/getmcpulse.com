import type { APIRoute } from "astro";
import { iconPng, APPLE_TOUCH_SIZE } from "../lib/icons";

/**
 * `/apple-touch-icon.png`, at the path Safari asks for by name.
 *
 * iOS requests this URL whether or not the page declares it, so serving it at
 * the conventional path is what stops a home-screen bookmark falling back to a
 * screenshot of the page.
 */
export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await iconPng(APPLE_TOUCH_SIZE)), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800",
    },
  });
