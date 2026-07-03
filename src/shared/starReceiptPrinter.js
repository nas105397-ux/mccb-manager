import {
  InterfaceType,
  Options,
  StarConnectionSettings,
  StarPrinterFactory,
  StarXpandCommand,
} from "star-io10-web";
import { loadStarPrinterConnection } from "./starPrinterConnection";

const ROLL_WIDTH_MM = 80.0;
const PRINTABLE_AREA_WIDTH_MM = 72.0;
const SEPARATOR_WIDTH_MM = PRINTABLE_AREA_WIDTH_MM;

const getIssueDate = (request) => {
  const timestampValue = Number(String(request.id || "").replace("REQ-", ""));
  if (Number.isFinite(timestampValue) && timestampValue > 0) {
    return new Date(timestampValue);
  }
  return new Date();
};

const formatDate = (date) =>
  `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;

const formatDateTime = (request, date) => request.timestamp || formatDate(date);

const createCardLabel = (target) => {
  const reserveInfo = target.reserveInfo;
  if (!reserveInfo?.cardNo) return "札の空きなし";
  if (target.isAllocatedFromDummy) {
    return `代替:${reserveInfo.displayName} No.${reserveInfo.cardNo}`;
  }
  return `子札 No.${reserveInfo.cardNo}`;
};

export const buildRequestReceiptTargets = (request, mccbList = []) => {
  if (Array.isArray(request?.targets) && request.targets.length > 0) {
    return request.targets;
  }

  const mccbMap = new Map(mccbList.map((mccb) => [mccb.id, mccb]));

  return (request?.targetMccbIds || [])
    .map((targetId) => {
      const targetMccb = mccbMap.get(targetId);
      const reserveInfo = request.reservedCards?.[targetId];
      const actualMccb = reserveInfo?.actualMccbId
        ? mccbMap.get(reserveInfo.actualMccbId)
        : null;

      if (!targetMccb && !reserveInfo) return null;

      const isOriginalDummy =
        !!targetMccb && (targetMccb.isDummy || targetMccb.name?.includes("ダミー"));
      const isAllocatedFromDummy =
        !!actualMccb && (!targetMccb || actualMccb.id !== targetMccb.id);

      let displayName =
        targetMccb?.name || reserveInfo?.displayName || "名称未設定";
      if (isOriginalDummy && reserveInfo?.customDummyName) {
        displayName = `${targetMccb.name} (${reserveInfo.customDummyName})`;
      } else if (isAllocatedFromDummy && targetMccb) {
        displayName = `${actualMccb.name} (${targetMccb.name})`;
      }

      return {
        id: targetId,
        room: targetMccb?.room || actualMccb?.room || "-",
        name: displayName,
        reserveInfo,
        isAllocatedFromDummy,
      };
    })
    .filter(Boolean);
};

export const createRequestReceiptFieldData = (request, mccbList = []) => {
  const issueDate = getIssueDate(request);
  const targets = buildRequestReceiptTargets(request, mccbList);
  return JSON.stringify({
    title: "操作禁止（停電）依頼表",
    note: "作業終了後、管理室へ返却",
    issue_date: formatDate(issueDate),
    issue_time: formatDateTime(request, issueDate),
    request_no: request.id || `REQ-${issueDate.getTime()}`,
    worker_name: request.workerName || "（未入力）",
    work_content: request.workContent || "（未入力）",
    target_count: targets.length,
    item_list: targets.map((target, index) => ({
      no: index + 1,
      room: target.room || "-",
      name: target.name || "名称未設定",
      card: createCardLabel(target),
    })),
  });
};

export const createRequestReceiptTemplate = async () => {
  const builder = new StarXpandCommand.StarXpandCommandBuilder();
  const printer = StarXpandCommand.Printer;

  builder.addDocument(
    new StarXpandCommand.DocumentBuilder()
      .settingPrintableArea(PRINTABLE_AREA_WIDTH_MM)
      .addPrinter(
        new StarXpandCommand.PrinterBuilder()
          .styleInternationalCharacter(printer.InternationalCharacterType.Japan)
          .styleCharacterSpace(0.0)
          .actionFeed(1.0)
          .add(
            new StarXpandCommand.PrinterBuilder()
              .styleAlignment(printer.Alignment.Center)
              .styleBold(true)
              .styleMagnification(new StarXpandCommand.MagnificationParameter(2, 2))
              .actionPrintText("${title}\n"),
          )
          .styleAlignment(printer.Alignment.Center)
          .actionPrintText("※${note}\n")
          .actionPrintRuledLine(new printer.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .styleAlignment(printer.Alignment.Left)
          .actionPrintText("発行日 ", new printer.TextParameter().setWidth(8))
          .actionPrintText("${issue_date}\n", new printer.TextParameter().setWidth(24))
          .actionPrintText("発行時刻 ", new printer.TextParameter().setWidth(8))
          .actionPrintText("${issue_time}\n", new printer.TextParameter().setWidth(24))
          .actionPrintText("依頼No ", new printer.TextParameter().setWidth(8))
          .actionPrintText("${request_no}\n", new printer.TextParameter().setWidth(24))
          .actionPrintRuledLine(new printer.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .styleBold(true)
          .actionPrintText("作業責任者\n")
          .styleBold(false)
          .add(
            new StarXpandCommand.PrinterBuilder()
              .styleMagnification(new StarXpandCommand.MagnificationParameter(1, 2))
              .actionPrintText("${worker_name}\n"),
          )
          .actionPrintText("\n")
          .styleBold(true)
          .actionPrintText("作業内容\n")
          .styleBold(false)
          .add(
            new StarXpandCommand.PrinterBuilder()
              .styleMagnification(new StarXpandCommand.MagnificationParameter(1, 2))
              .actionPrintText("${work_content}\n"),
          )
          .actionPrintRuledLine(new printer.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .styleBold(true)
          .actionPrintText("停電対象設備 ${target_count} 面\n")
          .styleBold(false)
          .add(
            new StarXpandCommand.PrinterBuilder(
              new printer.PrinterParameter().setTemplateExtension(
                new StarXpandCommand.TemplateExtensionParameter().setEnableArrayFieldData(true),
              ),
            )
              .actionPrintText("${item_list.no}", new printer.TextParameter().setWidth(3))
              .actionPrintText("${item_list.room}", new printer.TextParameter().setWidth(10))
              .actionPrintText("${item_list.name}\n", new printer.TextParameter().setWidth(29))
              .actionPrintText("   札: ${item_list.card}\n"),
          )
          .actionPrintRuledLine(new printer.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .actionPrintText("\n")
          .actionPrintText("\n")
          .styleAlignment(printer.Alignment.Center)
          .actionPrintText("返却確認: __________________\n")
          .actionFeed(2.0)
          .actionCut(printer.CutType.Partial),
      ),
  );

  return builder.getCommands();
};

export const createStarPrinter = () => {
  const storedConnection = loadStarPrinterConnection();
  const connectionSettings = new StarConnectionSettings();
  connectionSettings.interfaceType = InterfaceType.Usb;
  if (storedConnection?.identifier) {
    connectionSettings.identifier = storedConnection.identifier;
  }

  const printerFactory = new StarPrinterFactory();
  const printer = printerFactory.createStarPrinter(connectionSettings);

  return { printer, printerFactory };
};

export const printRequestReceipt = async (request, mccbList = []) => {
  const { printer, printerFactory } = createStarPrinter();

  try {
    await printer.open();
    const options = new Options.PrintOptions();
    options.template = await createRequestReceiptTemplate();
    await printer.print(createRequestReceiptFieldData(request, mccbList), options);
    await printer.close();
  } catch (error) {
    try {
      await printer.close();
    } catch {
      // Closing is best-effort after a print/open failure.
    }
    throw error;
  } finally {
    await printer.dispose();
    printerFactory.dispose();
  }
};

export const printStarPrinterTestPage = async () => {
  const { printer, printerFactory } = createStarPrinter();
  const builder = new StarXpandCommand.StarXpandCommandBuilder();
  const printerCommand = StarXpandCommand.Printer;

  builder.addDocument(
    new StarXpandCommand.DocumentBuilder()
      .settingPrintableArea(PRINTABLE_AREA_WIDTH_MM)
      .addPrinter(
        new StarXpandCommand.PrinterBuilder()
          .styleInternationalCharacter(
            printerCommand.InternationalCharacterType.Japan,
          )
          .styleAlignment(printerCommand.Alignment.Center)
          .styleBold(true)
          .styleMagnification(new StarXpandCommand.MagnificationParameter(2, 2))
          .actionPrintText("MCCB Manager\n")
          .styleMagnification(new StarXpandCommand.MagnificationParameter(1, 1))
          .styleBold(false)
          .actionPrintText("StarXpand 接続テスト\n")
          .actionPrintRuledLine(new printerCommand.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .styleAlignment(printerCommand.Alignment.Left)
          .actionPrintText(`用紙: ${ROLL_WIDTH_MM}mmロール\n`)
          .actionPrintText(`印字幅: ${PRINTABLE_AREA_WIDTH_MM}mm\n`)
          .actionPrintText(`日時: ${new Date().toLocaleString("ja-JP")}\n`)
          .actionPrintRuledLine(new printerCommand.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .styleAlignment(printerCommand.Alignment.Center)
          .actionPrintText("印刷できました\n")
          .actionFeed(2.0)
          .actionCut(printerCommand.CutType.Partial),
      ),
  );

  try {
    await printer.open();
    await printer.print(await builder.getCommands());
    await printer.close();
  } catch (error) {
    try {
      await printer.close();
    } catch {
      // Closing is best-effort after a print/open failure.
    }
    throw error;
  } finally {
    await printer.dispose();
    printerFactory.dispose();
  }
};
