/**
 * 语言元数据与各翻译服务的语言代码映射。
 * 内部统一使用 BCP-47 风格的代码（如 zh-CN / zh-TW / en / ja）。
 */

export const LANGUAGES = Object.freeze([
  { code: "zh-CN", label: "简体中文", native: "简体中文", speech: "zh-CN", google: "zh-CN", azure: "zh-Hans", deepl: "ZH-HANS" },
  { code: "zh-TW", label: "繁體中文", native: "繁體中文", speech: "zh-TW", google: "zh-TW", azure: "zh-Hant", deepl: "ZH-HANT" },
  { code: "en", label: "英语", native: "English", speech: "en-US", google: "en", azure: "en", deepl: "EN-US" },
  { code: "ja", label: "日语", native: "日本語", speech: "ja-JP", google: "ja", azure: "ja", deepl: "JA" },
  { code: "ko", label: "韩语", native: "한국어", speech: "ko-KR", google: "ko", azure: "ko", deepl: "KO" },
  { code: "fr", label: "法语", native: "Français", speech: "fr-FR", google: "fr", azure: "fr", deepl: "FR" },
  { code: "de", label: "德语", native: "Deutsch", speech: "de-DE", google: "de", azure: "de", deepl: "DE" },
  { code: "es", label: "西班牙语", native: "Español", speech: "es-ES", google: "es", azure: "es", deepl: "ES" },
  { code: "ru", label: "俄语", native: "Русский", speech: "ru-RU", google: "ru", azure: "ru", deepl: "RU" },
  { code: "pt", label: "葡萄牙语", native: "Português", speech: "pt-PT", google: "pt", azure: "pt", deepl: "PT-PT" },
  { code: "it", label: "意大利语", native: "Italiano", speech: "it-IT", google: "it", azure: "it", deepl: "IT" },
  { code: "ar", label: "阿拉伯语", native: "العربية", speech: "ar-SA", google: "ar", azure: "ar", deepl: "AR" },
  { code: "tr", label: "土耳其语", native: "Türkçe", speech: "tr-TR", google: "tr", azure: "tr", deepl: "TR" },
  { code: "nl", label: "荷兰语", native: "Nederlands", speech: "nl-NL", google: "nl", azure: "nl", deepl: "NL" },
  { code: "pl", label: "波兰语", native: "Polski", speech: "pl-PL", google: "pl", azure: "pl", deepl: "PL" },
  { code: "id", label: "印尼语", native: "Bahasa Indonesia", speech: "id-ID", google: "id", azure: "id", deepl: "ID" },
  { code: "th", label: "泰语", native: "ไทย", speech: "th-TH", google: "th", azure: "th", deepl: null },
  { code: "vi", label: "越南语", native: "Tiếng Việt", speech: "vi-VN", google: "vi", azure: "vi", deepl: null },
  { code: "hi", label: "印地语", native: "हिन्दी", speech: "hi-IN", google: "hi", azure: "hi", deepl: null }
]);

const LANGUAGE_MAP = new Map(LANGUAGES.map((language) => [language.code, language]));

const ALIASES = new Map([
  ["zh", "zh-CN"],
  ["zh-cn", "zh-CN"],
  ["zh-hans", "zh-CN"],
  ["zh-sg", "zh-CN"],
  ["cmn", "zh-CN"],
  ["zh-tw", "zh-TW"],
  ["zh-hant", "zh-TW"],
  ["zh-hk", "zh-TW"],
  ["zh-mo", "zh-TW"],
  ["en", "en"],
  ["en-us", "en"],
  ["en-gb", "en"],
  ["en-au", "en"],
  ["en-ca", "en"],
  ["ja", "ja"],
  ["jp", "ja"],
  ["ko", "ko"],
  ["kr", "ko"],
  ["fr", "fr"],
  ["de", "de"],
  ["es", "es"],
  ["ru", "ru"],
  ["pt", "pt"],
  ["pt-br", "pt"],
  ["pt-pt", "pt"],
  ["it", "it"],
  ["ar", "ar"],
  ["tr", "tr"],
  ["nl", "nl"],
  ["pl", "pl"],
  ["id", "id"],
  ["in", "id"],
  ["th", "th"],
  ["vi", "vi"],
  ["hi", "hi"]
]);

