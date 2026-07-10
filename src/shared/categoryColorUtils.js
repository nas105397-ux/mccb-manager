// 区分ごとの表示色プリセットと、未設定時の正規化処理。
export const CATEGORY_COLOR_PRESETS = {
  white: {
    label: "白",
    badgeClass: "bg-white text-gray-900 border-gray-300 shadow-sm",
    swatchClass: "bg-white border-gray-300",
  },
  black: {
    label: "黒",
    badgeClass: "bg-black text-white border-black",
    swatchClass: "bg-black border-black",
  },
  red: {
    label: "赤",
    badgeClass: "bg-red-600 text-white border-red-600",
    swatchClass: "bg-red-600 border-red-600",
  },
  blue: {
    label: "青",
    badgeClass: "bg-blue-600 text-white border-blue-600",
    swatchClass: "bg-blue-600 border-blue-600",
  },
  yellow: {
    label: "黄",
    badgeClass: "bg-yellow-400 text-gray-900 border-yellow-400",
    swatchClass: "bg-yellow-400 border-yellow-400",
  },
  green: {
    label: "緑",
    badgeClass: "bg-green-600 text-white border-green-600",
    swatchClass: "bg-green-600 border-green-600",
  },
  gray: {
    label: "灰",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    swatchClass: "bg-gray-200 border-gray-300",
  },
  purple: {
    label: "紫",
    badgeClass: "bg-purple-600 text-white border-purple-600",
    swatchClass: "bg-purple-600 border-purple-600",
  },
  orange: {
    label: "橙",
    badgeClass: "bg-orange-500 text-white border-orange-500",
    swatchClass: "bg-orange-500 border-orange-500",
  },
  teal: {
    label: "青緑",
    badgeClass: "bg-teal-600 text-white border-teal-600",
    swatchClass: "bg-teal-600 border-teal-600",
  },
};

export const DEFAULT_CATEGORY_COLOR_KEYS = {
  "1スト": "white",
  "2スト": "black",
  "3スト": "red",
  "4スト": "blue",
  "5スト": "yellow",
  "6スト": "green",
  共通: "gray",
};

export const DEFAULT_CATEGORY_COLOR_KEY = "gray";

// 未知のキーが保存されていても、必ず定義済みの色へフォールバックする。
export const getValidCategoryColorKey = (colorKey) =>
  CATEGORY_COLOR_PRESETS[colorKey] ? colorKey : DEFAULT_CATEGORY_COLOR_KEY;

// 管理画面で指定した色を優先し、未指定なら区分ごとの初期色を返す。
export const getCategoryColorKey = (category, categoryColors = {}) =>
  getValidCategoryColorKey(
    categoryColors?.[category] || DEFAULT_CATEGORY_COLOR_KEYS[category],
  );

export const normalizeCategoryColors = (categories = [], categoryColors = {}) => {
  // 削除済み区分の設定は持ち越さず、現在存在する区分だけを再構成する。
  const nextColors = {};
  categories.forEach((category) => {
    nextColors[category] = getCategoryColorKey(category, categoryColors);
  });
  return nextColors;
};

export const getCategoryBadgeClass = (
  category,
  categoryColors = {},
  isDarkMode = false,
) => {
  // 空の区分や不正な設定値には、テーマに合う中立色を使用する。
  const colorKey = category
    ? categoryColors?.[category] || DEFAULT_CATEGORY_COLOR_KEYS[category]
    : null;

  if (colorKey && CATEGORY_COLOR_PRESETS[colorKey]) {
    return CATEGORY_COLOR_PRESETS[colorKey].badgeClass;
  }

  return isDarkMode
    ? "bg-gray-800 text-gray-300 border-gray-700"
    : "bg-gray-50 text-gray-600 border-gray-200";
};
