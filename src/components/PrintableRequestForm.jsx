const getIssueDate = (request) => {
  const timestampValue = Number(String(request.id || "").replace("REQ-", ""));
  if (Number.isFinite(timestampValue) && timestampValue > 0) {
    return new Date(timestampValue);
  }
  return new Date();
};

const getDateCode = (date) =>
  `${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

const getTargetCardLabel = (target) => {
  const reserveInfo = target.reserveInfo;
  if (!reserveInfo?.cardNo) return "札の空きなし";
  return target.isAllocatedFromDummy
    ? `代替:${reserveInfo.displayName} No.${reserveInfo.cardNo}`
    : `子札 No.${reserveInfo.cardNo}`;
};

export default function PrintableRequestForm({ request }) {
  if (!request) return null;

  const issueDate = getIssueDate(request);
  const dateCode = getDateCode(issueDate);

  return (
    <div className="hidden print:block print:w-[78mm] print:mx-auto text-black bg-white font-mono text-xs">
      <div className="border-0 p-1 space-y-4">
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <h1 className="text-base font-black tracking-tighter">
            操作禁止（停電）依頼表
          </h1>
          <p className="text-[9px] text-black mt-0.5">
            ※作業終了後、管理室へ返却
          </p>
          <div className="flex justify-between text-[10px] mt-2 border-t border-dashed border-gray-400 pt-1">
            <span>
              日付: {issueDate.getFullYear()}/{issueDate.getMonth() + 1}/
              {issueDate.getDate()}
            </span>
            <span>No: REQ-{dateCode}</span>
          </div>
        </div>

        <div className="space-y-1 p-2 rounded border border-black">
          <p className="text-[10px] font-bold text-gray-500">【作業責任者】</p>
          <p className="text-sm font-black pl-1">
            {request.workerName || "（未入力）"}
          </p>
          <p className="text-[10px] font-bold text-gray-500 mt-1">
            【作業内容】
          </p>
          <p className="text-xs pl-1 leading-tight whitespace-pre-wrap">
            {request.workContent || "（未入力）"}
          </p>
        </div>

        <div className="border-t border-black pt-2">
          <p className="text-[10px] font-black mb-1">▼ 停電対象設備一覧</p>
          <div className="space-y-1 border-b border-black pb-2">
            {request.targets.map((target, index) => (
              <div
                key={`${target.id}-${index}`}
                className="flex justify-between items-start text-[11px] py-0.5 border-b border-dashed border-gray-200 last:border-0"
              >
                <span className="font-bold truncate max-w-[200px]">
                  {index + 1}. {target.name}
                </span>
                <span className="font-black shrink-0 text-right px-1 rounded">
                  {getTargetCardLabel(target)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
