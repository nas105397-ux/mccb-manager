import {
  InterfaceType,
  Options,
  StarConnectionSettings,
  StarPrinterFactory,
  StarXpandCommand,
} from "star-io10-web";
import { loadStarPrinterConnection } from "./starPrinterConnection";

const RECEIPT_WIDTH_MM = 72.0;
const SEPARATOR_WIDTH_MM = 72.0;

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

export const createRequestReceiptFieldData = (request) => {
  const issueDate = getIssueDate(request);
  return JSON.stringify({
    title: "操作禁止（停電）依頼表",
    note: "作業終了後、管理室へ返却",
    issue_date: formatDate(issueDate),
    issue_time: formatDateTime(request, issueDate),
    request_no: request.id || `REQ-${issueDate.getTime()}`,
    worker_name: request.workerName || "（未入力）",
    work_content: request.workContent || "（未入力）",
    target_count: request.targets?.length || 0,
    item_list: (request.targets || []).map((target, index) => ({
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
      .settingPrintableArea(RECEIPT_WIDTH_MM)
      .addPrinter(
        new printer.PrinterBuilder()
          .styleInternationalCharacter(printer.InternationalCharacterType.Japan)
          .styleCharacterSpace(0.0)
          .add(
            new printer.PrinterBuilder()
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
          .actionPrintText("${worker_name}\n")
          .actionPrintText("\n")
          .styleBold(true)
          .actionPrintText("作業内容\n")
          .styleBold(false)
          .actionPrintText("${work_content}\n")
          .actionPrintRuledLine(new printer.RuledLineParameter(SEPARATOR_WIDTH_MM))
          .styleBold(true)
          .actionPrintText("停電対象設備 ${target_count} 面\n")
          .styleBold(false)
          .add(
            new printer.PrinterBuilder(
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
          .styleAlignment(printer.Alignment.Center)
          .actionPrintText("返却確認: __________________\n")
          .actionFeed(2.0)
          .actionCut(printer.CutType.Partial),
      ),
  );

  return builder.getCommands();
};

export const printRequestReceipt = async (request) => {
  const storedConnection = loadStarPrinterConnection();
  const connectionSettings = new StarConnectionSettings();
  connectionSettings.interfaceType = InterfaceType.Usb;
  if (storedConnection?.identifier) {
    connectionSettings.identifier = storedConnection.identifier;
  }

  const printerFactory = new StarPrinterFactory();
  const printer = printerFactory.createStarPrinter(connectionSettings);

  try {
    await printer.open();
    const options = new Options.PrintOptions();
    options.template = await createRequestReceiptTemplate();
    await printer.print(createRequestReceiptFieldData(request), options);
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
