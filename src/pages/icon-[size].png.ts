import type { APIRoute } from "astro";
import { iconPng, ICON_SIZES } from "../lib/icons";

/** `/icon-96.png`, `/icon-192.png` — the sizes the head declares for Google. */
export function getStaticPaths() {
  return ICON_SIZES.map((size) => ({ params: { size: String(size) }, props: { size } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await iconPng(props.size as number)), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800",
    },
  });
