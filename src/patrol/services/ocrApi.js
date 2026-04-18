import { supabase } from '../../lib/supabase';
import { compressImageForOcr } from '../utils/imageResize';
import { getPhotoTakenTime } from '../utils/exifReader';

export async function callMeterOcr(imageBase64, hintMachineType = null) {
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke('meter-ocr', {
    body: { image_base64: imageBase64, hint_machine_type: hintMachineType },
  });
  console.log('[OCR] 応答', Date.now() - t0, 'ms');
  if (error) throw error;
  return data;
}

/**
 * ファイルからEXIF時刻取得 → 圧縮 → OCR呼び出し
 * PatrolCameraPage / PatrolBatchOcrPage から使う統合関数
 */
export async function ocrFromFile(file, hintMachineType = null) {
  const tAll = Date.now();

  // EXIFは圧縮前に取る（圧縮後は消える）
  const exifTime = await getPhotoTakenTime(file).catch(() => null);

  const tCompress = Date.now();
  const { base64, sizeKB, originalSizeKB, width, height } =
    await compressImageForOcr(file);
  console.log(
    `[OCR] 圧縮 ${Date.now() - tCompress}ms  ${originalSizeKB}KB→${sizeKB}KB  ${width}x${height}`
  );

  const result = await callMeterOcr(base64, hintMachineType);

  console.log(`[OCR] 合計 ${Date.now() - tAll}ms`);
  return { ...result, exifTime };
}

export async function callMeterOcrBatch(files, concurrency = 3) {
  const results = [];
  const queue = files.map((f, i) => ({ file: f, index: i }));

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const result = await ocrFromFile(item.file);
        results.push({ file: item.file, result, status: 'success', index: item.index });
      } catch (err) {
        console.error(`[OCR Batch] ${item.index + 1} 失敗`, err);
        results.push({ file: item.file, error: err, status: 'error', index: item.index });
      }
    }
  }

  await Promise.all(Array(concurrency).fill(0).map(() => worker()));
  return results.sort((a, b) => a.index - b.index);
}
