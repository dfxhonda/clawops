import { useEffect, useRef } from 'react'
import NumpadField from './NumpadField'
import Tooltip from './Tooltip'
import PrizeNameAutocomplete from './PrizeNameAutocomplete'

export const EMPTY_TOUCHED = {
  inMeter: false, outMeter1: false, outMeter2: false, outMeter3: false,
  stock: false, restock: false,
  stock2: false, restock2: false, stock3: false, restock3: false,
  prizeName: false, prizeCost: false,
  prizeName2: false, prizeCost2: false,
  prizeName3: false, prizeCost3: false,
  setA: false, setC: false, setL: false, setR: false, setO: false,
}

export const ALL_TOUCHED = Object.fromEntries(Object.keys(EMPTY_TOUCHED).map(k => [k, true]))

function CompactCell({
  ttId, ttContent, label,
  fieldId, value, onChange, onTouched,
  allowDecimal = false, dataTabindex,
  inputClassName, onNext, testId, inputPlaceholder, onRegister,
  isActive = false, className = '',
}) {
  const cellRef = useRef(null)
  useEffect(() => {
    if (isActive) cellRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isActive])
  return (
    <div ref={cellRef} className={`flex flex-row items-center gap-1 p-1 rounded transition-all duration-200 ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${className}`}>
      <div className={`shrink-0 ${isActive ? '[&_button]:text-blue-600' : ''}`}>
        <Tooltip id={ttId} content={ttContent} label={label} />
      </div>
      <div className="flex-1 min-w-0">
        <NumpadField
          id={fieldId}
          value={value}
          onChange={v => { onTouched?.(); onChange(v) }}
          label={label}
          allowDecimal={allowDecimal}
          dataTabindex={dataTabindex}
          inputClassName={isActive ? '' : (inputClassName ?? '')}
          onNext={onNext}
          testId={testId ?? fieldId}
          inputPlaceholder={inputPlaceholder}
          style={{ fontSize: 16, width: '100%' }}
          onRegister={onRegister}
          isActive={isActive}
        />
      </div>
    </div>
  )
}

const TT = {
  in_meter:     '機械正面のINメーター数値、左から大きい桁。集金時に必ず読む。',
  out_meter:    '機械正面のOUTメーター数値。景品が落ちた回数の累計。',
  prize_stock:  'ブース内に残ってる景品の個数。今数えた数。',
  prize_restock:'今回追加で入れた景品の個数。0なら空欄でOK。',
  prize_name:   '景品マスタから候補が出る。新景品は手入力で追加。',
  prize_cost:   '景品 1個あたりの仕入れ価格(円)。景品マスタ選択で自動入る。',
  set_a:        'クレーン爪の力。数値で記録。',
  set_c:        'コア設定。数値で記録。',
  set_l:        '左側設定。数値で記録。',
  set_r:        '右側設定。数値で記録。',
  set_o:        '自由メモ。何でも書いてOK、書かなくてもOK。',
  collection:   '集金日のみ表示。チェックすると集金記録として保存される。',
  diff:         '前回保存値からの差分。上段=IN差分(集金額相当)、下段=OUT差分(出回数)。打ち間違い検知用。',
}

function diffDisplay(diff) {
  if (diff === null) return { text: '--', cls: 'text-gray-400' }
  if (diff === 0)    return { text: '0',  cls: 'text-gray-400' }
  if (diff > 0)      return { text: `+${diff}`, cls: 'text-green-600' }
  return               { text: String(diff),  cls: 'text-red-600' }
}

export { diffDisplay }

