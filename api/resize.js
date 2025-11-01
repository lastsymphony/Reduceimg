// api/resize.js
import Busboy from "busboy";
import sharp from "sharp";
import path from "node:path";

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    try {
      const busboy = Busboy({ headers: req.headers });
      const fields = {};
      const files = [];

      busboy.on("field", (name, val) => { fields[name] = val; });
      busboy.on("file", (name, file, info) => {
        const chunks = [];
        file.on("data", (d) => chunks.push(d));
        file.on("end", () => {
          files.push({ fieldname: name, filename: info.filename, mime: info.mimeType, buffer: Buffer.concat(chunks) });
        });
      });
      busboy.on("error", reject);
      busboy.on("finish", () => resolve({ fields, files }));
      req.pipe(busboy);
    } catch (e) {
      reject(e);
    }
  });
}

function pickOutputFormat(inputMime, requested) {
  if (requested && requested !== "auto") return requested; // jpeg|png|webp|avif
  if (/png/i.test(inputMime)) return "png";
  if (/webp/i.test(inputMime)) return "webp";
  if (/avif/i.test(inputMime)) return "avif";
  return "jpeg";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST multipart/form-data" });
  }

  try {
    const { fields, files } = await parseMultipart(req);
    const file = files[0];
    if (!file?.buffer?.length) {
      return res.status(400).json({ ok: false, error: "file is required" });
    }

    // Params
    const preset = fields.preset || "1920";        // string: "original"|"4096"|...|"custom"
    const customWidth = parseInt(fields.width || "0", 10);
    const customHeight = parseInt(fields.height || "0", 10);
    const fit = fields.fit || "inside";            // inside|outside|cover|contain|fill
    const q = Math.max(1, Math.min(100, parseInt(fields.quality || "82", 10)));
    const fmt = pickOutputFormat(file.mime, (fields.format || "auto").toLowerCase());

    // Tentukan target dimensi
    let width = undefined, height = undefined;
    if (preset !== "original") {
      if (preset === "custom") {
        width = customWidth || undefined;
        height = customHeight || undefined;
      } else {
        width = parseInt(preset, 10) || undefined; // preset sebagai width target
      }
    }

    // Proses
    let pipeline = sharp(file.buffer, { animated: true }); // animated=true: kalau GIF/WebP animasi → hanya sebagian platform; output non-animated akan flatten
    pipeline = pipeline.resize({ width, height, fit, withoutEnlargement: true });

    // Terapkan format + quality
    if (fmt === "jpeg") pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
    if (fmt === "png")  pipeline = pipeline.png({ quality: q, compressionLevel: 9 });
    if (fmt === "webp") pipeline = pipeline.webp({ quality: q });
    if (fmt === "avif") pipeline = pipeline.avif({ quality: q });

    const outBuffer = await pipeline.toBuffer();
    const info = await sharp(outBuffer).metadata();

    // Penamaan file output
    const base = (file.filename || "image").replace(/\.[^.]+$/, "");
    const outName = `${base}_${info.width}x${info.height}_q${q}.${fmt}`;

    res.setHeader("Content-Type", `image/${fmt}`);
    res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
    res.setHeader("X-Image-Width", String(info.width || ""));
    res.setHeader("X-Image-Height", String(info.height || ""));
    res.setHeader("X-Image-Size", String(outBuffer.length));
    res.status(200).send(outBuffer);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
