// ダミー札の相乗り判定と振替の自己チェック。`node server/requestAssignmentService.test.mjs` で実行する。
import assert from "node:assert/strict";
import { createRequestAssignmentService } from "./requestAssignmentService.js";

const cards = (count, borrowed = 0) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    isBorrowed: index < borrowed,
    workerName: index < borrowed ? "既存" : "",
  }));

// 設備B は自札を使い切っているのでダミーへ退避する。設備C は自札に空きがある。
const createMccbs = (dummyCount = 2) => [
  { id: "B", name: "設備B", room: "R1", childCards: cards(5, 5) },
  { id: "C", name: "設備C", room: "R1", childCards: cards(5) },
  ...Array.from({ length: dummyCount }, (_, index) => ({
    id: `DUMMY${index}`,
    name: `ダミー${index}`,
    room: "R1",
    childCards: cards(5),
  })),
];

const createService = (mccbs, requests = []) => {
  const byId = new Map(mccbs.map((mccb) => [mccb.id, mccb]));
  return createRequestAssignmentService({
    store: {
      readCollection: (key) => (key === "requests" ? requests : []),
      readMccbsByIds: (ids) => ids.map((id) => byId.get(id)).filter(Boolean),
      readDummyMccbs: () => mccbs.filter((mccb) => mccb.name.includes("ダミー")),
    },
  });
};

const issue = (mccbs, requests, request) => {
  const service = createService(mccbs, requests);
  const result = service.buildRequestAssignment(request);
  return {
    reserved: result.finalRequest.reservedCards,
    previewItems: service.buildRequestPreviewItems(
      result.finalRequest,
      result.currentMccbList,
    ),
    mccbs: result.currentMccbList,
    requests: [result.finalRequest, ...requests],
  };
};

// 退避でダミー0を使った後に同じダミー0を直接指定したら、次の空きダミーへ回す。
{
  const first = issue(createMccbs(), [], { workerName: "甲", targetMccbIds: ["B"] });
  assert.equal(first.reserved.B.actualMccbId, "DUMMY0");

  const second = issue(first.mccbs, first.requests, {
    workerName: "乙",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: "設備Z" },
  });
  assert.equal(second.reserved.DUMMY0.actualMccbId, "DUMMY1");
  assert.equal(second.reserved.DUMMY0.cardNo, 1);
  // 振替先の補足は元ダミー名ではなく、入力された用途名を出す。
  assert.equal(second.previewItems[0].name, "ダミー1 (設備Z)");
}

// 同じ実設備（代替名が一致）なら、指定ダミーの別子札をそのまま使う。
{
  const first = issue(createMccbs(), [], {
    workerName: "甲",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: "設備Z" },
  });
  assert.equal(first.reserved.DUMMY0.cardNo, 1);
  assert.equal(first.previewItems[0].name, "ダミー0 (設備Z)");

  const same = issue(first.mccbs, first.requests, {
    workerName: "乙",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: "設備Z" },
  });
  assert.equal(same.reserved.DUMMY0.actualMccbId, "DUMMY0");
  assert.equal(same.reserved.DUMMY0.cardNo, 2);

  // 代替名が違えば別設備なので、次の空きダミーへ回す。
  const other = issue(first.mccbs, first.requests, {
    workerName: "丙",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: "設備Y" },
  });
  assert.equal(other.reserved.DUMMY0.actualMccbId, "DUMMY1");
}

// 同一依頼内で退避割当した直後の直接指定も、まだ保存されていない予約を見て振り替える。
{
  const result = issue(createMccbs(), [], {
    workerName: "甲",
    targetMccbIds: ["B", "DUMMY0"],
    dummyNames: { DUMMY0: "設備Z" },
  });
  assert.equal(result.reserved.B.actualMccbId, "DUMMY0");
  assert.equal(result.reserved.DUMMY0.actualMccbId, "DUMMY1");
}

// 振替先のダミーが無ければ従来どおり「空きなし」。
{
  const first = issue(createMccbs(1), [], { workerName: "甲", targetMccbIds: ["B"] });
  assert.equal(first.reserved.B.actualMccbId, "DUMMY0");

  const second = issue(first.mccbs, first.requests, {
    workerName: "乙",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: "設備Z" },
  });
  assert.equal(second.reserved.DUMMY0.actualMccbId, null);
  assert.equal(second.previewItems[0].name, "ダミー0");
}

// ダミーが絡まない通常割当は従来どおり自札を確保する。
{
  const result = issue(createMccbs(), [], { workerName: "甲", targetMccbIds: ["C"] });
  assert.equal(result.reserved.C.actualMccbId, "C");
  assert.equal(result.reserved.C.cardNo, 1);
}

console.log("ok: ダミー相乗り判定と振替");
