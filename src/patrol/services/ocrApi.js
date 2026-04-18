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
  console.log('[ocrFromFile] START', file?.name, file?.type, file?.size);

  const tAll = Date.now();

  // EXIFは圧縮前に取る（圧縮後は消える）
  const exifTime = await getPhotoTakenTime(file).catch((e) => {
    console.warn('[ocrFromFile] EXIF失敗', e?.message);
    return null;
  });
  console.log('[ocrFromFile] EXIF取得完了');

  const compressed = await compressImageForOcr(file);
  console.log(
    '[ocrFromFile] 圧縮完了',
    compressed?.compressed ? '圧縮成功' : 'フォールバック',
    `${compressed?.sizeKB}KB`
  );

  console.log('[ocrFromFile] Edge Function呼び出し開始');
  const result = await callMeterOcr(compressed.base64, hintMachineType);
  console.log('[ocrFromFile] OCR完了', Date.now() - tAll, 'ms');

  return { ...result, exifTime };
}

export async function callMeterOcrBatch(files, concurrency = 3) {
  const results = [];
  const queue = files.map((f, i) => ({ file: f, index: i }));

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      console.log(`[Batch Worker] 開始 ${item.index + 1}/${files.length}`);
      try {
        const result = await ocrFromFile(item.file);
        console.log(`[Batch Worker] 成功 ${item.index + 1}`);
        results.push({ file: item.file, result, status: 'success', index: item.index });
      } catch (err) {
        console.error(`[Batch Worker] 失敗 ${item.index + 1}`, err?.message || err);
        results.push({ file: item.file, error: err, status: 'error', index: item.index });
      }
    }
  }

  await Promise.all(Array(concurrency).fill(0).map(() => worker()));
  return results.sort((a, b) => a.index - b.index);
}
