import axios from "axios";
import * as cheerio from "cheerio";

/**
 * GET /api/pi7/download?url=https://image.pi7.org/download-compress-image/en
 */
export default async function handler(req, res) {
  try {
    const url =
      (req.query.url && decodeURIComponent(req.query.url)) ||
      "https://image.pi7.org/download-compress-image/en";

    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 KatheryneBot" }
    });

    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const h1 = $("h1").first().text().trim();

    const items = [];
    $("#imgList li").each((_, li) => {
      const name = $(li).find(".imgxname").text().trim();
      const sizeText = $(li).find(".FileNameCaptionStyle").text().trim();
      const m = sizeText.match(/(\d+)\s*Kb/i);
      const sizeKb = m ? parseInt(m[1], 10) : null;
      const downloadUrl = $(li).find("a.downbtn").attr("href") || null;
      const preview = $(li).find("img.thumb").attr("src") || null;
      if (name || downloadUrl) items.push({ name, sizeKb, downloadUrl, preview });
    });

    const deleteAvailable = $(".delbtn").length > 0;

    res.status(200).json({
      ok: true,
      scrapedFrom: url,
      title,
      h1,
      count: items.length,
      items,
      deleteAvailable
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