/** 侧栏“原文”语言选项。 */
export const SOURCE_LANGUAGES = Object.freeze([
  { code: "auto", label: "自动检测" },
  ...LANGUAGES.map(({ code, label }) => ({ code, label }))
]);

/** 侧栏“译文”语言选项，“smart” 表示中英智能互译。 */
export const TARGET_LANGUAGES = Object.freeze([
  { code: "smart", label: "智能互译" },
  ...LANGUAGES.map(({ code, label }) => ({ code, label }))
]);

export function normalizeLang(raw) {
  if (!raw) return "";
  const value = String(raw).trim().replace(/_/g, "-").toLowerCase();
  if (!value) return "";
  if (ALIASES.has(value)) return ALIASES.get(value);
  if (value.startsWith("zh")) {
    return /(tw|hk|mo|hant)/.test(value) ? "zh-TW" : "zh-CN";
  }
  const base = value.split("-")[0];
  if (ALIASES.has(base)) return ALIASES.get(base);
  return "";
}

export function getLanguage(code) {
  return LANGUAGE_MAP.get(normalizeLang(code)) || null;
}

export function languageLabel(code) {
  if (!code) return "未知语言";
  const language = getLanguage(code);
  return language ? language.label : String(code);
}

export function languageNative(code) {
  const language = getLanguage(code);
  return language ? language.native : String(code || "");
}

export function speechLang(code) {
  const language = getLanguage(code);
  return language ? language.speech : "en-US";
}

/**
 * 按服务商取语言代码，返回 null 表示该服务不支持此语言。
 * @param {"google"|"azure"|"deepl"} provider
 */
export function providerLang(provider, code) {
  const language = getLanguage(code);
  if (!language) return null;
  return language[provider] || null;
}

export function isProviderLanguageSupported(provider, code) {
  return Boolean(providerLang(provider, code));
}

/** 不调用接口的轻量源语言猜测，用于“智能中英互译”和检测结果缺失时兜底。 */
export function guessSourceLang(text) {
  const sample = String(text || "").slice(0, 300);
  if (/[\u3040-\u30ff]/.test(sample)) return "ja";
  if (/[\uac00-\ud7af]/.test(sample)) return "ko";
  if (/[\u0400-\u04ff]/.test(sample)) return "ru";
  if (/[\u0600-\u06ff]/.test(sample)) return "ar";
  if (/[\u0e00-\u0e7f]/.test(sample)) return "th";
  if (/[\u0900-\u097f]/.test(sample)) return "hi";

  const han = (sample.match(/[\u3400-\u9fff]/g) || []).length;
  const letters = (sample.match(/[\p{L}\p{N}]/gu) || []).length || 1;
  if (han > 0 && han / letters >= 0.12) return "zh-CN";
  return "en";
}

/**
 * 解析最终目标语言。
 * 智能模式：选中中文 → 英语；选中其他语言 → 简体中文。
 */
export function resolveTargetLang(requestedTarget, text, detectedLang = "", requestedSource = "auto") {
  if (requestedTarget && requestedTarget !== "smart") {
    return normalizeLang(requestedTarget) || "zh-CN";
  }
  let source = "";
  if (requestedSource && requestedSource !== "auto") {
    source = normalizeLang(requestedSource);
  }
  if (!source) {
    source = normalizeLang(detectedLang) || guessSourceLang(text);
  }
  return source.startsWith("zh") ? "en" : "zh-CN";
}

export function languagePairLabel(source, target) {
  const sourceLabel = source && source !== "auto" ? languageLabel(source) : "自动";
  return `${sourceLabel} → ${languageLabel(target)}`;
}
