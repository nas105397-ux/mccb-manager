// 発行中ダミー札の注記集計の自己チェック。`node src/shared/mccbViewUtils.test.mjs` で実行する。
import assert from "node:assert/strict";
import { createActiveDummyUsageMap } from "./mccbViewUtils.js";

const mccbList = [
  { id: "B", name: "設備B", room: "R1" },
  { id: "DUMMY0", name: "ダミー0", room: "R1" },
  { id: "DUMMY1", name: "ダミー1", room: "R1" },
];

// 退避割当は元設備名を出すが、代替名を引き継げないので相乗り用の名称は持たない。
{
  const usage = createActiveDummyUsageMap(
    [{ reservedCards: { B: { actualMccbId: "DUMMY0", cardNo: 1 } } }],
    mccbList,
  );
  assert.deepEqual(usage.get("DUMMY0"), { label: "設備B", sharableName: "" });
  assert.equal(usage.has("DUMMY1"), false);
}

// ダミー直接指定は入力された代替名を出し、そのまま引き継げば同じ親札を共有できる。
{
  const usage = createActiveDummyUsageMap(
    [
      {
        reservedCards: {
          DUMMY0: { actualMccbId: "DUMMY0", cardNo: 1, customDummyName: "設備Z" },
        },
      },
    ],
    mccbList,
  );
  assert.deepEqual(usage.get("DUMMY0"), { label: "設備Z", sharableName: "設備Z" });
}

// 同じダミーに複数依頼が乗っていても、設備名は重複させずに並べる。
{
  const usage = createActiveDummyUsageMap(
    [
      {
        reservedCards: {
          DUMMY0: { actualMccbId: "DUMMY0", cardNo: 1, customDummyName: "設備Z" },
        },
      },
      {
        reservedCards: {
          DUMMY0: { actualMccbId: "DUMMY0", cardNo: 2, customDummyName: "設備Z" },
          B: { actualMccbId: "DUMMY1", cardNo: 1 },
        },
      },
    ],
    mccbList,
  );
  assert.deepEqual(usage.get("DUMMY0"), { label: "設備Z", sharableName: "設備Z" });
  assert.deepEqual(usage.get("DUMMY1"), { label: "設備B", sharableName: "" });
}

// 指定ダミーが埋まって別ダミーへ振り替えられた場合も、元ダミー名ではなく代替名を出す。
{
  const usage = createActiveDummyUsageMap(
    [
      { reservedCards: { B: { actualMccbId: "DUMMY0", cardNo: 1 } } },
      {
        reservedCards: {
          DUMMY0: { actualMccbId: "DUMMY1", cardNo: 1, customDummyName: "設備Z" },
        },
      },
    ],
    mccbList,
  );
  assert.deepEqual(usage.get("DUMMY0"), { label: "設備B", sharableName: "" });
  assert.deepEqual(usage.get("DUMMY1"), { label: "設備Z", sharableName: "設備Z" });
}

// ダミーを経由しない予約は注記せず、代替名未入力のダミーは使用中だけ伝える。
{
  const usage = createActiveDummyUsageMap(
    [
      {
        reservedCards: {
          B: { actualMccbId: "B", cardNo: 1 },
          DUMMY0: { actualMccbId: "DUMMY0", cardNo: 1 },
          C: { actualMccbId: null, cardNo: null },
        },
      },
    ],
    mccbList,
  );
  assert.equal(usage.size, 1);
  assert.deepEqual(usage.get("DUMMY0"), { label: "名称未入力", sharableName: "" });
}

console.log("ok: 発行中ダミー札の注記集計");
