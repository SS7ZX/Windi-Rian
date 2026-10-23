import sharp from "sharp";
import { readdirSync } from "node:fs";

const files = readdirSync("raw").filter(f => /\.(jpe?g|png)$/i.test(f)).sort();
for (const [i, f] of files.entries()) {
  const out = `public/img/${String(i + 1).padStart(2, "0")}.webp`;
  await sharp(`raw/${f}`).rotate()
    .resize({ width: i === 0 ? 1280 : 900, withoutEnlargement: true })
    .webp({ quality: 72 }).toFile(out);
  console.log(f, "->", out);
}