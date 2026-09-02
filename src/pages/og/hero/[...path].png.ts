import type { APIRoute } from "astro";
import { ogCards, renderOgCard, type OgCard } from "../../../lib/og";

/**
 * `/og/hero/<slug>.png` — the in-page hero for each post.
 *
 * A separate route from `/og/<slug>.png` rather than a query parameter, because
 * this is a static build: a distinct path is a distinct file on disk, and a
 * query string would collapse both variants onto one file.
 *
 * Only blog posts get one. The static pages compose their own heroes in markup
 * and would gain nothing from a generated plate.
 */
export async function getStaticPaths() {
  const cards = await ogCards();
  return cards
    .filter((card) => card.id.startsWith("blog/"))
    .map((card) => ({ params: { path: card.id.replace(/^blog\//, "") }, props: { card } }));
}

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgCard(props.card as OgCard, "hero");

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
