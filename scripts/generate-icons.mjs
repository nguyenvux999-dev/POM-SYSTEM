/**
 * Sinh bộ icon PWA: chạy `npm run icons` (hoặc `node scripts/generate-icons.mjs`).
 *
 * - Nếu có /public/logo-source.png VÀ đã cài `sharp` (npm i -D sharp):
 *   icon được sinh từ logo thật (icon maskable tự thêm ~20% vùng đệm an toàn).
 * - Nếu chưa có logo: sinh PLACEHOLDER chữ "LSX" trên nền xanh thương hiệu
 *   bằng PNG encoder thuần Node (không cần thư viện) — cần thay bằng logo
 *   thật trước khi đưa vào dùng chính thức (xem README).
 *
 * File sinh ra:
 *   public/icons/icon-192.png            (purpose any)
 *   public/icons/icon-512.png            (purpose any)
 *   public/icons/icon-maskable-512.png   (purpose maskable, có vùng đệm)
 *   app/apple-icon.png                   (180x180, iOS home screen)
 *   app/icon.png                         (64x64, favicon)
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const LOGO = path.join(ROOT, "public", "logo-source.png");
const ICONS_DIR = path.join(ROOT, "public", "icons");

/** Màu thương hiệu (trùng theme_color trong manifest). */
const BRAND = [0x1f, 0x3a, 0x6e, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];

/** Danh sách icon cần sinh: [đường dẫn, cỡ, tỉ lệ vùng nội dung]. */
const TARGETS = [
  [path.join(ICONS_DIR, "icon-192.png"), 192, 0.72],
  [path.join(ICONS_DIR, "icon-512.png"), 512, 0.72],
  // Maskable: nội dung gói trong ~60% giữa (đệm ~20% mỗi phía) để không bị
  // cắt khi hệ điều hành bo tròn/mask icon.
  [path.join(ICONS_DIR, "icon-maskable-512.png"), 512, 0.6],
  [path.join(ROOT, "app", "apple-icon.png"), 180, 0.72],
  [path.join(ROOT, "app", "icon.png"), 64, 0.8],
];

// ---------------------------------------------------------------------------
// PNG encoder thuần Node (đủ dùng cho ảnh RGBA không nén ngoài zlib)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Đóng gói buffer RGBA (width*height*4) thành file PNG. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA

  // Mỗi dòng thêm 1 byte filter (0 = none) trước dữ liệu pixel.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Placeholder: chữ "LSX" (font bitmap 5x7) trên nền xanh thương hiệu
// ---------------------------------------------------------------------------

const GLYPHS = {
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  X: ["X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"],
};

/** Vẽ placeholder cỡ `size`, chữ nằm trong `contentRatio` phần giữa. */
function drawPlaceholder(size, contentRatio) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set(BRAND, i * 4);

  const text = ["L", "S", "X"];
  const cols = text.length * 5 + (text.length - 1); // 5 cột/chữ + 1 cột cách
  const scale = Math.max(1, Math.floor((size * contentRatio) / cols));
  const textW = scale * cols;
  const textH = scale * 7;
  const x0 = Math.floor((size - textW) / 2);
  const y0 = Math.floor((size - textH) / 2);

  text.forEach((ch, index) => {
    const glyph = GLYPHS[ch];
    const gx = x0 + index * 6 * scale; // 5 cột chữ + 1 cột cách
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== "X") continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = gx + col * scale + dx;
            const py = y0 + row * scale + dy;
            rgba.set(WHITE, (py * size + px) * 4);
          }
        }
      }
    }
  });

  return encodePng(size, size, rgba);
}

// ---------------------------------------------------------------------------
// Sinh từ logo thật bằng sharp (nếu có)
// ---------------------------------------------------------------------------

async function generateFromLogo(sharp) {
  for (const [file, size, contentRatio] of TARGETS) {
    const content = Math.round(size * contentRatio);
    const logo = await sharp(LOGO)
      .resize(content, content, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer();

    // Đặt logo giữa nền trắng full-bleed (maskable nhờ contentRatio=0.6 mà
    // có sẵn vùng đệm an toàn; iOS không nhận alpha nên nền đặc là bắt buộc).
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: logo }])
      .png()
      .toFile(file);
    console.log(`✓ ${path.relative(ROOT, file)} (từ logo-source.png)`);
  }
}

function generatePlaceholders() {
  for (const [file, size, contentRatio] of TARGETS) {
    fs.writeFileSync(file, drawPlaceholder(size, contentRatio));
    console.log(`✓ ${path.relative(ROOT, file)} (placeholder "LSX")`);
  }
  console.log(
    '\n⚠ Đang dùng icon PLACEHOLDER. Để dùng logo thật: đặt ảnh vuông độ phân giải cao vào public/logo-source.png, chạy "npm i -D sharp" rồi chạy lại "npm run icons".',
  );
}

fs.mkdirSync(ICONS_DIR, { recursive: true });

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  // sharp chưa cài -> dùng placeholder
}

if (sharp && fs.existsSync(LOGO)) {
  await generateFromLogo(sharp);
} else {
  if (fs.existsSync(LOGO) && !sharp) {
    console.log(
      'Tìm thấy logo-source.png nhưng chưa cài sharp — chạy "npm i -D sharp" để sinh icon từ logo. Tạm sinh placeholder.',
    );
  }
  generatePlaceholders();
}
