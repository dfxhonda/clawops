/**
 * ClawOps 景品案内メール画像取込 (Google Apps Script)
 *
 * changegame.jp の Google Workspace にデプロイ。
 * SDY/INFからの新商品案内メールの添付画像を
 * Supabase Storageにアップロードし、prize_announcementsのimage_urlを更新。
 *
 * セットアップ:
 * 1. https://script.google.com/ で新規プロジェクト作成
 * 2. このコードを貼り付け
 * 3. 手動で一度 processNewEmails() を実行（権限承認）
 * 4. トリガー設定: processNewEmails を 15分おきに実行
 */

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs';
const BUCKET = 'announcements';

// 処理済みメールIDを記録するプロパティキー
const PROP_KEY = 'processed_message_ids';

/**
 * メイン: 新着メールを処理
 */
function processNewEmails() {
  const processed = getProcessedIds();
  const threads = GmailApp.search('from:info@sdy-co.com OR from:achieve.sakamoto@gmail.com has:attachment newer_than:7d', 0, 30);

  let count = 0;
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const msgId = msg.getId();
      if (processed.has(msgId)) continue;

      const attachments = msg.getAttachments();
      const imageAttachments = attachments.filter(a =>
        a.getContentType().startsWith('image/')
      );

      if (imageAttachments.length === 0) {
        processed.add(msgId);
        continue;
      }

      // 添付画像をアップロード
      for (const att of imageAttachments) {
        try {
          const fileName = sanitizeFilename(att.getName());
          const storagePath = msgId + '/' + fileName;
          const blob = att.copyBlob();
          const imageUrl = uploadToStorage(blob, storagePath, att.getContentType());

          if (imageUrl) {
            // source_refが一致するannouncementのimage_urlを更新
            updateAnnouncementImage(msgId, att.getName(), imageUrl);
            count++;
          }
        } catch (e) {
          Logger.log('Error uploading ' + att.getName() + ': ' + e.message);
        }
      }

      processed.add(msgId);
    }
  }

  saveProcessedIds(processed);
  Logger.log('Processed ' + count + ' images');
}

/**
 * Supabase Storageに画像をアップロード
 */
function uploadToStorage(blob, path, contentType) {
  const url = SB_URL + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(path);

  const options = {
    method: 'post',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    payload: blob.getBytes(),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code === 200 || code === 201) {
    // 公開URL
    return SB_URL + '/storage/v1/object/public/' + BUCKET + '/' + encodeURIComponent(path);
  } else {
    Logger.log('Storage upload failed (' + code + '): ' + response.getContentText());
    return null;
  }
}

/**
 * prize_announcementsのimage_urlを更新
 * source_refでメールIDが一致 + ファイル名で景品名に部分一致するレコードを探す
 */
function updateAnnouncementImage(messageId, fileName, imageUrl) {
  // まずsource_refで一致するレコードを取得
  const url = SB_URL + '/rest/v1/prize_announcements?source_ref=eq.' + messageId + '&image_url=is.null&select=id,prize_name';
  const options = {
    method: 'get',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return;

  const records = JSON.parse(response.getContentText());
  if (records.length === 0) return;

  // ファイル名から景品名の一部を抽出してマッチ
  const cleanName = fileName.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/[_\-]/g, '')
    .replace(/案内画像.*$/i, '')
    .replace(/ol.*min$/i, '')
    .trim();

  // ベストマッチを探す
  let bestMatch = null;
  let bestScore = 0;

  for (const rec of records) {
    const prizeName = (rec.prize_name || '').replace(/[\s　]/g, '');
    const score = calcMatchScore(cleanName, prizeName);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rec;
    }
  }

  // スコアが低くても1件しかなければそれに紐付け
  if (!bestMatch && records.length === 1) {
    bestMatch = records[0];
  }

  if (bestMatch && bestScore > 0) {
    // image_urlを更新
    const patchUrl = SB_URL + '/rest/v1/prize_announcements?id=eq.' + bestMatch.id;
    UrlFetchApp.fetch(patchUrl, {
      method: 'patch',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      payload: JSON.stringify({ image_url: imageUrl }),
      muteHttpExceptions: true,
    });
    Logger.log('Updated announcement #' + bestMatch.id + ' with image: ' + fileName);
  } else if (records.length === 1) {
    // 1件しかないならスコア関係なく紐付け
    const patchUrl = SB_URL + '/rest/v1/prize_announcements?id=eq.' + records[0].id;
    UrlFetchApp.fetch(patchUrl, {
      method: 'patch',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      payload: JSON.stringify({ image_url: imageUrl }),
      muteHttpExceptions: true,
    });
    Logger.log('Updated announcement #' + records[0].id + ' (only match) with image: ' + fileName);
  }
}

/**
 * 文字列の一致スコア計算
 */
function calcMatchScore(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;
  // トークン一致
  const tokensA = a.replace(/[()（）\[\]【】]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
  let hits = 0;
  for (const t of tokensA) {
    if (b.includes(t)) hits++;
  }
  return tokensA.length > 0 ? Math.round(60 * hits / tokensA.length) : 0;
}

/**
 * ファイル名をサニタイズ
 */
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F._-]/g, '_');
}

/**
 * 処理済みメールIDの読み込み
 */
function getProcessedIds() {
  const props = PropertiesService.getScriptProperties();
  const json = props.getProperty(PROP_KEY);
  return new Set(json ? JSON.parse(json) : []);
}

/**
 * 処理済みメールIDの保存（最新500件を保持）
 */
function saveProcessedIds(idSet) {
  const arr = Array.from(idSet).slice(-500);
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, JSON.stringify(arr));
}

/**
 * 手動実行: 全メールの画像を再処理（リセット用）
 */
function resetAndReprocess() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_KEY);
  processNewEmails();
}

/**
 * 手動実行: 特定メールの画像を処理
 */
function processSpecificEmail(messageId) {
  const msg = GmailApp.getMessageById(messageId);
  if (!msg) {
    Logger.log('Message not found: ' + messageId);
    return;
  }

  const attachments = msg.getAttachments();
  let count = 0;

  for (const att of attachments) {
    if (!att.getContentType().startsWith('image/')) continue;

    const fileName = sanitizeFilename(att.getName());
    const storagePath = messageId + '/' + fileName;
    const imageUrl = uploadToStorage(att.getBlob(), storagePath, att.getContentType());

    if (imageUrl) {
      updateAnnouncementImage(messageId, att.getName(), imageUrl);
      count++;
      Logger.log('Uploaded: ' + fileName + ' -> ' + imageUrl);
    }
  }

  Logger.log('Done. Processed ' + count + ' images from message ' + messageId);
}
