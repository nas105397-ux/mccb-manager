// 発行中・仮発行・履歴の依頼一覧。設備追加や一時返却もここから操作する。
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRequestBarcodeScanner } from "../hooks/useRequestBarcodeScanner";
import { useRequestListController } from "../hooks/useRequestListController";
import { useRequestListPrintController } from "../hooks/useRequestListPrintController";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";
import { createActiveDummyUsageMap } from "../shared/mccbViewUtils";
import {
  createStatusMessage,
  STATUS_MESSAGE_KEYS,
} from "../shared/statusMessages";
import PrintableRequestForm from "./PrintableRequestForm";
import StatusMessageRail from "./StatusMessageRail";
import ActiveRequestSection from "./requestList/ActiveRequestSection";
import DraftRequestSection from "./requestList/DraftRequestSection";
import HistoryRequestSection from "./requestList/HistoryRequestSection";
import { UI } from "./requestList/requestListStyles";

export default function RequestListPanel({
  requests = [],
  draftRequests = [],
  requestHistory = [],
  historyPageInfo = { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  mccbList = [],
  onDeleteRequest,
  onIssueDraftRequest = () => {},
  onDeleteDraftRequest = () => {},
  onUpdateDraftRequest = () => {},
  onUpdateRequest = () => {},
  onAddTargetsToRequest = () => {},
  onReturnRequestTargets = () => {},
  onUpdateRequestTargetCard = () => {},
  onChangeHistoryPage = () => {},
  requestPrintMode = REQUEST_PRINT_MODES.NONE,
}) {
  const [activeView, setActiveView] = useState("active");
  const [addPanelRequestId, setAddPanelRequestId] = useState(null);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [selectedAddIds, setSelectedAddIds] = useState([]);
  const [addDummyNames, setAddDummyNames] = useState({});
  const [returnPanelRequestId, setReturnPanelRequestId] = useState(null);
  const [selectedReturnIds, setSelectedReturnIds] = useState([]);
  const [editPanelRequestId, setEditPanelRequestId] = useState(null);
  const navigate = useNavigate();
  const [listMessage, setListMessage] = useState(null);
  const { activeRequestViews, draftRequestViews, historyRequestViews, toggleExpand } =
    useRequestListController({
      requests,
      draftRequests,
      requestHistory,
      mccbList,
    });

  // 設備追加でダミーを選ぶときも、依頼作成画面と同じ発行中の注記と代替名の引き継ぎを出す。
  const activeDummyUsageMap = useMemo(
    () => createActiveDummyUsageMap(requests, mccbList),
    [requests, mccbList],
  );

  const {
    printRequest,
    starPrintRequestId,
    isPrintDisabledBySetting,
    handlePrintRequest,
  } = useRequestListPrintController({
    requestPrintMode,
    mccbList,
    onStatusMessage: setListMessage,
  });

  useRequestBarcodeScanner({
    activeRequestViews,
    historyRequestViews,
    onCompleteRequest: onDeleteRequest,
  });

  const openAddPanel = (requestId) => {
    setListMessage(null);
    setAddPanelRequestId((currentId) => (currentId === requestId ? null : requestId));
    setAddSearchTerm("");
    setSelectedAddIds([]);
    setAddDummyNames({});
    // 追加と返却のパネルが同時に開くと対象を取り違えるため、片方だけ開く。
    setReturnPanelRequestId(null);
    setSelectedReturnIds([]);
    setEditPanelRequestId(null);
  };

  const toggleAddTarget = (mccbId, prefillDummyName = "") => {
    setSelectedAddIds((prev) =>
      prev.includes(mccbId)
        ? prev.filter((id) => id !== mccbId)
        : [...prev, mccbId],
    );
    if (prefillDummyName) {
      setAddDummyNames((prev) =>
        prev[mccbId] ? prev : { ...prev, [mccbId]: prefillDummyName },
      );
    }
  };

  const setAddDummyName = (mccbId, value) => {
    setAddDummyNames((prev) => ({ ...prev, [mccbId]: value }));
  };

  const openReturnPanel = (requestId) => {
    setListMessage(null);
    setReturnPanelRequestId((currentId) =>
      currentId === requestId ? null : requestId,
    );
    setSelectedReturnIds([]);
    setAddPanelRequestId(null);
    setAddSearchTerm("");
    setSelectedAddIds([]);
    setAddDummyNames({});
    setEditPanelRequestId(null);
  };

  const openEditPanel = (requestId) => {
    setListMessage(null);
    setEditPanelRequestId((currentId) =>
      currentId === requestId ? null : requestId,
    );
    setAddPanelRequestId(null);
    setReturnPanelRequestId(null);
  };

  const toggleReturnTarget = (mccbId) => {
    setSelectedReturnIds((prev) =>
      prev.includes(mccbId)
        ? prev.filter((id) => id !== mccbId)
        : [...prev, mccbId],
    );
  };

  const handleAddTargets = (requestId) => {
    if (selectedAddIds.length === 0) {
      alert("追加する設備を選択してください。");
      return;
    }

    // 選択中の設備ぶんだけ代替名を送り、外した設備の入力は残さない。
    const dummyNames = Object.fromEntries(
      selectedAddIds
        .filter((id) => addDummyNames[id])
        .map((id) => [id, addDummyNames[id]]),
    );
    onAddTargetsToRequest(requestId, selectedAddIds, dummyNames);
    setAddPanelRequestId(null);
    setAddSearchTerm("");
    setSelectedAddIds([]);
    setAddDummyNames({});
    setListMessage(
      createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_TARGETS_ADDED),
    );
  };

  const handleReturnTargets = async (requestId) => {
    if (selectedReturnIds.length === 0) {
      alert("返却する設備を選択してください。");
      return;
    }

    // 一時返却と違い札の確保を手放すため、実行前に現場影響を確認する。
    const isConfirmed = window.confirm(
      `選択した ${selectedReturnIds.length} 件の設備の札を返却します。\n返却した札は依頼から外れ、他の作業者が使用できるようになります。\n実行してよろしいですか？`,
    );
    if (!isConfirmed) return;

    try {
      await onReturnRequestTargets(requestId, selectedReturnIds);
      setListMessage(
        createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_TARGETS_RETURNED, {
          returnedCount: selectedReturnIds.length,
        }),
      );
      setReturnPanelRequestId(null);
      setSelectedReturnIds([]);
    } catch (error) {
      console.error(error);
      alert(error?.message || "設備の返却に失敗しました。");
    }
  };

  const handleRequestTargetCardAction = (requestId, target, action) => {
    const label = action === "return" ? "一時返却" : "再貸出";
    onUpdateRequestTargetCard(requestId, target.id, action);
    setListMessage(
      createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_TARGET_CARD_UPDATED, {
        targetName: target.name,
        actionLabel: label,
      }),
    );
  };

  const handleUpdateRequest = async (req, updates) => {
    // 設備の増減は既存の設備追加・一部返却へ流し、札の確保と解放の規則を揃える。
    const currentIds = req.activeTargets.map((target) => target.id);
    const addedIds = updates.targetMccbIds.filter((id) => !currentIds.includes(id));
    const removedIds = currentIds.filter(
      (id) => !updates.targetMccbIds.includes(id),
    );

    if (
      removedIds.length > 0 &&
      !window.confirm(
        `選択を外した ${removedIds.length} 件の設備の札を返却します。\n返却した札は依頼から外れ、他の作業者が使用できるようになります。\n実行してよろしいですか？`,
      )
    ) {
      return;
    }

    try {
      // 札の持ち主は作業者名で判定するため、改名を先に済ませてから設備を増減する。
      await onUpdateRequest(req.id, {
        workerName: updates.workerName,
        workContent: updates.workContent,
      });
      if (addedIds.length > 0) {
        onAddTargetsToRequest(
          req.id,
          addedIds,
          Object.fromEntries(
            addedIds
              .filter((id) => updates.dummyNames[id])
              .map((id) => [id, updates.dummyNames[id]]),
          ),
        );
      }
      if (removedIds.length > 0) {
        await onReturnRequestTargets(req.id, removedIds);
      }
      setEditPanelRequestId(null);
      setListMessage(createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_UPDATED));
    } catch (error) {
      console.error(error);
      alert(error?.message || "停電作業依頼の編集に失敗しました。");
    }
  };

  // 履歴の内容を依頼作成フォームへ引き継ぐ。札は発行時点の空きで割り当て直す。
  const handleCopyRequest = (req) => {
    navigate("/request", {
      state: {
        copyRequest: {
          workerName: req.workerName || "",
          workContent: req.workContent || "",
          // 削除済みの設備は targets に含まれないため、現存する設備だけが引き継がれる。
          targetMccbIds: req.targets.map((target) => target.id),
          dummyNames: req.dummyNames || {},
        },
      },
    });
  };

  const handleUpdateDraft = async (draftId, updates) => {
    try {
      await onUpdateDraftRequest(draftId, updates);
      setListMessage(
        createStatusMessage(STATUS_MESSAGE_KEYS.DRAFT_REQUEST_UPDATED),
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "仮発行依頼の編集に失敗しました。");
    }
  };

  const handleIssueDraft = async (draftId) => {
    try {
      await onIssueDraftRequest(draftId);
      setListMessage(
        createStatusMessage(STATUS_MESSAGE_KEYS.DRAFT_REQUEST_ISSUED),
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "仮発行依頼の発行に失敗しました。");
    }
  };

  return (
    <>
    <div className={`${UI.panel} print:hidden`}>
      <StatusMessageRail
        message={listMessage}
        onClose={() => setListMessage(null)}
      />

      <div className={UI.tabWrap} role="tablist" aria-label="依頼一覧表示切替">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "active"}
          onClick={() => setActiveView("active")}
          className={`${UI.tabButton} ${
            activeView === "active" ? UI.tabActive : UI.tabIdle
          }`}
        >
          進行中 {activeRequestViews.length} 件
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "draft"}
          onClick={() => setActiveView("draft")}
          className={`${UI.tabButton} ${
            activeView === "draft" ? UI.tabActive : UI.tabIdle
          }`}
        >
          仮発行 {draftRequestViews.length} 件
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "history"}
          onClick={() => setActiveView("history")}
          className={`${UI.tabButton} ${
            activeView === "history" ? UI.tabActive : UI.tabIdle
          }`}
        >
          履歴 {historyPageInfo.total || historyRequestViews.length} 件
        </button>
      </div>

      {activeView === "active" && (
        <ActiveRequestSection
          activeRequestViews={activeRequestViews}
          mccbList={mccbList}
          toggleExpand={toggleExpand}
          addPanelRequestId={addPanelRequestId}
          openAddPanel={openAddPanel}
          addSearchTerm={addSearchTerm}
          setAddSearchTerm={setAddSearchTerm}
          selectedAddIds={selectedAddIds}
          toggleAddTarget={toggleAddTarget}
          addDummyNames={addDummyNames}
          setAddDummyName={setAddDummyName}
          activeDummyUsageMap={activeDummyUsageMap}
          handleAddTargets={handleAddTargets}
          returnPanelRequestId={returnPanelRequestId}
          openReturnPanel={openReturnPanel}
          selectedReturnIds={selectedReturnIds}
          toggleReturnTarget={toggleReturnTarget}
          handleReturnTargets={handleReturnTargets}
          editPanelRequestId={editPanelRequestId}
          openEditPanel={openEditPanel}
          handleUpdateRequest={handleUpdateRequest}
          handlePrintRequest={handlePrintRequest}
          starPrintRequestId={starPrintRequestId}
          isPrintDisabledBySetting={isPrintDisabledBySetting}
          onDeleteRequest={onDeleteRequest}
          handleRequestTargetCardAction={handleRequestTargetCardAction}
        />
      )}

      {activeView === "draft" && (
        <DraftRequestSection
          draftRequestViews={draftRequestViews}
          mccbList={mccbList}
          toggleExpand={toggleExpand}
          handleIssueDraft={handleIssueDraft}
          onDeleteDraftRequest={onDeleteDraftRequest}
          onUpdateDraft={handleUpdateDraft}
        />
      )}

      {activeView === "history" && (
        <HistoryRequestSection
          historyRequestViews={historyRequestViews}
          historyPageInfo={historyPageInfo}
          toggleExpand={toggleExpand}
          onChangeHistoryPage={onChangeHistoryPage}
          onCopyRequest={handleCopyRequest}
        />
      )}
    </div>
    <PrintableRequestForm request={printRequest} />
    </>
  );
}
