/**
 * OCR送信用に画像を圧縮する
 * - 長辺1600pxにリサイズ
 * - JPEG quality 0.82
 * - 結果をBase64で返す
 * - オリジナルEXIFは別途読んでから呼ぶこと（リサイズでEXIFは消える）
 */
export async function compressImageForOcr(file, maxEdge = 1600, quality = 0.82) {
  const img = await loadImage(file);
  const { width, height } = scaleDown(img.width, img.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );

  const base64 = await blobToBase64(blob);

  return {
    base64,
    width,
    height,
    sizeKB: Math.round(blob.size / 1024),
    originalSizeKB: Math.round(file.size / 1024),
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
