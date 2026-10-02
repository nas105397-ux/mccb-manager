// ダミー札の相乗り判定と振替の自己チェック。`node server/requestAssignmentService.test.mjs` で実行する。
import assert from "node:assert/strict";
import {
  createRequestAssignmentService,
  renameReservedCardWorker,
} from "./requestAssignmentService.js";

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

  // 振替先のダミー1を同じ代替名で選び直したら、その親札の子札を確保する。
  const third = issue(second.mccbs, second.requests, {
    workerName: "丙",
    targetMccbIds: ["DUMMY1"],
    dummyNames: { DUMMY1: "設備Z" },
  });
  assert.equal(third.reserved.DUMMY1.actualMccbId, "DUMMY1");
  assert.equal(third.reserved.DUMMY1.cardNo, 2);
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

// 同じダミー0へ3件重複させた後、振替先のダミー1・ダミー2も同じ代替名で選び直せる。
{
  const mccbs = createMccbs(6);
  let requests = [];
  let list = mccbs;
  const step = (targetMccbIds, dummyNames, workerName) => {
    const result = issue(list, requests, { workerName, targetMccbIds, dummyNames });
    requests = result.requests;
    // 札の確保状況を次の依頼へ引き継ぐ（未使用のダミーは元のまま残す）。
    const merged = new Map(list.map((mccb) => [mccb.id, mccb]));
    result.mccbs.forEach((mccb) => merged.set(mccb.id, mccb));
    list = [...merged.values()];
    return result.reserved;
  };

  assert.deepEqual(
    [
      step(["DUMMY0"], { DUMMY0: "設備X" }, "甲").DUMMY0,
      step(["DUMMY0"], { DUMMY0: "設備Y" }, "乙").DUMMY0,
      step(["DUMMY0"], { DUMMY0: "設備Z" }, "丙").DUMMY0,
    ].map((info) => `${info.displayName} No.${info.cardNo}`),
    ["ダミー0 No.1", "ダミー1 No.1", "ダミー2 No.1"],
  );

  // 発行画面の注記どおりに選び直したら、その親札の空き子札を確保する。
  assert.deepEqual(
    [
      step(["DUMMY0"], { DUMMY0: "設備X" }, "丁").DUMMY0,
      step(["DUMMY1"], { DUMMY1: "設備Y" }, "戊").DUMMY1,
      step(["DUMMY2"], { DUMMY2: "設備Z" }, "己").DUMMY2,
    ].map((info) => `${info.displayName} No.${info.cardNo}`),
    ["ダミー0 No.2", "ダミー1 No.2", "ダミー2 No.2"],
  );

  // 同一依頼で複数のダミーを選んでも取り違えない。
  const together = step(
    ["DUMMY1", "DUMMY2"],
    { DUMMY1: "設備Y", DUMMY2: "設備Z" },
    "庚",
  );
  assert.equal(`${together.DUMMY1.displayName} No.${together.DUMMY1.cardNo}`, "ダミー1 No.3");
  assert.equal(`${together.DUMMY2.displayName} No.${together.DUMMY2.cardNo}`, "ダミー2 No.3");
}

// 代替名は前後の空白を無視して同じ実設備とみなし、保存時も揃える。
{
  const first = issue(createMccbs(), [], {
    workerName: "甲",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: " 設備Z " },
  });
  assert.equal(first.reserved.DUMMY0.customDummyName, "設備Z");

  const same = issue(first.mccbs, first.requests, {
    workerName: "乙",
    targetMccbIds: ["DUMMY0"],
    dummyNames: { DUMMY0: "設備Z" },
  });
  assert.equal(same.reserved.DUMMY0.actualMccbId, "DUMMY0");
  assert.equal(same.reserved.DUMMY0.cardNo, 2);
}

// 通常設備に代替名が紛れ込んでも保存せず、退避先の同定は元設備IDのままにする。
{
  const result = issue(createMccbs(), [], {
    workerName: "甲",
    targetMccbIds: ["B"],
    dummyNames: { B: "紛れ込んだ名前" },
  });
  assert.equal(result.reserved.B.actualMccbId, "DUMMY0");
  assert.equal(result.reserved.B.customDummyName, null);
}

// 「空きなし」で終わった対象は、札が空いた後に設備追加で確保し直せる。
{
  const mccbs = createMccbs(0);
  const service = createService(mccbs, []);
  const { finalRequest } = service.buildRequestAssignment({
    id: "REQ-1",
    workerName: "甲",
    targetMccbIds: ["B", "C"],
  });
  assert.equal(finalRequest.reservedCards.B.actualMccbId, null);

  // 設備B の札が返ってきた状態で、同じ依頼へ B を追加し直す。
  const freed = mccbs.map((mccb) =>
    mccb.id === "B" ? { ...mccb, childCards: cards(5) } : mccb,
  );
  const addition = createService(freed, [finalRequest]).buildRequestTargetAddition(
    finalRequest,
    ["B"],
  );
  assert.ok(addition, "空きなしの対象を追加候補として受け付ける");
  assert.deepEqual(addition.additionalTargetIds, ["B"]);
  assert.equal(addition.updatedRequest.reservedCards.B.actualMccbId, "B");
  assert.deepEqual(addition.updatedRequest.targetMccbIds, ["B", "C"]);
}

// ダミーが絡まない通常割当は従来どおり自札を確保する。
{
  const result = issue(createMccbs(), [], { workerName: "甲", targetMccbIds: ["C"] });
  assert.equal(result.reserved.C.actualMccbId, "C");
  assert.equal(result.reserved.C.cardNo, 1);
}

// 作業者名の変更は依頼が確保した札だけを改名し、別作業者の貸出札は触らない。
{
  const result = issue(createMccbs(), [], { workerName: "甲", targetMccbIds: ["B", "C"] });
  const renamed = renameReservedCardWorker(result.mccbs, result.reserved, "甲", "乙");
  const cardOf = (id, no) =>
    renamed.find((mccb) => mccb.id === id).childCards.find((card) => card.id === no);
  assert.equal(cardOf("C", 1).workerName, "乙");
  assert.equal(cardOf("DUMMY0", 1).workerName, "乙");
  assert.equal(cardOf("B", 1).workerName, "既存");
}

console.log("ok: ダミー相乗り判定と振替");
