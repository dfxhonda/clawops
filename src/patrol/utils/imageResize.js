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

  let blob;
  try {
    blob = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('canvas.toBlob timeout')), 10000);
      canvas.toBlob((b) => {
        clearTimeout(timer);
        if (b) resolve(b);
        else reject(new Error('canvas.toBlob returned null'));
      }, 'image/jpeg', quality);
    });
  } catch (err) {
    console.warn('[imageResize] canvas.toBlob失敗、FileReaderフォールバック:', err.message);
    blob = await fileToJpegBlob(file);
  }

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
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error(`loadImage timeout (HEIC?): ${file.name}`));
    }, 15000);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error(`loadImage failed: ${file.name}`));
    };
    img.src = url;
  });
}

/** HEIC等でloadImageが失敗した場合のフォールバック: 元ファイルをそのままBase64化 */
function fileToJpegBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result);
      resolve(new Blob([arr], { type: 'image/jpeg' }));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
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
