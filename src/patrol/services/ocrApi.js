// src/patrol/services/ocrApi.js
import { supabase } from '../../lib/supabase';

export async function callMeterOcr(imageBase64, hintMachineType = null) {
  console.log('[OCR] 送信開始 base64 length:', imageBase64.length);
  console.log('[OCR] 推定画像サイズ MB:', (imageBase64.length * 0.75 / 1024 / 1024).toFixed(2));

  const t0 = Date.now();

  // タイムアウト付きで呼ぶ（60秒で強制中断）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('[OCR] タイムアウト60秒');
    controller.abort();
  }, 60000);

  try {
    const { data, error } = await supabase.functions.invoke('meter-ocr', {
      body: { image_base64: imageBase64, hint_machine_type: hintMachineType },
    });

    clearTimeout(timeoutId);
    console.log('[OCR] 応答時間 ms:', Date.now() - t0);
    console.log('[OCR] error:', error);
    console.log('[OCR] data:', data);

    if (error) {
      // FunctionsHttpError等の中身を詳しく見る
      console.error('[OCR] error詳細:', JSON.stringify(error, null, 2));
      if (error.context) {
        const body = await error.context.text?.();
        console.error('[OCR] Function応答本文:', body);
      }
      throw error;
    }

    if (!data) {
      throw new Error('[OCR] dataがnull。Edge Functionが空レスポンス返してる');
    }
    if (typeof data !== 'object' || !data.meters) {
      throw new Error(`[OCR] 不正なレスポンス形式: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[OCR] 例外:', err);
    throw err;
  }
}

export async function callMeterOcrBatch(files, concurrency = 3) {
  const results = [];
  const queue = files.map((f, i) => ({ file: f, index: i }));

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        console.log(`[OCR Batch] ${item.index + 1}/${files.length} 開始`);
        const base64 = await fileToBase64(item.file);
        const result = await callMeterOcr(base64);
        results.push({ file: item.file, result, status: 'success', index: item.index });
      } catch (err) {
        console.error(`[OCR Batch] ${item.index + 1}/${files.length} 失敗:`, err);
        results.push({ file: item.file, error: err, status: 'error', index: item.index });
      }
    }
  }

  await Promise.all(Array(concurrency).fill(0).map(() => worker()));
  return results.sort((a, b) => a.index - b.index);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
