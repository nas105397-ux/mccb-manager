import { useMemo } from 'react';

// 💡 Props に dummyNames = {} を追加して手動入力の代替名称を受け取れる状態を維持
export default function PrintPreviewForm({ workerName, workContent, selectedMccbIds, mccbList, requests = [], dummyNames = {} }) {
  // 🗓️ 日付・申請No用コードの算出
  const { now, dateCode } = useMemo(() => {
    const currentDate = new Date();
    const code = `${currentDate.getFullYear().toString().slice(-2)}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}${currentDate.getDate().toString().padStart(2, '0')}`;
    return { now: currentDate, dateCode: code };
  }, []);

  // 💡 バックエンド（useMccbData.js）の手動貸出回避ロジックと100%完全同期した精密計算シミュレーション
  const selectedMccbsWithAssignedCards = useMemo(() => {
    let simulatedMccbList = JSON.parse(JSON.stringify(mccbList));

    // 1. 過去の確定リクエストからすべての札の状態をマージ同期
    simulatedMccbList = simulatedMccbList.map(mccb => {
      const updatedCards = mccb.childCards?.map(card => {
        let isBorrowed = card.isBorrowed;
        let workerNameAttr = card.workerName;

        requests.forEach(req => {
          if (req.reservedCards) {
            Object.keys(req.reservedCards).forEach(tId => {
              const resInfo = req.reservedCards[tId];
              if (resInfo && resInfo.actualMccbId === mccb.id && resInfo.cardNo === card.id) {
                isBorrowed = true;
                workerNameAttr = req.workerName;
              }
            });
          }
        });
        return { ...card, isBorrowed, workerName: workerNameAttr };
      }) || [];
      return { ...mccb, childCards: updatedCards };
    });

    // 今回の印刷プレビューのループ内での仮確保状況を追跡するローカルコンテキスト
    const localReserved = {};

    return selectedMccbIds.map((id) => {
      const originalMccb = simulatedMccbList.find(m => m.id === id);
      if (!originalMccb) return null;

      let availableIdx = originalMccb.childCards?.findIndex(c => !c.isBorrowed) ?? -1;
      let finalTargetMccb = originalMccb;
      let isAllocatedFromDummy = false;
      
      // 判定：選択された設備自体が「ダミー設備」かどうか
      const isOriginalDummy = originalMccb.isDummy || originalMccb.name?.includes('ダミー');

      // 通常設備で空き札がない場合のみ、ダミースライド探索を実行
      if (availableIdx === -1 && !isOriginalDummy) {
        const dummyCandidates = simulatedMccbList.filter(m => 
          m.name?.includes('ダミー') || m.id?.includes('DUMMY') || m.isDummy
        );

        dummyCandidates.sort((a, b) => {
          const aSameRoom = a.room === originalMccb.room ? 1 : 0;
          const bSameRoom = b.room === originalMccb.room ? 1 : 0;
          if (aSameRoom !== bSameRoom) return bSameRoom - aSameRoom;
          return (a.name || '').localeCompare(b.name || '', 'ja');
        });

        let foundDummy = null;
        let dummyCardIdx = -1;

        for (const dummy of dummyCandidates) {
          let isOccupiedByOtherDevice = false;

          // ① 過去の確定リクエスト(requests)からの逆引き検証
          requests.forEach(req => {
            if (!req.reservedCards) return;
            Object.keys(req.reservedCards).forEach(origId => {
              const resInfo = req.reservedCards[origId];
              if (resInfo && resInfo.actualMccbId === dummy.id && origId !== id) {
                isOccupiedByOtherDevice = true;
              }
            });
          });

          // ② 今回の印刷プレビューのループ内で、既に「他の通常設備」へ割り当て済みかどうかの検証
          Object.keys(localReserved).forEach(origId => {
            const resInfo = localReserved[origId];
            if (resInfo && resInfo.actualMccbId === dummy.id && origId !== id) {
              isOccupiedByOtherDevice = true;
            }
          });

          // 💡 ③ 【新設完全同期】依頼履歴にない、ダッシュボード等での完全手動貸出や手動入力で使用中のダミー札を検知
          dummy.childCards?.forEach(card => {
            if (card.isBorrowed) {
              let isMyPastReservation = false;
              requests.forEach(req => {
                if (req.reservedCards && req.reservedCards[id]) {
                  const resInfo = req.reservedCards[id];
                  if (resInfo && resInfo.actualMccbId === dummy.id && resInfo.cardNo === card.id) {
                    isMyPastReservation = true;
                  }
                }
              });
              if (!isMyPastReservation) {
                isOccupiedByOtherDevice = true; // 自分用の過去予約でない貸出（＝完全手動の占有札）があればこのダミーを迂回
              }
            }
          });

          // 他設備占有、または手動操作で既に使用されているダミーは完全に除外してスキップ！
          if (isOccupiedByOtherDevice) continue;

          // 自分自身の設備による連続確保、または完全空き状態の場合のみ子札を確保
          const idx = dummy.childCards?.findIndex(c => !c.isBorrowed) ?? -1;
          if (idx !== -1) {
            foundDummy = dummy;
            dummyCardIdx = idx;
            break;
          }
        }

        // 例外フォールバック：同じ電気室内が全滅の場合、他電気室も含めて同様に手動貸出を厳密スクリーニング
        if (!foundDummy) {
          const allDummies = simulatedMccbList.filter(m => 
            m.name?.includes('ダミー') || m.id?.includes('DUMMY') || m.isDummy
          );
          allDummies.sort((a, b) => {
            if (a.name === 'ダミー0' && b.name !== 'ダミー0') return -1;
            if (a.name !== 'ダミー0' && b.name === 'ダミー0') return 1;
            return (a.name || '').localeCompare(b.name || '', 'ja');
          });

          for (const dummy of allDummies) {
            let isOccupiedByOtherDevice = false;

            requests.forEach(req => {
              if (!req.reservedCards) return;
              Object.keys(req.reservedCards).forEach(origId => {
                const resInfo = req.reservedCards[origId];
                if (resInfo && resInfo.actualMccbId === dummy.id && origId !== id) {
                  isOccupiedByOtherDevice = true;
                }
              });
            });

            Object.keys(localReserved).forEach(origId => {
              const resInfo = localReserved[origId];
              if (resInfo && resInfo.actualMccbId === dummy.id && origId !== id) {
                isOccupiedByOtherDevice = true;
              }
            });

            // フォールバック側でも手動操作札の厳密チェック
            dummy.childCards?.forEach(card => {
              if (card.isBorrowed) {
                let isMyPastReservation = false;
                requests.forEach(req => {
                  if (req.reservedCards && req.reservedCards[id]) {
                    const resInfo = req.reservedCards[id];
                    if (resInfo && resInfo.actualMccbId === dummy.id && resInfo.cardNo === card.id) {
                      isMyPastReservation = true;
                    }
                  }
                });
                if (!isMyPastReservation) {
                  isOccupiedByOtherDevice = true;
                }
              }
            });

            if (isOccupiedByOtherDevice) continue;

            const idx = dummy.childCards?.findIndex(c => !c.isBorrowed) ?? -1;
            if (idx !== -1) {
              foundDummy = dummy;
              dummyCardIdx = idx;
              break;
            }
          }
        }

        if (foundDummy) {
          finalTargetMccb = foundDummy;
          availableIdx = dummyCardIdx;
          isAllocatedFromDummy = true;
        }
      }

      let finalCardNo = 1;
      if (availableIdx !== -1 && finalTargetMccb.childCards) {
        // シミュレーション上の札状態をロックし、プレビュー内での仮確保履歴にマーク
        finalTargetMccb.childCards[availableIdx].isBorrowed = true;
        finalCardNo = finalTargetMccb.childCards[availableIdx].id;

        localReserved[id] = {
          actualMccbId: finalTargetMccb.id,
          cardNo: finalCardNo
        };
      }

      // 手動入力または自動代替された設備名称の美しく正確な結合
      let finalName = originalMccb.name;
      if (isOriginalDummy) {
        if (dummyNames[id]) {
          finalName = `${originalMccb.name} (${dummyNames[id]})`;
        }
      } else if (isAllocatedFromDummy) {
        finalName = `${finalTargetMccb.name} (${originalMccb.name})`;
      }

      const cardLabel = isAllocatedFromDummy 
        ? `代替:${finalTargetMccb.name} No.${finalCardNo}` 
        : `子札 No.${finalCardNo}`;
        
      const generatedCardNo = `${dateCode}-${finalTargetMccb.id.slice(-4)}-${finalCardNo}`;

      return {
        ...originalMccb,
        name: finalName,
        cardLabel,
        generatedCardNo,
        isDummy: isAllocatedFromDummy || isOriginalDummy,
        allocatedDummyName: finalTargetMccb.name
      };
    }).filter(Boolean);
  }, [selectedMccbIds, mccbList, requests, dateCode, dummyNames]);

  return (
    /* 💡 画面サイズ構造をそのまま維持するための外枠クラス 
        print:w-[80mm] print:p-0 print:border-0 を指定することで、
        印刷の瞬間だけレシート幅に完全自動変形します。幅58mmのプリンタでもブラウザ側が自動縮小フィットしてくれます。
    */
    <div className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:border-0 print:shadow-none print:p-0 print:w-[78mm] print:mx-auto">
      
      {/* レシート外枠：モノクロかつ高コントラストな現場専用デザイン */}
      <div className="border border-gray-300 p-4 space-y-4 text-black bg-white print:border-0 print:p-1 font-mono text-xs">
        
        {/* 🔝 レシートヘッダー */}
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <h1 className="text-base font-black tracking-tighter">操作禁止（停電）依頼表</h1>
          <p className="text-[9px] text-gray-500 print:text-black mt-0.5">※作業終了後、管理室へ返却</p>
          <div className="flex justify-between text-[10px] mt-2 border-t border-dashed border-gray-400 pt-1">
            <span>日: {now.getFullYear()}/{(now.getMonth()+1)}/{now.getDate()}</span>
            <span>No: REQ-{dateCode}</span>
          </div>
        </div>

        {/* 👷 責任者・内容情報 */}
        <div className="space-y-1 bg-gray-50 p-2 rounded border print:bg-transparent print:border-black">
          <p className="text-[10px] font-bold text-gray-500">【作業責任者】</p>
          <p className="text-sm font-black pl-1">{workerName || '（未入力）'}</p>
          <p className="text-[10px] font-bold text-gray-500 mt-1">【作業内容】</p>
          <p className="text-xs pl-1 leading-tight whitespace-pre-wrap">{workContent || '（未入力）'}</p>
        </div>

        {/* 📊 停電対象設備サマリーリスト */}
        <div className="border-t border-black pt-2">
          <p className="text-[10px] font-black mb-1">▼ 停電対象設備一覧</p>
          <div className="space-y-1 border-b border-black pb-2">
            {selectedMccbsWithAssignedCards.length === 0 ? (
              <p className="text-gray-400 text-center py-2">設備が未選択です。</p>
            ) : (
              selectedMccbsWithAssignedCards.map((mccb, index) => (
                <div key={`${mccb.id}-${index}`} className="flex justify-between items-start text-[11px] py-0.5 border-b border-dashed border-gray-200 last:border-0">
                  <span className="font-bold truncate max-w-[200px]">
                    {index + 1}. {mccb.name}
                  </span>
                  <span className="font-black shrink-0 text-right bg-gray-100 px-1 rounded print:bg-transparent">
                    {mccb.cardLabel.replace('代替:', '⚡')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ✂️ 切り取り式 現物ポケット子札エリア */}
        {selectedMccbsWithAssignedCards.length > 0 && (
          <div className="space-y-4 pt-2">
            {selectedMccbsWithAssignedCards.map((mccb, index) => (
              <div key={`${mccb.id}-ticket-${index}`} className="space-y-1">
                
                {/* ミシン目（切り取り線）デザイン */}
                <div className="text-center text-[9px] font-bold text-gray-400 print:text-black tracking-widest my-2 select-none">
                  ✂️ - - - - - - - - - - - - - - -
                </div>

                {/* 現場のポケットに差し込む実物カード本体 */}
                <div className="border-2 border-black p-2.5 bg-white space-y-1 flex flex-col justify-between rounded shadow-sm print:shadow-none min-h-[120px] page-break-inside-avoid">
                  <div className="flex justify-between items-center border-b border-black pb-0.5">
                    <span className="font-black bg-black text-white px-1 rounded text-[9px] tracking-tighter">
                      {mccb.isDummy ? '操作禁止 (代替札使用)' : '操作禁止 (子札)'}
                    </span>
                    <span className="font-bold font-mono text-[9px]">({index + 1}/{selectedMccbsWithAssignedCards.length})</span>
                  </div>

                  <div className="py-1">
                    <p className="text-[9px] text-gray-500">【場所】{mccb.room}</p>
                    <p className="font-black text-xs leading-tight text-black break-words">{mccb.name}</p>
                  </div>

                  <div className="border-t border-dashed border-gray-400 pt-1 flex justify-between items-end text-[10px]">
                    <div>
                      <p className="text-[8px] text-gray-400 font-bold">責任者</p>
                      <p className="font-black text-black text-xs truncate max-w-[80px]">{workerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-black bg-gray-200 px-1 py-0.5 rounded text-[10px] inline-block border border-gray-400">
                        {mccb.cardLabel}
                      </p>
                      <p className="font-mono text-gray-500 text-[8px] mt-0.5 tracking-tighter">{mccb.generatedCardNo}</p>
                    </div>
                  </div>
                </div>

              </div>
            ))}
            
            {/* レシート最下部のマージン（オートカット対応用） */}
            <div className="text-center text-[9px] font-bold text-gray-400 print:text-black tracking-widest my-2 select-none border-t border-black pt-2">
              ▲ ─── 印刷終了 ─── ▲
            </div>
            <div className="h-8 print:h-12"></div>
          </div>
        )}

      </div>
    </div>
  );
}