// api/scrape.js
import * as cheerio from "cheerio";

/**
 * Pemakaian:
 *  - /api/scrape?url=https://example.com&format=json
 *  - /api/scrape?url=https://example.com&format=html
 *
 * Tanpa "url" akan pakai DEFAULT_URL.
 * Tanpa "format" akan default "json".
 * Tidak ada penyimpanan permanen (no GitHub, no DB). Hasil dikembalikan langsung.
 */

const DEFAULT_URL = "https://example.com"; // Ubah kalau mau default target lain

export default async function handler(req, res) {
  try {
    const url = (req.query.url || DEFAULT_URL).toString();
    const format = (req.query.format || "json").toString().toLowerCase();

    // Ambil halaman target
    const r = await fetch(url, {
      headers: { "User-Agent": "kath-scraper/1.0 (+vercel)" },
      // Boleh tambahkan headers lain jika perlu bypass
    });
    if (!r.ok) {
      res.status(r.status).json({ ok: false, error: `Fetch failed ${r.status}`, url });
      return;
    }
    const html = await r.text();

    // Cache di edge/CDN agar irit request (optional)
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    if (format === "html") {
      // Kembalikan HTML mentah
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
      return;
    }

    // Parse ringan pakai Cheerio untuk mode JSON
    const $ = cheerio.load(html);
    const title = $("title").first().text().trim();

    const images = $("img")
      .map((_, el) => $(el).attr("src"))
      .get()
      .filter(Boolean);

    const links = $("a")
      .map((_, el) => ({
        href: $(el).attr("href"),
        text: $(el).text().trim(),
      }))
      .get();

    const data = {
      ok: true,
      scraped_at: new Date().toISOString(),
      target: url,
      title,
      images,
      links_count: links.length,
      links,
    };

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
