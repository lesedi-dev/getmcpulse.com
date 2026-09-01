/**
 * `/og/<slug>.png` — one share card per page, written at build time.
 *
 * A route rather than twenty-eight committed PNGs. The cards are drawn from the
 * same front matter the page renders, so retitling a post retitles its card;
 * a folder of images would have gone stale the first time somebody edited a
 * headline, and nothing would have said so.
 *
 * The site is `output: "static"`, so these are files on disk after a build and
 * cost a crawler nothing to fetch.
 */

import type { APIRoute } from "astro";
import { ogCards, renderOgCard, type OgCard } from "../../lib/og";

export async function getStaticPaths() {
  return (await ogCards()).map((card) => ({ params: { path: card.id }, props: { card } }));
}

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgCard(props.card as OgCard);

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Immutable is safe: the file is rebuilt under the same name on deploy,
      // and Vercel's cache is keyed per deployment.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
