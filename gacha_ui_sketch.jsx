import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Camera, Lock, ArrowLeft, Check, AlertTriangle, RefreshCw } from 'lucide-react';

export default function GachaPatrolSketch() {
  const prev = { in: 14142, outA: 9632, outB: 4510 };

  const [inMeter, setInMeter] = useState(14284);
  const [outA, setOutA] = useState(9682);
  const [outB, setOutB] = useState(4602);

  const [showPrize, setShowPrize] = useState(false);
  const [prizeA] = useState({ name: 'ワールド', cost: 450, stock: 180 });
  const [prizeB] = useState({ name: '1000円カプ', cost: 150, stock: 190 });

  const diffIn = inMeter - prev.in;
  const diffA = outA - prev.outA;
  const diffB = outB - prev.outB;
  const totalOut = diffA + diffB;
  const match = diffIn === totalOut;
  const matchGap = Math.abs(diffIn - totalOut);

  const revenueA = diffA * prizeA.cost;
  const revenueB = diffB * prizeB.cost;
  const totalRevenue = revenueA + revenueB;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex justify-center">
      <div className="w-full max-w-[390px] min-h-screen bg-black">
        {/* ヘッダー */}
        <header className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <button className="p-1">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="border border-yellow-500 rounded-md px-2 py-0.5">
            <span className="text-yellow-400 font-mono text-xs">2026/04/23</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="border border-cyan-600 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded-full">ガチャ</span>
            <div className="text-right leading-tight">
              <div className="text-xs text-gray-200">2千円ガチャ</div>
              <div className="text-xs text-gray-300">B01 <span className="text-yellow-400">@1000</span></div>
            </div>
          </div>
        </header>

        {/* モードバナー + 前回情報 */}
        <div className="mx-3 mt-2 py-1.5 px-2 border border-green-600 bg-green-950/40 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="bg-green-500 text-white text-[10px] px-1 py-0.5 rounded font-bold">NEW</span>
            <span className="text-green-300 text-xs">新規巡回</span>
          </div>
          <span className="text-gray-300 text-xs font-mono">
            04/22: IN{prev.in} A{prev.outA} B{prev.outB}
          </span>
        </div>

        {/* IN(フル幅1行) */}
        <section className="mx-3 mt-2 bg-slate-800 rounded-lg p-2 border border-slate-600 flex items-center gap-2">
          <div className="w-7 h-7 bg-cyan-500 rounded flex items-center justify-center flex-shrink-0">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-100 flex-shrink-0">IN</span>
          <input
            type="number"
            value={inMeter}
            onChange={(e) => setInMeter(Number(e.target.value))}
            className="bg-gray-950 border border-gray-600 text-white text-lg font-mono rounded px-2 py-1 flex-1 min-w-0 text-right focus:border-cyan-400 outline-none"
          />
          <div className="text-right min-w-[50px] flex-shrink-0">
            <div className={`text-sm font-mono font-bold ${diffIn > 0 ? 'text-green-300' : diffIn < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {diffIn >= 0 ? '+' : ''}{diffIn}
            </div>
          </div>
        </section>

        {/* === OUT_A / OUT_B (左右 grid、4行構造) === */}
        <div className="mx-3 mt-1.5 grid grid-cols-2 gap-1.5">
          {/* OUT_A */}
          <section className="bg-slate-800 rounded-lg border-l-4 border-green-500 border-t border-r border-b border-slate-600 p-2">
            {/* 行1: ラベル / 差分 / 残数 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-300 font-bold">▲A</span>
              <span className={`font-mono font-bold ${diffA > 0 ? 'text-green-300' : 'text-gray-400'}`}>
                {diffA >= 0 ? '+' : ''}{diffA}
              </span>
              <span className="text-gray-200">残 <span className="font-mono">{prizeA.stock}</span></span>
            </div>
            {/* 行2: メーター入力 */}
            <input
              type="number"
              value={outA}
              onChange={(e) => setOutA(Number(e.target.value))}
              className="bg-gray-950 border border-gray-600 text-white text-base font-mono rounded px-1.5 py-1 w-full text-right focus:border-green-400 outline-none mt-1"
            />
            {/* 行3: 景品名 */}
            <div className="text-xs text-gray-100 truncate mt-1">{prizeA.name}</div>
            {/* 行4: @単価 / 売上 */}
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-yellow-400 font-mono">@{prizeA.cost}</span>
              <span className="text-cyan-300 font-mono font-semibold">¥{revenueA.toLocaleString()}</span>
            </div>
          </section>

          {/* OUT_B */}
          <section className="bg-slate-800 rounded-lg border-l-4 border-blue-500 border-t border-r border-b border-slate-600 p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-300 font-bold">▼B</span>
              <span className={`font-mono font-bold ${diffB > 0 ? 'text-green-300' : 'text-gray-400'}`}>
                {diffB >= 0 ? '+' : ''}{diffB}
              </span>
              <span className="text-gray-200">残 <span className="font-mono">{prizeB.stock}</span></span>
            </div>
            <input
              type="number"
              value={outB}
              onChange={(e) => setOutB(Number(e.target.value))}
              className="bg-gray-950 border border-gray-600 text-white text-base font-mono rounded px-1.5 py-1 w-full text-right focus:border-blue-400 outline-none mt-1"
            />
            <div className="text-xs text-gray-100 truncate mt-1">{prizeB.name}</div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-yellow-400 font-mono">@{prizeB.cost}</span>
              <span className="text-cyan-300 font-mono font-semibold">¥{revenueB.toLocaleString()}</span>
            </div>
          </section>
        </div>

        {/* 整合チェック + 売上(1行) */}
        <div className={`mx-3 mt-1.5 p-2 rounded-md border ${match ? 'border-green-600 bg-green-950/40' : 'border-yellow-600 bg-yellow-950/40'} flex items-center justify-between`}>
          <div className="flex items-center gap-1.5">
            {match ? (
              <Check className="w-4 h-4 text-green-300 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
            )}
            <span className={`text-xs font-semibold ${match ? 'text-green-300' : 'text-yellow-300'}`}>
              {match ? '整合OK' : `誤差${matchGap}`}
            </span>
            <span className="text-xs text-gray-300 font-mono">
              IN{diffIn >= 0 ? '+' : ''}{diffIn}=A+B={totalOut}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-200">売上</span>
            <span className="text-cyan-300 font-mono font-bold text-sm">¥{totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* 景品変更 + ロッカーバナーを左右に */}
        <div className="mx-3 mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setShowPrize(!showPrize)}
            className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-between"
          >
            <div className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-gray-300" />
              <span className="text-xs text-gray-200">景品変更</span>
            </div>
            {showPrize ? <ChevronUp className="w-3 h-3 text-gray-300" /> : <ChevronDown className="w-3 h-3 text-gray-300" />}
          </button>

          <div className="px-2 py-1.5 rounded-md border border-red-700 bg-red-950/40 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-300">ロッカー</span>
            </div>
            <span className="text-xs text-gray-200 font-mono">¥232,100</span>
          </div>
        </div>

        {showPrize && (
          <div className="mx-3 mt-1 p-2 rounded-md bg-slate-800 border border-slate-600 text-xs text-gray-200">
            展開時: A/B段の景品変更UI(入替時のみ)
          </div>
        )}

        {/* 保存ボタン */}
        <div className="mx-3 mt-3 mb-4">
          <button className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold">
            保存する
          </button>
        </div>

        {/* スケッチ注記 */}
        <div className="mx-3 mb-8 p-2 rounded-md bg-indigo-950/40 border border-indigo-700 text-xs text-indigo-100 leading-relaxed">
          <div className="font-bold text-indigo-200 mb-1">📝 v4: 4行構造+トーン明るく</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>各OUTカード: ラベル/差分/残数 → 入力 → 景品名 → @単価/売上</li>
            <li>文字サイズ統一: text-xs (12px)、入力欄のみ大</li>
            <li>ダークトーン明るく: gray-300 → gray-200、border も明るく</li>
            <li>背景 slate-900 → slate-800(コントラスト強め)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}