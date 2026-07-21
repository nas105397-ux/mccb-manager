// MCCB 個別操作モーダル。停電/送電、子札貸出、管理者向けマスタ編集を扱う。
import { useMemo, useState } from "react";
import { useControlModalController } from "../hooks/useControlModalController";
import {
  createStatusMessage,
  STATUS_MESSAGE_KEYS,
} from "../shared/statusMessages";
import { formatWorkContent, formatWorkerName } from "../shared/mccbViewUtils";
import StatusMessageRail from "./StatusMessageRail";

// 送電/停電トグルボタンの配色。送電操作がブロックされている間はグレーアウトする。
const POWER_BUTTON_STYLES = {
  blocked: "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed opacity-60",
  powerOff: "bg-red-600 text-white border-red-700 hover:bg-red-700 cursor-pointer",
  powerOn: "bg-green-600 text-white border-green-700 hover:bg-green-700 cursor-pointer",
};

// ==========================================
// 1. メインコンポーネント (ControlModal)
// ==========================================
export default function ControlModal({
  mccb,
  requests = [],
  onClose,
  onUpdate,
  onUpdatePower,
  onUpdateRequestTargetCard = () => {},
  onDelete,
  isAdmin,
  rooms,
  categories,
}) {
  const {
    isPowerOff,
    room,
    setRoom,
    category,
    setCategory,
    name,
    setName,
    isSendingBlocked,
    modalMessage,
    setModalMessage,
    handleTogglePower,
    handleReturnCard,
    handleBorrowCard,
    handleSaveMaster,
  } = useControlModalController({ mccb, onUpdate, onUpdatePower });

  const temporarilyReturnedCardMap = useMemo(() => {
    const cardMap = new Map();
    requests.forEach((request) => {
      Object.entries(request.reservedCards || {}).forEach(([targetId, reserveInfo]) => {
        if (reserveInfo?.actualMccbId !== mccb.id || !reserveInfo?.cardNo) return;
        const card = mccb.childCards.find((childCard) => childCard.id === reserveInfo.cardNo);
        if (!card || card.isBorrowed) return;
        cardMap.set(reserveInfo.cardNo, {
          requestId: request.id,
          workerName: formatWorkerName(request.workerName),
          workContent: formatWorkContent(request.workContent),
          targetId,
        });
      });
    });
    return cardMap;
  }, [mccb.childCards, mccb.id, requests]);

  // --- 画面レンダリング ---
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >

        {/* 🔝 SECTION 1: モーダルヘッダー */}
        <div className="bg-gray-50 border-b p-4 flex justify-between items-center shrink-0">
          <div>
            <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md mr-2">
              {mccb.room}
            </span>
            <h2 className="text-base font-black text-gray-800 inline-block">
              {mccb.name} <span className="text-xs font-normal text-gray-500 font-mono">({mccb.id})</span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center text-3xl font-black cursor-pointer focus:outline-none"
            title="閉じる"
          >
            ×
          </button>
        </div>

        <StatusMessageRail
          message={modalMessage}
          onClose={() => setModalMessage(null)}
        />

        {/* 📜 モーダルボディ */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-gray-700">

          {/* ⚡ SECTION 2: 停電・送電ステータス切り替えトグル */}
          <div className="bg-gray-50 p-4 rounded-xl border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-gray-800">⚡ 設備停電ステータス</p>
              <p className="text-xs text-gray-400 mt-0.5">※依頼発行とは別に、主幹の開閉状態を直接操作ロックします</p>
              {isSendingBlocked && (
                <p className="text-xs text-orange-600 font-bold mt-1">
                  ⚠️ 未返却の子札があるため、送電操作はできません
                </p>
              )}
            </div>
            <button
              onClick={handleTogglePower}
              disabled={isSendingBlocked}
              title={isSendingBlocked ? "未返却の子札があるため送電できません" : undefined}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black border whitespace-nowrap ${
                isSendingBlocked
                  ? POWER_BUTTON_STYLES.blocked
                  : isPowerOff
                    ? POWER_BUTTON_STYLES.powerOff
                    : POWER_BUTTON_STYLES.powerOn
              }`}
            >
              {isPowerOff ? "🔴 現在：操作禁止（停電中）" : "🟢 現在：通常運用（送電中）"}
            </button>
          </div>

          {/* 🔖 SECTION 3: 子札マスタの個別管理エリア */}
          <div className="space-y-3">
            <h3 className="font-black text-gray-800 flex items-center gap-1.5 border-b pb-1">
              🔖 子札 貸出個別管理 <span className="text-xs font-normal text-gray-400">(全5枚)</span>
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {mccb.childCards.map((card) => (
                <CardRow
                  key={`${card.id}-${card.isBorrowed ? "borrowed" : "free"}-${temporarilyReturnedCardMap.has(card.id) ? "temp-returned" : "normal"}`}
                  card={card}
                  temporaryReturnInfo={temporarilyReturnedCardMap.get(card.id)}
                  onBorrow={(name) => handleBorrowCard(card.id, name)}
                  onBorrowTemporaryReturn={(temporaryReturnInfo) => {
                    onUpdateRequestTargetCard(
                      temporaryReturnInfo.requestId,
                      temporaryReturnInfo.targetId,
                      "borrow",
                    );
                    setModalMessage(
                      createStatusMessage(
                        STATUS_MESSAGE_KEYS.TEMPORARY_RETURN_CARD_BORROWED,
                        {
                          workerName: temporaryReturnInfo.workerName,
                          cardId: card.id,
                        },
                      ),
                    );
                  }}
                  onReturn={() => handleReturnCard(card.id)}
                />
              ))}
            </div>
          </div>

          {/* ⚙️ SECTION 4: 管理者専用：設備マスタ編集エリア */}
          {isAdmin && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-black text-red-700 text-xs tracking-wider uppercase border-b pb-1">
                🔒 管理者用：マスタ情報直接編集
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">設置エリア（電気室）</label>
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="border p-2 rounded text-sm w-full bg-gray-50"
                  >
                    {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">区分カテゴリ</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="border p-2 rounded text-sm w-full bg-gray-50"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">設備名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border p-2 rounded text-xs w-full bg-gray-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => onDelete(mccb.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-2 rounded-lg text-xs border border-red-200 cursor-pointer"
                >
                  🗑️ 設備マスタを完全削除
                </button>
                <button
                  onClick={handleSaveMaster}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-black px-5 py-2 rounded-lg text-xs cursor-pointer"
                >
                  💾 マスタ変更内容を保存
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. サブコンポーネント (CardRow)
// ==========================================
// 貸出中／一時返却中／保管中の3状態で、枠と No. バッジの配色をまとめて切り替える。
const CARD_STATE_STYLES = {
  borrowed: {
    container: "bg-amber-50/40 border-amber-200",
    badge: "bg-amber-600 text-white",
  },
  tempReturned: {
    container: "bg-sky-50/70 border-sky-200",
    badge: "bg-sky-600 text-white",
  },
  free: {
    container: "bg-gray-50/50 border-gray-200",
    badge: "bg-gray-200 text-gray-500",
  },
};

function CardRow({ card, temporaryReturnInfo, onBorrow, onBorrowTemporaryReturn, onReturn }) {
  const [inputName, setInputName] = useState("");
  const cardState = card.isBorrowed
    ? "borrowed"
    : temporaryReturnInfo
      ? "tempReturned"
      : "free";
  const { container, badge } = CARD_STATE_STYLES[cardState];

  return (
    <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${container}`}>
      <div className="flex items-center gap-2">
        <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-black ${badge}`}>
          No.{card.id}
        </span>
        {card.isBorrowed ? (
          <span className="font-black text-gray-800">
            👷 使用者: <span className="text-sm text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-black">{card.workerName}</span>
          </span>
        ) : temporaryReturnInfo ? (
          <span className="font-black text-sky-800">
            ↩️ 一時返却中: <span className="text-sm text-sky-900 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded font-black">{temporaryReturnInfo.workerName}</span>
            <span className="block text-[10px] text-sky-700 font-bold mt-0.5">作業名: {temporaryReturnInfo.workContent}</span>
          </span>
        ) : (
          <span className="text-gray-400 font-medium">保管中（フリー空き札）</span>
        )}
      </div>

      <div>
        {card.isBorrowed ? (
          <button
            onClick={onReturn}
            className="bg-white hover:bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded border border-gray-300 cursor-pointer"
          >
            ↩️ 札を返却（フリーに戻す）
          </button>
        ) : temporaryReturnInfo ? (
          <button
            onClick={() => onBorrowTemporaryReturn(temporaryReturnInfo)}
            className="bg-sky-600 hover:bg-sky-700 text-white font-black px-3 py-1.5 rounded cursor-pointer shadow-sm"
          >
            🔖 再貸出
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="手動使用者名"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="border p-1.5 rounded text-[11px] w-28 bg-white focus:outline-none"
            />
            <button
              onClick={() => onBorrow(inputName)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black px-3 py-1.5 rounded cursor-pointer"
            >
              🔖 貸出
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
