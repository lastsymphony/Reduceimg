import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const {
  GITHUB_TOKEN,       // token classic/fine-grained dengan repo:contents
  GITHUB_OWNER,       // ex: "Lastsymp" atau username kamu
  GITHUB_REPO,        // ex: "vercel-github-scraper"
  TARGET_URL,         // URL yang mau di-scrape (wajib)
  JSON_PATH = "data/hasil.json",
  HTML_PATH = "data/hasil.html",
  COMMITTER_NAME = "kath-bot",
  COMMITTER_EMAIL = "bot@lastsymp.biz.id"
} = process.env;

const GH_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

async function putFile(path, content, message) {
  // Cek sha dulu jika file sudah ada
  const getRes = await fetch(`${GH_API}/${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'kath-scraper' }
  });
  let sha = undefined;
  if (getRes.status === 200) {
    const j = await getRes.json();
    sha = j.sha;
  }

  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    committer: { name: COMMITTER_NAME, email: COMMITTER_EMAIL },
    ...(sha ? { sha } : {})
  };

  const putRes = await fetch(`${GH_API}/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'kath-scraper',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`GitHub PUT failed (${putRes.status}): ${txt}`);
  }
  return putRes.json();
}

export default async function handler(req, res) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !TARGET_URL) {
      return res.status(400).json({ ok: false, error: 'Missing ENV: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, TARGET_URL' });
    }

    // 1) Fetch halaman target
    const page = await fetch(TARGET_URL, { headers: { 'User-Agent': 'kath-scraper/1.0' } });
    if (!page.ok) {
      return res.status(502).json({ ok: false, error: `Fetch failed ${page.status}` });
    }
    const html = await page.text();

    // 2) Parse dengan Cheerio — contoh: ambil <title>, semua <img>, semua link <a>
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    const images = $('img').map((_, el) => $(el).attr('src')).get().filter(Boolean);
    const links  = $('a').map((_, el) => ({ href: $(el).attr('href'), text: $(el).text().trim() })).get();

    const payload = {
      scraped_at: new Date().toISOString(),
      target: TARGET_URL,
      title,
      images,
      links_count: links.length,
      links
    };

    // 3) Simpan JSON ke repo
    await putFile(JSON_PATH, JSON.stringify(payload, null, 2), `chore(scrape): update ${JSON_PATH}`);

    // 4) Simpan HTML mentah juga (opsional, buat preview)
    await putFile(HTML_PATH, html, `chore(scrape): update ${HTML_PATH}`);

    return res.status(200).json({ ok: true, saved: [JSON_PATH, HTML_PATH], title, images: images.length, links: links.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