// field row wrapper (active highlight)
function FRow({ tab, active, children }) {
  return (
    <div className={`rounded transition-all duration-200 ${active ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
      {children}
    </div>
  )
}

// prize row used per OUT section
function PrizeRow({ prizeName, setPrize, prizeCost, setCost, selectedPrizeId, setSelectedPrizeId, touch, touched, costTouchKey, prizeNameTouchKey, costTabindex, activeTabindex, navigateNext, registerField }) {
  return (
    <div className="flex gap-1 p-1 border-b border-border">
      <div className="flex-[4] min-w-0 flex flex-row items-center gap-1 p-1">
        <div className="shrink-0"><Tooltip id={`tt-pn-${costTabindex}`} content={TT.prize_name} label="景" /></div>
        <div className="flex-1 min-w-0">
          <PrizeNameAutocomplete
            value={prizeName}
            onChange={v => {
              touch?.(prizeNameTouchKey)()
              setPrize(v)
              setSelectedPrizeId?.(null)
            }}
            onSelect={({ prize_id, prize_name, original_cost }) => {
              setPrize(prize_name)
              setSelectedPrizeId?.(prize_id)
              setCost(original_cost != null ? String(original_cost) : '')
              touch?.(prizeNameTouchKey)()
              touch?.(costTouchKey)()
            }}
            placeholder="前回値から補完（変更時のみ差分送信）"
            fieldId={`field-prize-name-${costTabindex}`}
            testId={`field-prize-name-${costTabindex}`}
          />
        </div>
      </div>
      <CompactCell
        className="flex-[1] min-w-0"
        ttId={`tt-cost-${costTabindex}`} ttContent={TT.prize_cost} label="@"
        fieldId={`field-prize-cost-${costTabindex}`} value={prizeCost} onChange={setCost} onTouched={touch?.(costTouchKey)}
        allowDecimal={false} dataTabindex={costTabindex}
        testId={`field-prize-cost-${costTabindex}`}
        inputPlaceholder=""
        inputClassName={!touched?.[costTouchKey] ? 'text-gray-400' : ''}
        onNext={() => navigateNext?.(costTabindex)}
        onRegister={registerField}
        isActive={activeTabindex === costTabindex}
      />
    </div>
  )
}

export default function BoothInputForm({
  mode = 'patrol',
  outMeterCount = 1,
  inMeter, setIn,
  outMeter1, setOut1,
  outMeter2, setOut2,
  outMeter3, setOut3,
  stock, setStk,
  restock, setRst,
  stock2, setStk2,
  restock2, setRst2,
  stock3, setStk3,
  restock3, setRst3,
  prizeName, setPrize,
  prizeCost, setCost,
  prizeName2, setPrize2,
  prizeCost2, setCost2,
  prizeName3, setPrize3,
  prizeCost3, setCost3,
  setA, setSetA,
  setC, setSetC,
  setL, setSetL,
  setR, setSetR,
  setO, setSetO,
  selectedPrizeId, setSelectedPrizeId,
  selectedPrizeId2, setSelectedPrizeId2,
  selectedPrizeId3, setSelectedPrizeId3,
  touched, touch,
  isCollectionDay, isCollection, setIsColl,
  entryType,
  inDiffDisp, outDiffDisp,
  navigateNext, registerField, activeTabindex,
  canSave, saving, result, onSave,
  onDelete, deleting,
  onOCR,
}) {
  const isEditMode = mode === 'edit'
  const outFields = [
    { key: 'outMeter1', val: outMeter1, set: setOut1, tab: 2, id: 'field-out-meter' },
    { key: 'outMeter2', val: outMeter2, set: setOut2, tab: 3, id: 'field-out-meter-2' },
    { key: 'outMeter3', val: outMeter3, set: setOut3, tab: 4, id: 'field-out-meter-3' },
  ].slice(0, outMeterCount)

  const inDiff  = inDiffDisp  ?? diffDisplay(null)
  const outDiff = outDiffDisp ?? diffDisplay(null)

  const pf = { touch, touched, navigateNext, registerField, activeTabindex }

  return (
    <div data-testid="booth-input-upper">
      <div className="bg-surface/30 rounded-2xl mx-4 border border-border overflow-hidden">

        {/* ===== edit mode: compact grid ===== */}
        {isEditMode ? (
          <div data-testid="meter-row" className="grid grid-cols-2 gap-x-2 gap-y-1 p-2 border-b border-border">
            <CompactCell
              className="w-full min-w-[7ch]"
              ttId="tt-field-in-meter" ttContent={TT.in_meter} label="IN"
              fieldId="field-in-meter" value={inMeter} onChange={setIn} onTouched={touch?.('inMeter')}
              allowDecimal dataTabindex={1}
              inputClassName={!touched?.inMeter ? 'text-gray-400' : ''}
              onNext={() => navigateNext?.(1)}
              onRegister={registerField}
              isActive={activeTabindex === 1}
            />
            <CompactCell
              className="w-full min-w-[7ch]"
              ttId="tt-field-out-meter" ttContent={TT.out_meter} label={outMeterCount > 1 ? 'OUT1' : 'OUT'}
              fieldId="field-out-meter" value={outMeter1} onChange={setOut1} onTouched={touch?.('outMeter1')}
              allowDecimal dataTabindex={2}
              inputClassName={!touched?.outMeter1 ? 'text-gray-400' : ''}
              onNext={() => navigateNext?.(2)}
              onRegister={registerField}
              isActive={activeTabindex === 2}
            />
            {outMeterCount > 1 && (
              <CompactCell
                className="w-full min-w-[7ch]"
                ttId="tt-field-out-meter-2" ttContent={TT.out_meter} label="OUT2"
                fieldId="field-out-meter-2" value={outMeter2} onChange={setOut2} onTouched={touch?.('outMeter2')}
                allowDecimal dataTabindex={3}
                inputClassName={!touched?.outMeter2 ? 'text-gray-400' : ''}
                onNext={() => navigateNext?.(3)}
                onRegister={registerField}
                isActive={activeTabindex === 3}
              />
            )}
            <div className="flex flex-row items-center gap-2 px-2 py-1 min-w-[7ch]">
              <div className="shrink-0"><Tooltip id="tt-field-diff" content={TT.diff} label="差" /></div>
              <div data-testid="diff-cell" className="flex flex-col items-end flex-1 min-h-[2rem]">
                <div data-testid="in-diff"  className={`font-mono text-xs font-bold ${inDiff.cls}`}>{inDiff.text}</div>
                <div data-testid="out-diff" className={`font-mono text-xs font-bold ${outDiff.cls}`}>{outDiff.text}</div>
              </div>
            </div>
            {outMeterCount > 2 && (
              <CompactCell
                className="w-full min-w-[7ch]"
                ttId="tt-field-out-meter-3" ttContent={TT.out_meter} label="OUT3"
                fieldId="field-out-meter-3" value={outMeter3} onChange={setOut3} onTouched={touch?.('outMeter3')}
                allowDecimal dataTabindex={4}
                inputClassName={!touched?.outMeter3 ? 'text-gray-400' : ''}
                onNext={() => navigateNext?.(4)}
                onRegister={registerField}
                isActive={activeTabindex === 4}
              />
            )}
            <CompactCell
              className="w-full min-w-[7ch]"
              ttId="tt-field-stock" ttContent={TT.prize_stock} label="残"
              fieldId="field-stock" value={stock} onChange={setStk} onTouched={touch?.('stock')}
              dataTabindex={5}
              inputClassName={!touched?.stock ? 'text-gray-400' : ''}
              onNext={() => navigateNext?.(5)}
              onRegister={registerField}
              isActive={activeTabindex === 5}
            />
            <CompactCell
              className="w-full min-w-[7ch]"
              ttId="tt-field-restock" ttContent={TT.prize_restock} label="補"
              fieldId="field-restock" value={restock} onChange={setRst} onTouched={touch?.('restock')}
              dataTabindex={6}
              inputClassName={!touched?.restock ? 'text-gray-400' : ''}
              onNext={() => navigateNext?.(6)}
              onRegister={registerField}
              isActive={activeTabindex === 6}
            />
          </div>

        ) : (

          /* ===== patrol mode: 2-line label+field layout ===== */
          <>
            {/* OUT1 section */}
            <div data-testid="meter-row" className="border-b border-border">
              <div
                className="grid px-2 pt-2 pb-0.5 gap-x-1 text-xs font-bold text-muted"
                style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr' }}
              >
                <span>IN</span>
                <span>{outMeterCount > 1 ? 'OUT1' : 'OUT'}</span>
                <span>残</span>
                <span>補</span>
              </div>
              <div
                className="grid px-1 pb-1 gap-x-1"
                style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr' }}
              >
                <FRow tab={1} active={activeTabindex === 1}>
                  <NumpadField id="field-in-meter" value={inMeter}
                    onChange={v => { touch?.('inMeter')(); setIn(v) }}
                    label="IN" allowDecimal dataTabindex={1}
                    inputClassName={!touched?.inMeter ? 'text-gray-400' : ''}
                    onNext={() => navigateNext?.(1)} onRegister={registerField} isActive={activeTabindex === 1}
                    style={{ fontSize: 16, width: '100%' }} testId="field-in-meter" />
                </FRow>
                <FRow tab={2} active={activeTabindex === 2}>
                  <NumpadField id="field-out-meter" value={outMeter1}
                    onChange={v => { touch?.('outMeter1')(); setOut1(v) }}
                    label={outMeterCount > 1 ? 'OUT1' : 'OUT'} allowDecimal dataTabindex={2}
                    inputClassName={!touched?.outMeter1 ? 'text-gray-400' : ''}
                    onNext={() => navigateNext?.(2)} onRegister={registerField} isActive={activeTabindex === 2}
                    style={{ fontSize: 16, width: '100%' }} testId="field-out-meter" />
                </FRow>
                <FRow tab={5} active={activeTabindex === 5}>
                  <NumpadField id="field-stock" value={stock}
                    onChange={v => { touch?.('stock')(); setStk(v) }}
                    label="残" dataTabindex={5}
                    inputClassName={!touched?.stock ? 'text-gray-400' : ''}
                    onNext={() => navigateNext?.(5)} onRegister={registerField} isActive={activeTabindex === 5}
                    style={{ fontSize: 16, width: '100%' }} testId="field-stock" />
                </FRow>
                <FRow tab={6} active={activeTabindex === 6}>
                  <NumpadField id="field-restock" value={restock}
                    onChange={v => { touch?.('restock')(); setRst(v) }}
                    label="補" dataTabindex={6}
                    inputClassName={!touched?.restock ? 'text-gray-400' : ''}
                    onNext={() => navigateNext?.(6)} onRegister={registerField} isActive={activeTabindex === 6}
                    style={{ fontSize: 16, width: '100%' }} testId="field-restock" />
                </FRow>
              </div>
            </div>

            {/* Prize row 1 */}
            <PrizeRow
              prizeName={prizeName} setPrize={setPrize}
              prizeCost={prizeCost} setCost={setCost}
              selectedPrizeId={selectedPrizeId} setSelectedPrizeId={setSelectedPrizeId}
              prizeNameTouchKey="prizeName" costTouchKey="prizeCost" costTabindex={8}
              {...pf}
            />

            {/* OUT2 section */}
            {outMeterCount >= 2 && (
              <>
                <div className="border-b border-border">
                  <div
                    className="grid px-2 pt-1.5 pb-0.5 gap-x-1 text-xs font-bold text-muted"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
                  >
                    <span>OUT2</span>
                    <span>残</span>
                    <span>補</span>
                  </div>
                  <div
                    className="grid px-1 pb-1 gap-x-1"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
                  >
                    <FRow tab={3} active={activeTabindex === 3}>
                      <NumpadField id="field-out-meter-2" value={outMeter2}
                        onChange={v => { touch?.('outMeter2')(); setOut2(v) }}
                        label="OUT2" allowDecimal dataTabindex={3}
                        inputClassName={!touched?.outMeter2 ? 'text-gray-400' : ''}
                        onNext={() => navigateNext?.(3)} onRegister={registerField} isActive={activeTabindex === 3}
                        style={{ fontSize: 16, width: '100%' }} testId="field-out-meter-2" />
                    </FRow>
                    <FRow tab={15} active={activeTabindex === 15}>
                      <NumpadField id="field-stock-2" value={stock2 ?? ''}
                        onChange={v => { touch?.('stock2')(); setStk2?.(v) }}
                        label="残2" dataTabindex={15}
                        inputClassName={!touched?.stock2 ? 'text-gray-400' : ''}
                        onNext={() => navigateNext?.(15)} onRegister={registerField} isActive={activeTabindex === 15}
                        style={{ fontSize: 16, width: '100%' }} testId="field-stock-2" />
                    </FRow>
                    <FRow tab={16} active={activeTabindex === 16}>
                      <NumpadField id="field-restock-2" value={restock2 ?? ''}
                        onChange={v => { touch?.('restock2')(); setRst2?.(v) }}
                        label="補2" dataTabindex={16}
                        inputClassName={!touched?.restock2 ? 'text-gray-400' : ''}
                        onNext={() => navigateNext?.(16)} onRegister={registerField} isActive={activeTabindex === 16}
                        style={{ fontSize: 16, width: '100%' }} testId="field-restock-2" />
                    </FRow>
                  </div>
                </div>
                <PrizeRow
                  prizeName={prizeName2 ?? ''} setPrize={setPrize2 ?? (() => {})}
                  prizeCost={prizeCost2 ?? ''} setCost={setCost2 ?? (() => {})}
                  selectedPrizeId={selectedPrizeId2} setSelectedPrizeId={setSelectedPrizeId2}
                  prizeNameTouchKey="prizeName2" costTouchKey="prizeCost2" costTabindex={17}
                  {...pf}
                />
              </>
            )}

            {/* OUT3 section */}
            {outMeterCount >= 3 && (
              <>
                <div className="border-b border-border">
                  <div
                    className="grid px-2 pt-1.5 pb-0.5 gap-x-1 text-xs font-bold text-muted"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
                  >
                    <span>OUT3</span>
                    <span>残</span>
                    <span>補</span>
                  </div>
                  <div
                    className="grid px-1 pb-1 gap-x-1"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
                  >
                    <FRow tab={4} active={activeTabindex === 4}>
                      <NumpadField id="field-out-meter-3" value={outMeter3}
                        onChange={v => { touch?.('outMeter3')(); setOut3(v) }}
                        label="OUT3" allowDecimal dataTabindex={4}
                        inputClassName={!touched?.outMeter3 ? 'text-gray-400' : ''}
                        onNext={() => navigateNext?.(4)} onRegister={registerField} isActive={activeTabindex === 4}
                        style={{ fontSize: 16, width: '100%' }} testId="field-out-meter-3" />
                    </FRow>
                    <FRow tab={18} active={activeTabindex === 18}>
                      <NumpadField id="field-stock-3" value={stock3 ?? ''}
                        onChange={v => { touch?.('stock3')(); setStk3?.(v) }}
                        label="残3" dataTabindex={18}
                        inputClassName={!touched?.stock3 ? 'text-gray-400' : ''}
                        onNext={() => navigateNext?.(18)} onRegister={registerField} isActive={activeTabindex === 18}
                        style={{ fontSize: 16, width: '100%' }} testId="field-stock-3" />
                    </FRow>
                    <FRow tab={19} active={activeTabindex === 19}>
                      <NumpadField id="field-restock-3" value={restock3 ?? ''}
                        onChange={v => { touch?.('restock3')(); setRst3?.(v) }}
                        label="補3" dataTabindex={19}
                        inputClassName={!touched?.restock3 ? 'text-gray-400' : ''}
                        onNext={() => navigateNext?.(19)} onRegister={registerField} isActive={activeTabindex === 19}
                        style={{ fontSize: 16, width: '100%' }} testId="field-restock-3" />
                    </FRow>
                  </div>
                </div>
                <PrizeRow
                  prizeName={prizeName3 ?? ''} setPrize={setPrize3 ?? (() => {})}
                  prizeCost={prizeCost3 ?? ''} setCost={setCost3 ?? (() => {})}
                  selectedPrizeId={selectedPrizeId3} setSelectedPrizeId={setSelectedPrizeId3}
                  prizeNameTouchKey="prizeName3" costTouchKey="prizeCost3" costTabindex={20}
                  {...pf}
                />
              </>
            )}
          </>
        )}

        {/* Prize row 1 (edit mode only — patrol mode uses PrizeRow above) */}
        {isEditMode && (
          <div className="flex gap-1 p-1 border-b border-border">
            <div className="flex-[4] min-w-0 flex flex-row items-center gap-1 p-1">
              <div className="shrink-0"><Tooltip id="tt-field-prize-name" content={TT.prize_name} label="景" /></div>
              <div className="flex-1 min-w-0">
                <PrizeNameAutocomplete
                  value={prizeName}
                  onChange={v => {
                    touch?.('prizeName')()
                    setPrize(v)
                    setSelectedPrizeId?.(null)
                  }}
                  onSelect={({ prize_id, prize_name, original_cost }) => {
                    setPrize(prize_name)
                    setSelectedPrizeId?.(prize_id)
                    setCost(original_cost != null ? String(original_cost) : '')
                    touch?.('prizeName')()
                    touch?.('prizeCost')()
                  }}
                  placeholder="前回値から補完（変更時のみ差分送信）"
                  fieldId="field-prize-name"
                  testId="field-prize-name"
                />
              </div>
            </div>
            <CompactCell
              className="flex-[1] min-w-0"
              ttId="tt-field-prize-cost" ttContent={TT.prize_cost} label="@"
              fieldId="field-prize-cost" value={prizeCost} onChange={setCost} onTouched={touch?.('prizeCost')}
              allowDecimal={false} dataTabindex={8}
              testId="field-prize-cost"
              inputPlaceholder=""
              inputClassName={!touched?.prizeCost ? 'text-gray-400' : ''}
              onNext={() => navigateNext?.(8)}
              onRegister={registerField}
              isActive={activeTabindex === 8}
            />
          </div>
        )}

        {/* Row: 設定ACLR + O */}
        <div className="flex gap-1 p-1 border-b border-border">
          {[
            { tab: 9,  id: 'field-set-a', testId: 'field-set-a', label: 'A', val: setA, set: setSetA, touchKey: 'setA'  },
            { tab: 10, id: 'field-set-c', testId: 'field-set-c', label: 'C', val: setC, set: setSetC, touchKey: 'setC'  },
            { tab: 11, id: 'field-set-l', testId: 'field-set-l', label: 'L', val: setL, set: setSetL, touchKey: 'setL'  },
            { tab: 12, id: 'field-set-r', testId: 'field-set-r', label: 'R', val: setR, set: setSetR, touchKey: 'setR'  },
          ].map(f => (
            <div
              key={f.id}
              className={`flex-1 min-w-0 rounded transition-all duration-200${activeTabindex === f.tab ? ' ring-2 ring-blue-500 bg-blue-50' : ''}`}
            >
              <NumpadField
                id={f.id}
                value={f.val}
                onChange={v => { touch?.(f.touchKey)(); f.set(v) }}
                label={f.label}
                dataTabindex={f.tab}
                testId={f.testId}
                inputPlaceholder={f.label}
                inputClassName={!touched?.[f.touchKey] ? 'text-gray-400' : ''}
                onNext={() => navigateNext?.(f.tab)}
                onRegister={registerField}
                isActive={activeTabindex === f.tab}
                style={{ fontSize: 16, width: '100%', padding: '0.1em 0.35em' }}
              />
            </div>
          ))}
          <div className={`flex-[6] min-w-0 rounded transition-all duration-200${activeTabindex === 13 ? ' ring-2 ring-blue-500 bg-blue-50' : ''}`}>
            <input
              id="field-set-o"
              type="text"
              inputMode="text"
              data-testid="field-set-o"
              data-tabindex={13}
              value={setO}
              onChange={e => { touch?.('setO')(); setSetO(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); navigateNext?.(13) } }}
              placeholder="メモ"
              style={{
                cursor: 'text',
                border: activeTabindex === 13 ? '1px solid #3b82f6' : '1px solid #2a2a44',
                background: activeTabindex === 13 ? '#eff6ff' : '#0a0a14',
                borderRadius: 4,
                padding: '0.1em 0.35em',
                fontFamily: "'Courier New', Courier, monospace",
                fontWeight: 'bold',
                textAlign: 'right',
                outline: 'none',
                boxSizing: 'border-box',
                WebkitAppearance: 'none',
                fontSize: 16,
                width: '100%',
                ...(activeTabindex === 13 ? { color: '#1e3a5f' } : {}),
              }}
            />
          </div>
        </div>

        {/* 集金 row (patrol mode only) */}
        {mode === 'patrol' && isCollectionDay && (
          <div
            data-testid="collection-checkbox-label"
            className="flex items-center gap-3 p-2 border-b border-border"
          >
            <Tooltip id="tt-collection" content={TT.collection} label="集" />
            <input
              data-testid="collection-checkbox"
              type="checkbox"
              checked={isCollection}
              onChange={e => setIsColl(e.target.checked)}
              className="w-5 h-5 accent-blue-500"
            />
            {isCollection && <span className="text-base text-blue-400">集金記録として保存</span>}
          </div>
        )}

        {/* ボタン行 */}
        <div className="px-4 py-1 flex gap-2">
          {mode === 'edit' && onDelete && (
            <button
              data-testid="delete-button"
              onClick={onDelete}
              disabled={deleting}
              className="px-4 py-4 rounded-2xl font-bold text-base border border-red-500 text-red-400 bg-transparent active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {deleting ? '削除中...' : '削除'}
            </button>
          )}
          {onOCR && (
            <button
              type="button"
              onClick={onOCR}
              className="w-1/4 py-4 rounded-2xl font-bold text-base text-sky-300 bg-sky-500/10 border border-sky-400/30 active:scale-[0.98] transition-all flex items-center justify-center"
            >
              📷
            </button>
          )}
          <button
            data-testid="save-button"
            data-tabindex={14}
            onClick={onSave}
            disabled={!canSave || saving}
            className={`flex-1 py-4 rounded-2xl font-bold text-base transition-all ${
              canSave && !saving
                ? 'bg-accent text-bg active:scale-[0.98]'
                : 'bg-surface text-muted opacity-40'
            }`}
          >
            {saving
              ? '保存中...'
              : result === 'saved'
              ? '✓ 保存しました'
              : result === 'skipped'
              ? '変化なし — 戻ります'
              : result === 'conflict'
              ? '⚠ 競合 — 再読み込み'
              : result === 'error'
              ? 'エラー — 再試行'
              : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}
