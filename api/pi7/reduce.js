import axios from "axios";
import * as cheerio from "cheerio";

const TARGET = "https://image.pi7.org/reduce-image-size-in-kb";

export default async function handler(req, res) {
  try {
    const { data: html } = await axios.get(TARGET, {
      headers: { "User-Agent": "Mozilla/5.0 KatheryneBot" }
    });

    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const h1 = $("h1").first().text().trim();
    const desc = $('meta[name="description"]').attr("content") || "";

    const fileInput = $("#files").attr("id") ? "#files" : null;
    const kbInput = $("#kbid").attr("id") ? "#kbid" : null;
    const reduceBtnText = $("#submit-button").text().trim() || "Reduce Size";

    const toolLinks = [];
    $(".navlinks a, .inlineflex a, .insildenavdiv a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (href && text) toolLinks.push({ text, href });
    });

    const heroImg =
      $('img[alt*="Reduce Image Size"]').attr("src") ||
      $('img[alt*="Reduce"]').attr("src") ||
      null;

    res.status(200).json({
      ok: true,
      scrapedFrom: TARGET,
      title,
      h1,
      description: desc,
      selectors: { fileInput, kbInput, reduceBtnText },
      heroImg,
      toolLinks: [...new Map(toolLinks.map(o => [o.href + "|" + o.text, o])).values()]
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
