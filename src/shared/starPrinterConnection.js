// Star WebUSB プリンター接続情報の検出・保存・削除を担当する。
import { STAR_PRINTER_CONNECTION_STORAGE_KEY } from "./printSettings";

const STAR_USB_INTERFACE_TYPE = "Usb";
const PRINTER_INFORMATION_TIMEOUT_MS = 2500;

export const DEFAULT_STAR_PRINTER_CONNECTION = {
  interfaceType: STAR_USB_INTERFACE_TYPE,
  identifier: "",
  model: "",
  connectedAt: "",
};

export const normalizeStarPrinterConnection = (connection) => {
  if (!connection || typeof connection !== "object") {
    return null;
  }

  const interfaceType =
    connection.interfaceType === STAR_USB_INTERFACE_TYPE
      ? STAR_USB_INTERFACE_TYPE
      : DEFAULT_STAR_PRINTER_CONNECTION.interfaceType;
  const identifier = String(connection.identifier || "").trim();

  if (!identifier) {
    return null;
  }

  return {
    interfaceType,
    identifier,
    model: String(connection.model || ""),
    connectedAt: String(connection.connectedAt || ""),
  };
};

export const loadStarPrinterConnection = () => {
  if (typeof window === "undefined") return null;

  try {
    return normalizeStarPrinterConnection(
      JSON.parse(
        window.localStorage.getItem(STAR_PRINTER_CONNECTION_STORAGE_KEY),
      ),
    );
  } catch {
    return null;
  }
};

export const saveStarPrinterConnection = (connection) => {
  const normalizedConnection = normalizeStarPrinterConnection(connection);
  if (!normalizedConnection || typeof window === "undefined") {
    return null;
  }

  window.localStorage.setItem(
    STAR_PRINTER_CONNECTION_STORAGE_KEY,
    JSON.stringify(normalizedConnection),
  );
  return normalizedConnection;
};

export const clearStarPrinterConnection = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STAR_PRINTER_CONNECTION_STORAGE_KEY);
};

const assertWebUsbAvailable = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("ブラウザ環境で実行してください。");
  }

  if (!window.isSecureContext) {
    throw new Error(
      "WebUSBを使用できません。Chrome/Edgeで localhost または HTTPS のURLから開いてください。",
    );
  }

  if (!navigator.usb) {
    throw new Error(
      "WebUSBを使用できません。Chrome/Edgeで開いてください。Firefox/Safari/一部WebViewではUSB接続できません。",
    );
  }
};

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);

export const discoverStarPrinterConnection = async () => {
  assertWebUsbAvailable();

  const { InterfaceType, StarDeviceDiscoveryManager } = await import(
    "star-io10-web"
  );
  const discoveredPrinters = [];
  const informationRequests = [];
  const discoveryManager = new StarDeviceDiscoveryManager(InterfaceType.Usb);

  discoveryManager.onPrinterFound = (printer) => {
    const discoveredPrinter = {
      interfaceType: printer.connectionSettings.interfaceType,
      identifier: printer.connectionSettings.identifier,
      model: "",
      connectedAt: new Date().toISOString(),
    };

    discoveredPrinters.push(discoveredPrinter);

    informationRequests.push(
      withTimeout(printer.getInformation(), PRINTER_INFORMATION_TIMEOUT_MS)
        .then((information) => {
          discoveredPrinter.model = information?.model || "";
        })
        .catch(() => {
          discoveredPrinter.model = "";
        })
        .finally(() => printer.dispose()),
    );
  };

  await discoveryManager.discover();
  await Promise.allSettled(informationRequests);

  const firstPrinter = discoveredPrinters[0];
  if (!firstPrinter) {
    throw new Error("プリンターが見つかりませんでした。USB接続とブラウザの許可を確認してください。");
  }

  return saveStarPrinterConnection(firstPrinter);
};
