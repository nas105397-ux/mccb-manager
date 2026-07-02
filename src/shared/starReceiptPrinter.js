import {
  InterfaceType,
  Options,
  StarConnectionSettings,
  StarPrinterFactory,
  StarXpandCommand,
} from "star-io10-web";

export const PRINT_DRIVER_STORAGE_KEY = "mccb.requestPrintDriver";
export const PRINT_DRIVERS = {
  star: "star",
  browser: "browser",
};

const RECEIPT_WIDTH_MM = 72;
const LINE_WIDTH = 32;

export const getSavedPrintDriver = () => {
  if (typeof window === "undefined") return PRINT_DRIVERS.star;
  const saved = window.localStorage.getItem(PRINT_DRIVER_STORAGE_KEY);
  return Object.values(PRINT_DRIVERS).includes(saved) ? saved : PRINT_DRIVERS.star;
};

export const savePrintDriver = (driver) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRINT_DRIVER_STORAGE_KEY, driver);
};

const normalizeText = (value) => String(value || "").replace(/\r\n/g, "\n").trim();

const formatDate = (date) =>
  `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

const padLine = (left, right) => {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  const spaces = Math.max(1, LINE_WIDTH - leftText.length - rightText.length);
  return `${leftText}${" ".repeat(spaces)}${rightText}`;
};

const createReceiptText = ({ workerName, workContent, issueDate, dateCode, targets }) => {
  const lines = [
    "操作禁止（停電）依頼表",
    "※作業終了後、管理室へ返却",
    padLine(`日付:${formatDate(issueDate)}`, `No:REQ-${dateCode}`),
    "--------------------------------",
    "【作業責任者】",
    normalizeText(workerName) || "（未入力）",
    "【作業内容】",
    normalizeText(workContent) || "（未入力）",
    "--------------------------------",
    "▼ 停電対象設備一覧",
  ];

  targets.forEach((target, index) => {
    lines.push(`${index + 1}. ${normalizeText(target.name)}`);
    lines.push(`   ${normalizeText(target.cardLabel)}`);
  });

  lines.push("", "");
  return `${lines.join("\n")}\n`;
};

const createReceiptCommands = async (receipt) => {
  const builder = new StarXpandCommand.StarXpandCommandBuilder();
  const printer = new StarXpandCommand.PrinterBuilder()
    .styleCjkCharacterPriority([StarXpandCommand.Printer.CjkCharacterType.Japanese])
    .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
    .styleBold(true)
    .styleMagnification(new StarXpandCommand.MagnificationParameter(2, 1))
    .actionPrintText("操作禁止（停電）依頼表\n")
    .styleMagnification(new StarXpandCommand.MagnificationParameter(1, 1))
    .styleBold(false)
    .actionPrintText("※作業終了後、管理室へ返却\n")
    .styleAlignment(StarXpandCommand.Printer.Alignment.Left)
    .actionPrintText(receipt.replace(/^操作禁止（停電）依頼表\n※作業終了後、管理室へ返却\n/, ""))
    .actionCut(StarXpandCommand.Printer.CutType.Partial);

  builder.addDocument(
    new StarXpandCommand.DocumentBuilder()
      .settingPrintableArea(RECEIPT_WIDTH_MM)
      .addPrinter(printer),
  );

  return builder.getCommands();
};

export async function printRequestWithStar({ workerName, workContent, issueDate, dateCode, targets }) {
  const connectionSettings = new StarConnectionSettings();
  connectionSettings.interfaceType = InterfaceType.Usb;

  const receipt = createReceiptText({ workerName, workContent, issueDate, dateCode, targets });
  const commands = await createReceiptCommands(receipt);
  const printerFactory = new StarPrinterFactory();
  const printer = printerFactory.createStarPrinter(connectionSettings);

  try {
    await printer.open();
    const options = new Options.PrintOptions();
    options.enableCheckStatus = true;
    await printer.print(commands, options);
  } finally {
    try {
      await printer.close();
    } catch {
      // close失敗時もdisposeを優先する。
    }
    await printer.dispose();
    printerFactory.dispose();
  }
}
