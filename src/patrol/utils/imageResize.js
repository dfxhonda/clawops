// src/patrol/utils/imageResize.js

/**
 * OCR送信用に画像を圧縮する
 * - 長辺1600pxにリサイズ
 * - JPEG quality 0.82
 * - iOS Safari / HEIC / 巨大画像のフェイルセーフ付き
 * - 10秒でタイムアウト → 元画像のBase64にフォールバック
 */
export async function compressImageForOcr(file, maxEdge = 1600, quality = 0.82) {
  try {
    return await Promise.race([
      compressInternal(file, maxEdge, quality),
      timeoutFallback(file, 10000),
    ]);
  } catch (err) {
    console.warn('[imageResize] 圧縮失敗、元画像にフォールバック:', err);
    return fallbackNoCompress(file);
  }
}

async function compressInternal(file, maxEdge, quality) {
  const img = await loadImage(file);
  const { width, height } = scaleDown(img.width, img.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context取得失敗');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  if (!blob) throw new Error('canvas.toBlob が null を返した（HEIC疑い）');

  const base64 = await blobToBase64(blob);

  return {
    base64,
    width,
    height,
    sizeKB: Math.round(blob.size / 1024),
    originalSizeKB: Math.round(file.size / 1024),
    compressed: true,
  };
}

async function timeoutFallback(file, ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  throw new Error(`圧縮タイムアウト ${ms}ms`);
}

async function fallbackNoCompress(file) {
  const base64 = await blobToBase64(file);
  return {
    base64,
    width: null,
    height: null,
    sizeKB: Math.round(file.size / 1024),
    originalSizeKB: Math.round(file.size / 1024),
    compressed: false,
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    // onload/onerror が発火しないケースへの保険
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('画像デコードタイムアウト（HEIC疑い）'));
    }, 8000);

    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('画像デコード失敗: ' + (e?.message || 'unknown')));
    };
    img.src = url;
  });
}

function scaleDown(w, h, maxEdge) {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / Math.max(w, h);
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('canvas.toBlob returned null'));
          else resolve(blob);
        },
        type,
        quality
      );
    } catch (err) {
      reject(err);
    }
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) return reject(new Error('blob is null'));
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('reader.result not string'));
      const parts = result.split(',');
      resolve(parts[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
