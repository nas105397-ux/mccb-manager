// 発行中・仮発行・履歴の依頼一覧。設備追加や一時返却もここから操作する。
import { useState } from "react";
import { useRequestBarcodeScanner } from "../hooks/useRequestBarcodeScanner";
import { useRequestListController } from "../hooks/useRequestListController";
import { useRequestListPrintController } from "../hooks/useRequestListPrintController";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";
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
  onAddTargetsToRequest = () => {},
  onUpdateRequestTargetCard = () => {},
  onChangeHistoryPage = () => {},
  requestPrintMode = REQUEST_PRINT_MODES.NONE,
}) {
  const [activeView, setActiveView] = useState("active");
  const [addPanelRequestId, setAddPanelRequestId] = useState(null);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [selectedAddIds, setSelectedAddIds] = useState([]);
  const [listMessage, setListMessage] = useState(null);
  const { activeRequestViews, draftRequestViews, historyRequestViews, toggleExpand } =
    useRequestListController({
      requests,
      draftRequests,
      requestHistory,
      mccbList,
    });

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
  };

  const toggleAddTarget = (mccbId) => {
    setSelectedAddIds((prev) =>
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

    onAddTargetsToRequest(requestId, selectedAddIds);
    setAddPanelRequestId(null);
    setAddSearchTerm("");
    setSelectedAddIds([]);
    setListMessage(
      createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_TARGETS_ADDED),
    );
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
          handleAddTargets={handleAddTargets}
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
        />
      )}
    </div>
    <PrintableRequestForm request={printRequest} />
    </>
  );
}
