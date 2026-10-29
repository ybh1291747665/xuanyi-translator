/* 选译 Safari background bundle：由 scripts/build-safari.mjs 生成，请勿直接修改。 */
(() => {
"use strict";
/* ---- src/browser-compat.js ---- */
/**
 * Safari 同时提供 browser（Promise 风格）和 chrome 命名空间，但部分 chrome
 * API 的 Promise 支持并不完整。这个兼容层在 Safari 页面中把 chrome 指向
 * browser，让现有代码继续使用 Promise 风格的 chrome.* 调用。
 *
 * Chromium / Edge 已有的 chrome 实现不动；即使未来 Chrome 提供 browser 命名空间，
 * 只要 manifest 声明了 sidePanel 权限，这里也会保持原样。
 */
(() => {
  const nativeBrowser = globalThis.browser;
  if (!nativeBrowser || !nativeBrowser.runtime) return;

  try {
    const manifest = globalThis.chrome?.runtime?.getManifest?.();
    const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];
    if (permissions.includes("sidePanel")) return;
  } catch {
    // 如果 Safari 没有 chrome 命名空间，继续做映射。
  }

  if (globalThis.chrome === nativeBrowser) return;

  try {
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      writable: true,
      value: nativeBrowser
    });
  } catch {
    try {
      globalThis.chrome = nativeBrowser;
    } catch {
      // 两个命名空间都不可写时继续使用 Safari 原生 chrome。
    }
  }
})();

/* ---- src/lib/languages.js ---- */
/**
 * 语言元数据与各翻译服务的语言代码映射。
 * 内部统一使用 BCP-47 风格的代码（如 zh-CN / zh-TW / en / ja）。
 */

const LANGUAGES = Object.freeze([
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
const SOURCE_LANGUAGES = Object.freeze([
  { code: "auto", label: "自动检测" },
  ...LANGUAGES.map(({ code, label }) => ({ code, label }))
]);

/** 侧栏“译文”语言选项，“smart” 表示中英智能互译。 */
const TARGET_LANGUAGES = Object.freeze([
  { code: "smart", label: "智能互译" },
  ...LANGUAGES.map(({ code, label }) => ({ code, label }))
]);

function normalizeLang(raw) {
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

function getLanguage(code) {
  return LANGUAGE_MAP.get(normalizeLang(code)) || null;
}

function languageLabel(code) {
  if (!code) return "未知语言";
  const language = getLanguage(code);
  return language ? language.label : String(code);
}

function languageNative(code) {
  const language = getLanguage(code);
  return language ? language.native : String(code || "");
}

function speechLang(code) {
  const language = getLanguage(code);
  return language ? language.speech : "en-US";
}

/**
 * 按服务商取语言代码，返回 null 表示该服务不支持此语言。
 * @param {"google"|"azure"|"deepl"} provider
 */
function providerLang(provider, code) {
  const language = getLanguage(code);
  if (!language) return null;
  return language[provider] || null;
}

function isProviderLanguageSupported(provider, code) {
  return Boolean(providerLang(provider, code));
}

/** 不调用接口的轻量源语言猜测，用于“智能中英互译”和检测结果缺失时兜底。 */
function guessSourceLang(text) {
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
function resolveTargetLang(requestedTarget, text, detectedLang = "", requestedSource = "auto") {
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

function languagePairLabel(source, target) {
  const sourceLabel = source && source !== "auto" ? languageLabel(source) : "自动";
  return `${sourceLabel} → ${languageLabel(target)}`;
}

/* ---- src/lib/providers.js ---- */
const PROVIDERS = Object.freeze({
  google: {
    id: "google",
    name: "Google 翻译",
    short: "Google",
    tag: "免密钥",
    description: "开箱即用，响应最快"
  },
  azure: {
    id: "azure",
    name: "Microsoft Azure",
    short: "Azure",
    tag: "需密钥",
    description: "微软翻译，稳定可靠"
  },
  deepl: {
    id: "deepl",
    name: "DeepL",
    short: "DeepL",
    tag: "需密钥",
    description: "译文自然，部分语言需确认"
  }
});

const GOOGLE_PRIMARY = "https://translate.googleapis.com/translate_a/single";
const GOOGLE_FALLBACK = "https://clients5.google.com/translate_a/t";
const AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate";
const DEEPL_FREE = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO = "https://api.deepl.com/v2/translate";
const DEFAULT_TIMEOUT = 10000;

const POS_LABELS = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词",
  exclamation: "感叹词",
  determiner: "限定词",
  article: "冠词",
  numeral: "数词",
  abbreviation: "缩写",
  prefix: "前缀",
  suffix: "后缀",
  phrase: "短语",
  idiom: "习语"
};

class TranslationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "TranslationError";
    this.code = options.code || "translation_error";
    this.status = options.status || 0;
    this.detail = options.detail || "";
  }
}

function userFacingProviderName(provider) {
  return PROVIDERS[provider]?.name || "翻译服务";
}

function buildSignal(userSignal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return userSignal ? AbortSignal.any([userSignal, timeout]) : timeout;
}

function cleanDetail(raw, fallback = "") {
  if (!raw) return fallback;
  const text = String(raw)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return text || fallback;
}

function httpError(provider, status, data) {
  const name = userFacingProviderName(provider);
  const detail = cleanDetail(data?.error?.message || data?.message || "");
  let message;

  if (provider === "deepl" && status === 456) {
    message = "DeepL 本月翻译额度已用完，请下月再试或更换服务。";
  } else if (status === 401 || status === 403) {
    message =
      provider === "google"
        ? "Google 翻译暂时拒绝访问，请稍后再试。"
        : `${name} 鉴权失败，请检查 API 密钥${provider === "azure" ? "与区域" : ""}。`;
  } else if (status === 429) {
    message = "请求过于频繁，请稍等片刻再试。";
  } else if (status === 400) {
    message = `翻译请求被拒绝${detail ? `：${detail}` : "，请缩短选中内容后再试。"}`;
  } else if (status === 413) {
    message = "选中的内容太长了，请分段翻译。";
  } else if (status >= 500) {
    message = `${name} 暂时不可用，请稍后重试。`;
  } else {
    message = `翻译失败${detail ? `：${detail}` : `（HTTP ${status}）`}`;
  }

  return new TranslationError(message, { code: "http", status, detail });
}

async function fetchJson(url, init, { signal, timeoutMs = DEFAULT_TIMEOUT, provider }) {
  const requestSignal = buildSignal(signal, timeoutMs);
  let response;
  let bodyText = "";

  try {
    response = await fetch(url, {
      ...init,
      signal: requestSignal,
      credentials: "omit",
      cache: "no-store"
    });
    bodyText = await response.text();
  } catch (error) {
    if (signal?.aborted) {
      throw new TranslationError("翻译已取消", { code: "aborted" });
    }
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new TranslationError("翻译超时，请重试。", { code: "timeout" });
    }
    throw new TranslationError("无法连接翻译服务，请检查网络后重试。", { code: "network" });
  }

  let data = null;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw httpError(provider, response.status, data);
  }
  if (data === null) {
    throw new TranslationError("翻译服务返回了无法解析的结果，请重试。", { code: "parse" });
  }
  return data;
}

function normalizePos(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[.:]+$/, "");
  return POS_LABELS[key] || cleanDetail(raw, "释义");
}

function phoneticLabel(language) {
  const code = normalizeLang(language);
  if (!code) return "注音";
  if (code.startsWith("zh")) return "拼音";
  if (code === "en") return "音标";
  if (code === "ja" || code === "ko") return "罗马音";
  return "转写";
}

function uniquePhonetic(text) {
  const value = typeof text === "string" ? text.trim() : "";
  return value && value.length <= 120 ? value : "";
}

function parseGoogleDictionary(rawDictionary, translation) {
  if (!Array.isArray(rawDictionary)) return [];
  const result = [];
  const seen = new Set();
  const normalizedTranslation = translation.replace(/[\s。.!！?？,，、；;：:]/g, "").toLowerCase();

  for (const block of rawDictionary.slice(0, 6)) {
    if (!Array.isArray(block)) continue;
    const pos = block[0] ? normalizePos(block[0]) : "释义";
    const candidates = [];

    if (Array.isArray(block[1])) candidates.push(...block[1]);
    if (Array.isArray(block[2])) {
      for (const detail of block[2]) {
        if (Array.isArray(detail) && typeof detail[0] === "string") candidates.push(detail[0]);
      }
    }

    const terms = [];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const term = candidate.replace(/\s+/g, " ").trim();
      if (!term || term.length > 80) continue;
      const normalizedTerm = term.replace(/[\s。.!！?？,，、；;：:]/g, "").toLowerCase();
      if (normalizedTerm === normalizedTranslation) continue;
      if (!terms.includes(term)) terms.push(term);
      if (terms.length >= 4) break;
    }

    if (!terms.length) continue;
    const signature = `${pos}|${terms.join("|")}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push({ pos, terms });
    if (result.length >= 3) break;
  }

  return result;
}

function extractPhonetics(data, detectedLang, targetLang) {
  let sourceText = "";
  let targetText = "";

  for (const segment of data[0]) {
    if (!Array.isArray(segment) || segment[0] || segment[1]) continue;
    if (!targetText) targetText = uniquePhonetic(segment[2]);
    if (!sourceText) sourceText = uniquePhonetic(segment[3]);
  }

  return {
    source: sourceText ? { text: sourceText, label: phoneticLabel(detectedLang) } : null,
    target: targetText ? { text: targetText, label: phoneticLabel(targetLang) } : null
  };
}

function parseGoogleSingle(data, { text, source, target }) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new TranslationError("翻译服务返回了无法解析的结果，请重试。", { code: "parse" });
  }

  const translation = data[0]
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""))
    .join("")
    .trim();

  if (!translation) {
    throw new TranslationError("没有获得译文，请换一段文字再试。", { code: "empty_result" });
  }

  const detectedRaw =
    data[2] ||
    (Array.isArray(data[8]) && Array.isArray(data[8][0]) ? data[8][0][0] : "") ||
    (Array.isArray(data[8]) && Array.isArray(data[8][3]) ? data[8][3][0] : "");

  const detectedLang =
    normalizeLang(detectedRaw) ||
    (source !== "auto" ? normalizeLang(source) : "") ||
    guessSourceLang(text);

  return {
    translation,
    detectedLang,
    targetLang: target,
    provider: "google",
    providerName: PROVIDERS.google.name,
    via: "primary",
    phonetic: extractPhonetics(data, detectedLang, target),
    dictionary: parseGoogleDictionary(data[1], translation)
  };
}

function parseGoogleFallback(data, { text, source, target }) {
  let translation = "";
  let detectedRaw = "";

  if (Array.isArray(data) && Array.isArray(data[0])) {
    const first = data[0];
    if (typeof first[0] === "string") {
      translation = first[0];
      detectedRaw = typeof first[1] === "string" ? first[1] : "";
    }

    // 兼容部分返回结构：[[["译文","原文"]], null, "en"]
    if (!translation && Array.isArray(first[0]) && Array.isArray(first[0][0])) {
      translation = first[0].map((segmentValue) => segmentValue?.[0] || "").join("").trim();
    }
  } else if (Array.isArray(data) && typeof data[0] === "string") {
    translation = data[0];
    detectedRaw = typeof data[1] === "string" ? data[1] : "";
  }

  if (!translation) {
    throw new TranslationError("备用翻译通道也没有返回结果，请重试。", { code: "parse" });
  }

  const detectedLang =
    normalizeLang(detectedRaw) ||
    (source !== "auto" ? normalizeLang(source) : "") ||
    guessSourceLang(text);

  return {
    translation: String(translation).trim(),
    detectedLang,
    targetLang: target,
    provider: "google",
    providerName: PROVIDERS.google.name,
    via: "fallback",
    phonetic: { source: null, target: null },
    dictionary: []
  };
}

async function googlePrimary({ text, source, target, signal }) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: source === "auto" ? "auto" : providerLang("google", source),
    tl: providerLang("google", target)
  });
  params.append("dt", "t");

  // 单词/短语才请求词典和注音，长句直接走最轻量的请求。
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (text.length <= 60 && wordCount <= 6) {
    params.append("dt", "bd");
    params.append("dt", "rm");
  }

  const data = await fetchJson(
    `${GOOGLE_PRIMARY}?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json"
      },
      body: new URLSearchParams({ q: text }).toString()
    },
    { signal, provider: "google" }
  );

  return parseGoogleSingle(data, { text, source, target });
}

async function googleFallback({ text, source, target, signal }) {
  const params = new URLSearchParams({
    client: "dict-chrome-ex",
    sl: source === "auto" ? "auto" : providerLang("google", source),
    tl: providerLang("google", target),
    q: text
  });

  const data = await fetchJson(
    `${GOOGLE_FALLBACK}?${params.toString()}`,
    { method: "GET", headers: { Accept: "application/json" } },
    { signal, timeoutMs: 7000, provider: "google" }
  );

  return parseGoogleFallback(data, { text, source, target });
}

async function translateWithGoogle({ text, source, target, signal }) {
  try {
    return await googlePrimary({ text, source, target, signal });
  } catch (error) {
    if (error.code === "aborted") throw error;

    try {
      return await googleFallback({ text, source, target, signal });
    } catch (fallbackError) {
      if (fallbackError.code === "aborted") throw fallbackError;
      throw error;
    }
  }
}

async function translateWithAzure({ text, source, target, settings, signal }) {
  const key = String(settings.azure?.key || "").trim();
  if (!key) {
    throw new TranslationError("尚未配置 Azure 翻译密钥，请前往设置。", { code: "config" });
  }

  const azureTarget = providerLang("azure", target);
  if (!azureTarget) {
    throw new TranslationError(`Azure 不支持翻译成${getLanguage(target)?.label || "该语言"}。`, { code: "unsupported" });
  }

  const params = new URLSearchParams({
    "api-version": "3.0",
    to: azureTarget
  });

  if (source !== "auto") {
    const azureSource = providerLang("azure", source);
    if (!azureSource) {
      throw new TranslationError("Azure 不支持该源语言。", { code: "unsupported" });
    }
    params.set("from", azureSource);
  }

  const headers = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": key
  };
  const region = String(settings.azure?.region || "").trim();
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;

  const data = await fetchJson(
    `${AZURE_ENDPOINT}?${params.toString()}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify([{ Text: text }])
    },
    { signal, provider: "azure" }
  );

  const item = Array.isArray(data) ? data[0] : null;
  const translation = item?.translations?.[0]?.text?.trim();
  if (!translation) {
    throw new TranslationError("没有获得 Azure 译文，请重试。", { code: "empty_result" });
  }

  const detectedLang =
    normalizeLang(item?.detectedLanguage?.language) ||
    (source !== "auto" ? normalizeLang(source) : "") ||
    guessSourceLang(text);

  return {
    translation,
    detectedLang,
    targetLang: target,
    provider: "azure",
    providerName: PROVIDERS.azure.name,
    via: "primary",
    phonetic: { source: null, target: null },
    dictionary: []
  };
}


function deepLSourceCode(source) {
  const normalized = normalizeLang(source);
  if (!normalized) return null;
  if (normalized.startsWith("zh")) return "ZH";
  if (normalized === "en") return "EN";
  if (normalized === "pt") return "PT";
  return providerLang("deepl", normalized);
}

async function translateWithDeepL({ text, source, target, settings, signal }) {
  const key = String(settings.deepl?.key || "").trim();
  if (!key) {
    throw new TranslationError("尚未配置 DeepL API 密钥，请前往设置。", { code: "config" });
  }

  const deepLTarget = providerLang("deepl", target);
  if (!deepLTarget) {
    throw new TranslationError(
      `DeepL 暂不支持翻译成${getLanguage(target)?.label || "该语言"}，请换用 Google 或 Azure。`,
      { code: "unsupported" }
    );
  }

  const body = new URLSearchParams({
    text,
    target_lang: deepLTarget
  });

  if (source !== "auto") {
    const deepLSource = deepLSourceCode(source);
    if (!deepLSource) {
      throw new TranslationError("DeepL 暂不支持该源语言。", { code: "unsupported" });
    }
    body.set("source_lang", deepLSource);
  }

  const endpoint = key.endsWith(":fx") ? DEEPL_FREE : DEEPL_PRO;
  const data = await fetchJson(
    endpoint,
    {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json"
      },
      body: body.toString()
    },
    { signal, provider: "deepl" }
  );

  const translation = data?.translations?.[0]?.text?.trim();
  if (!translation) {
    throw new TranslationError("没有获得 DeepL 译文，请重试。", { code: "empty_result" });
  }

  const detectedLang =
    normalizeLang(data?.translations?.[0]?.detected_source_language) ||
    (source !== "auto" ? normalizeLang(source) : "") ||
    guessSourceLang(text);

  return {
    translation,
    detectedLang,
    targetLang: target,
    provider: "deepl",
    providerName: PROVIDERS.deepl.name,
    via: "primary",
    phonetic: { source: null, target: null },
    dictionary: []
  };
}

/**
 * 翻译入口，不依赖 chrome.*，方便单元测试。
 */
async function translate({ text, source = "auto", target, settings = {}, signal }) {
  const content = String(text || "").trim();
  if (!content) {
    throw new TranslationError("没有可翻译的内容。", { code: "empty" });
  }
  if (!target || target === "smart") {
    throw new TranslationError("目标语言尚未确定。", { code: "config" });
  }

  const provider = settings.provider || "google";
  if (!PROVIDERS[provider]) {
    throw new TranslationError("未知的翻译服务，请重新选择。", { code: "config" });
  }

  if (provider !== "google" && !providerLang(provider, target)) {
    throw new TranslationError(
      `${PROVIDERS[provider].name} 不支持目标语言“${getLanguage(target)?.label || target}”。`,
      { code: "unsupported" }
    );
  }

  switch (provider) {
    case "google":
      return translateWithGoogle({ text: content, source, target, signal });
    case "azure":
      return translateWithAzure({ text: content, source, target, settings, signal });
    case "deepl":
      return translateWithDeepL({ text: content, source, target, settings, signal });
    default:
      throw new TranslationError("未知的翻译服务，请重新选择。", { code: "config" });
  }
}

/* ---- src/lib/settings.js ---- */
const DEFAULT_SETTINGS = Object.freeze({
  provider: "google",
  targetLang: "smart",
  autoTranslate: true,
  historyEnabled: true,
  historyLimit: 30,
  maxChars: 5000,
  azure: {
    key: "",
    region: ""
  },
  deepl: {
    key: ""
  }
});

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeSettings(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const provider = Object.prototype.hasOwnProperty.call(PROVIDERS, raw.provider) ? raw.provider : DEFAULT_SETTINGS.provider;
  const autoTranslate = typeof raw.autoTranslate === "boolean" ? raw.autoTranslate : DEFAULT_SETTINGS.autoTranslate;
  const historyEnabled = typeof raw.historyEnabled === "boolean" ? raw.historyEnabled : DEFAULT_SETTINGS.historyEnabled;
  const requestedTarget = cleanText(raw.targetLang || DEFAULT_SETTINGS.targetLang, 24);
  const targetLang =
    requestedTarget === "smart" ? "smart" : normalizeLang(requestedTarget) || DEFAULT_SETTINGS.targetLang;
  const historyLimit = Number.isFinite(Number(raw.historyLimit))
    ? Math.min(100, Math.max(5, Math.round(Number(raw.historyLimit))))
    : DEFAULT_SETTINGS.historyLimit;
  const maxChars = Number.isFinite(Number(raw.maxChars))
    ? Math.min(10000, Math.max(200, Math.round(Number(raw.maxChars))))
    : DEFAULT_SETTINGS.maxChars;

  return {
    provider,
    targetLang,
    autoTranslate,
    historyEnabled,
    historyLimit,
    maxChars,
    azure: {
      key: cleanText(raw.azure?.key, 300),
      region: cleanText(raw.azure?.region, 60)
    },
    deepl: {
      key: cleanText(raw.deepl?.key, 300)
    }
  };
}

async function getSettings() {
  try {
    const stored = await chrome.storage.local.get("settings");
    return normalizeSettings(stored.settings || {});
  } catch (error) {
    console.warn("[选译] 读取设置失败，使用默认设置", error);
    return normalizeSettings({});
  }
}

async function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ settings: normalized });
  return normalized;
}

async function updateSettings(patch = {}) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...patch,
    azure: {
      ...current.azure,
      ...(patch.azure && typeof patch.azure === "object" ? patch.azure : {})
    },
    deepl: {
      ...current.deepl,
      ...(patch.deepl && typeof patch.deepl === "object" ? patch.deepl : {})
    }
  };
  return saveSettings(merged);
}

/* ---- src/lib/cache.js ---- */
/**
 * Service Worker 重启后仍可用的会话级翻译缓存。
 * 数据只存在 chrome.storage.session 中，关闭浏览器即消失。
 */

const STORAGE_KEY = "xy_translation_cache_v1";
const MAX_ENTRIES = 350;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cache = new Map();
let initPromise = null;
let saveTimer = null;

function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const entries = Array.from(cache.entries());
    chrome.storage.session.set({ [STORAGE_KEY]: entries }).catch(() => {});
  }, 250);
}

function evictOverflow() {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function initCache() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const stored = await chrome.storage.session.get(STORAGE_KEY);
      const entries = stored?.[STORAGE_KEY];
      if (!Array.isArray(entries)) return;
      const now = Date.now();
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [key, value] = entry;
        if (typeof key !== "string" || !value || !Number.isFinite(value.at)) continue;
        if (now - value.at > TTL_MS) continue;
        cache.set(key, value);
      }
      evictOverflow();
    } catch {
      // 缓存不可用时静默降级为纯内存缓存。
    }
  })();

  return initPromise;
}

async function getCached(key) {
  await initCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (!entry.at || Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    schedulePersist();
    return null;
  }

  // LRU：命中后移到队尾。
  cache.delete(key);
  cache.set(key, entry);

  return {
    ...entry.result,
    cached: true,
    elapsedMs: 0
  };
}

async function setCached(key, result) {
  await initCache();
  cache.delete(key);
  cache.set(key, { at: Date.now(), result });
  evictOverflow();
  schedulePersist();
}

function clearCache() {
  cache.clear();
  clearTimeout(saveTimer);
  return chrome.storage.session.remove(STORAGE_KEY).catch(() => {});
}

/* ---- src/background.js ---- */
const CONTEXT_MENU_ID = "xy-translate-selection";
const SESSION_CURRENT = "xy_current_translation_v1";
const HISTORY_KEY = "xy_history_v1";
const HARD_TEXT_LIMIT = 15000;
const STALE_LOADING_MS = 12000;
const PANEL_URL = chrome.runtime.getURL("src/sidepanel.html");
const PANEL_WINDOW_KEY = "xy_panel_window_v1";
const FALLBACK_PANEL_WIDTH = 420;
const FALLBACK_PANEL_HEIGHT = 780;

let current = null;
let inflight = null;
let pendingPrepare = null;
let panelWindowId = null;
let requestSeq = 0;

const readyPromise = (async () => {
  try {
    const stored = await chrome.storage.session.get(SESSION_CURRENT);
    const saved = stored?.[SESSION_CURRENT];
    if (saved && typeof saved === "object" && typeof saved.text === "string") {
      current = saved;
    }
  } catch (error) {
    console.warn("[选译] 读取会话状态失败", error);
  }
  await initCache();
})();

async function ensureReady() {
  await readyPromise;

  if (current?.status === "loading" && !inflight) {
    const age = Date.now() - Number(current.updatedAt || current.createdAt || 0);
    if (age > STALE_LOADING_MS) {
      current = {
        ...current,
        status: "error",
        updatedAt: Date.now(),
        error: {
          code: "stale",
          message: "上次翻译没有完成，请点击重试。"
        }
      };
      await persistCurrent();
    }
  }
}

async function persistCurrent() {
  try {
    if (current) {
      await chrome.storage.session.set({ [SESSION_CURRENT]: current });
    }
  } catch (error) {
    console.warn("[选译] 保存会话状态失败", error);
  }
}

function broadcast(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {
    // 侧栏未打开或暂时没有接收方时，静默忽略。
  });
}

function nextRequestId() {
  requestSeq += 1;
  return `xy_${Date.now().toString(36)}_${requestSeq.toString(36)}`;
}

function normalizeSelectionText(raw) {
  return String(raw || "")
    .slice(0, HARD_TEXT_LIMIT)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasMeaningfulText(text) {
  return /[\p{L}\p{N}]/u.test(text);
}

function normalizeRequestedSource(value) {
  if (!value || value === "auto") return "auto";
  return normalizeLang(value) || "auto";
}

function normalizeRequestedTarget(value) {
  if (!value || value === "smart") return "smart";
  return normalizeLang(value) || "smart";
}

function abortInflight() {
  if (inflight?.controller) {
    inflight.controller.abort();
  }
  inflight = null;
}

function cacheKey(provider, source, target, text) {
  return [provider, source, target, text].join("\u0000");
}

function errorMessage(error) {
  if (error?.name === "TranslationError" && error.message) return error.message;
  if (typeof error?.message === "string" && error.message && !/fetch|network|aborted/i.test(error.message)) {
    return error.message.slice(0, 260);
  }
  return "翻译失败，请检查网络后重试。";
}

async function finishSuccess({ requestId, target, provider, startedAt, result, cached }) {
  if (!current || current.requestId !== requestId) return;

  const elapsedMs = cached ? 0 : Math.max(1, Math.round(performance.now() - startedAt));
  const finalResult = {
    ...result,
    targetLang: target,
    elapsedMs,
    cached: Boolean(cached)
  };

  current = {
    ...current,
    status: "done",
    provider,
    targetLang: target,
    sourceLang: result.detectedLang || current.sourceLang,
    result: finalResult,
    error: null,
    updatedAt: Date.now(),
    doneAt: Date.now()
  };

  await persistCurrent();
  broadcast({ type: "XY_STATE", current });
  addHistory(current).catch((error) => console.warn("[选译] 写入历史失败", error));
}

async function finishError(requestId, code, message) {
  if (!current || current.requestId !== requestId) return;

  current = {
    ...current,
    status: "error",
    error: {
      code: code || "translation_error",
      message: String(message || "翻译失败，请重试。").slice(0, 300)
    },
    updatedAt: Date.now()
  };

  await persistCurrent();
  broadcast({ type: "XY_STATE", current });
}

async function executeTranslation({ requestId, settings, source, target, text, startedAt }) {
  if (!current || current.requestId !== requestId) return;

  const provider = settings.provider;
  const controller = new AbortController();
  inflight = { requestId, controller };
  const key = cacheKey(provider, source, target, text);
  const stillCurrent = () => current?.requestId === requestId && !controller.signal.aborted;

  try {
    const cached = await getCached(key);
    if (!stillCurrent()) return;
    if (cached) {
      await finishSuccess({ requestId, target, provider, startedAt, result: cached, cached: true });
      return;
    }

    const result = await translate({
      text,
      source,
      target,
      settings,
      signal: controller.signal
    });

    if (!stillCurrent()) return;

    void setCached(key, {
      translation: result.translation,
      detectedLang: result.detectedLang,
      targetLang: result.targetLang,
      provider: result.provider,
      providerName: result.providerName,
      via: result.via,
      phonetic: result.phonetic,
      dictionary: result.dictionary
    });

    await finishSuccess({
      requestId,
      target,
      provider,
      startedAt,
      result,
      cached: false
    });
  } catch (error) {
    if (!stillCurrent()) return;
    if (error?.code === "aborted" || controller.signal.aborted) return;
    if (!(error?.name === "TranslationError")) {
      console.warn("[选译] 翻译异常", error);
    }
    await finishError(requestId, error?.code, errorMessage(error));
  } finally {
    if (inflight?.requestId === requestId) {
      inflight = null;
    }
  }
}

async function ingestSelection(payload = {}, options = {}) {
  await ensureReady();

  const settings = await getSettings();
  const text = normalizeSelectionText(payload.text);
  if (!text || !hasMeaningfulText(text)) return current;

  abortInflight();

  const requestId = nextRequestId();
  const source = normalizeRequestedSource(options.source ?? payload.source);
  const requestedTarget = normalizeRequestedTarget(options.target ?? payload.target ?? settings.targetLang);
  const target = resolveTargetLang(requestedTarget, text, "", source);
  const origin = options.origin || payload.origin || "page";
  const tooLong = text.length > settings.maxChars;
  const shouldTranslate = !tooLong && Boolean(options.force || settings.autoTranslate);
  const now = Date.now();

  current = {
    requestId,
    text: tooLong ? `${text.slice(0, settings.maxChars)}…` : text,
    charCount: text.length,
    truncated: tooLong,
    url: typeof payload.url === "string" ? payload.url.slice(0, 2000) : "",
    title: typeof payload.title === "string" ? payload.title.slice(0, 240) : "",
    origin,
    createdAt: now,
    updatedAt: now,
    status: tooLong ? "error" : shouldTranslate ? "loading" : "idle",
    requestedSource: source,
    sourceLang: source === "auto" ? "" : source,
    requestedTarget,
    targetLang: target,
    provider: settings.provider,
    providerName: PROVIDERS[settings.provider]?.name || "",
    auto: shouldTranslate,
    error: tooLong
      ? {
          code: "too-long",
          message: `选中了 ${text.length} 个字符，超过上限 ${settings.maxChars}。请分段选择后再试。`
        }
      : null,
    result: null
  };

  await persistCurrent();
  broadcast({ type: "XY_STATE", current });

  if (shouldTranslate) {
    void executeTranslation({
      requestId,
      settings,
      source,
      target,
      text,
      startedAt: performance.now()
    }).catch((error) => {
      console.warn("[选译] 翻译任务异常", error);
      return finishError(requestId, "translation_error", "翻译失败，请重试。");
    });
  }

  return current;
}

function startSelection(payload, options) {
  const task = ingestSelection(payload, options).catch((error) => {
    console.error("[选译] 处理选中内容失败", error);
    return null;
  });
  pendingPrepare = task;
  return task;
}

async function loadHistory(limit) {
  try {
    const stored = await chrome.storage.local.get(HISTORY_KEY);
    const list = Array.isArray(stored?.[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
    return list
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          item.result &&
          typeof item.result.translation === "string"
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function addHistory(state) {
  const settings = await getSettings();
  if (!settings.historyEnabled || !state?.result) return;

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text: state.text,
    title: state.title || "",
    url: state.url || "",
    at: Date.now(),
    sourceLang: state.result.detectedLang || state.sourceLang || "",
    targetLang: state.targetLang,
    requestedTarget: state.requestedTarget,
    provider: state.provider,
    providerName: state.result.providerName || state.providerName || "",
    result: {
      translation: state.result.translation,
      detectedLang: state.result.detectedLang,
      targetLang: state.result.targetLang,
      provider: state.provider,
      providerName: state.result.providerName || state.providerName || "",
      via: state.result.via,
      phonetic: state.result.phonetic || { source: null, target: null },
      dictionary: Array.isArray(state.result.dictionary) ? state.result.dictionary : []
    }
  };

  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const previous = Array.isArray(stored?.[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  const deduped = previous.filter(
    (item) =>
      !(
        item?.text === entry.text &&
        item?.targetLang === entry.targetLang &&
        item?.provider === entry.provider
      )
  );

  await chrome.storage.local.set({
    [HISTORY_KEY]: [entry, ...deduped].slice(0, settings.historyLimit)
  });
}

async function handleGetState() {
  await ensureReady();

  if (pendingPrepare) {
    await Promise.race([
      pendingPrepare.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
  }

  const settings = await getSettings();
  const history = settings.historyEnabled ? await loadHistory(settings.historyLimit) : [];
  return { ok: true, current, settings, history };
}

async function handleGetHistory() {
  const settings = await getSettings();
  const history = settings.historyEnabled ? await loadHistory(settings.historyLimit) : [];
  return { ok: true, history, historyEnabled: settings.historyEnabled };
}

async function handleDeleteHistory(id) {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "缺少历史记录 ID" };
  }
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const previous = Array.isArray(stored?.[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  const next = previous.filter((item) => item?.id !== id);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  return { ok: true, history: next };
}

async function handleClearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
  return { ok: true };
}

async function handleTestProvider(message) {
  const settings = normalizeSettings(message?.settings || (await getSettings()));
  const sample = String(message?.text || "Hello, world!").slice(0, 300).trim() || "Hello, world!";
  const target = resolveTargetLang(settings.targetLang, sample, "en", "auto");
  const startedAt = performance.now();

  try {
    const result = await translate({
      text: sample,
      source: "auto",
      target,
      settings
    });
    return {
      ok: true,
      translation: result.translation,
      detectedLang: result.detectedLang,
      targetLang: target,
      providerName: result.providerName,
      elapsedMs: Math.max(1, Math.round(performance.now() - startedAt))
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error?.code || "translation_error",
        message: errorMessage(error)
      },
      elapsedMs: Math.max(1, Math.round(performance.now() - startedAt))
    };
  }
}

async function clearContextMenus() {
  try {
    const pending = chrome.contextMenus.removeAll();
    if (pending && typeof pending.then === "function") {
      await pending;
      return;
    }
  } catch (error) {
    console.warn("[选译] 清理右键菜单失败", error);
  }
  // Safari/旧版 Chromium 可能只提供回调接口；留一点时间让菜单先清理。
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function setupContextMenu() {
  await clearContextMenus();
  try {
    const pending = chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "用「选译」翻译“%s”",
      contexts: ["selection"]
    });
    if (pending && typeof pending.catch === "function") {
      pending.catch((error) => console.warn("[选译] 创建右键菜单失败", error));
    }
  } catch (error) {
    console.warn("[选译] 创建右键菜单失败", error);
  }
}

function hasNativeSidePanel() {
  try {
    const manifest = chrome.runtime.getManifest();
    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    return Boolean(chrome.sidePanel?.open) && permissions.includes("sidePanel");
  } catch {
    return false;
  }
}

async function rememberPanelWindow(windowId) {
  panelWindowId = windowId;
  try {
    await chrome.storage.session.set({ [PANEL_WINDOW_KEY]: windowId });
  } catch {
    // 会话存储不可用时只保留内存中的窗口 ID。
  }
}

async function restorePanelWindowId() {
  if (panelWindowId != null) return panelWindowId;
  try {
    const stored = await chrome.storage.session.get(PANEL_WINDOW_KEY);
    const storedId = stored?.[PANEL_WINDOW_KEY];
    if (typeof storedId === "number") panelWindowId = storedId;
  } catch {
    // 忽略，下次重新创建窗口。
  }
  return panelWindowId;
}

async function focusPanelWindow() {
  const windowId = await restorePanelWindowId();
  if (windowId == null) return false;
  try {
    await chrome.windows.update(windowId, { focused: true });
    return true;
  } catch {
    panelWindowId = null;
    try {
      await chrome.storage.session.remove(PANEL_WINDOW_KEY);
    } catch {
      // 忽略清理失败。
    }
    return false;
  }
}

async function openFloatingPanel() {
  if (await focusPanelWindow()) return;

  let created = null;
  try {
    created = await chrome.windows.create({
      url: PANEL_URL,
      type: "popup",
      width: FALLBACK_PANEL_WIDTH,
      height: FALLBACK_PANEL_HEIGHT,
      focused: true
    });
  } catch (error) {
    // 某些 Safari 版本不接受 type: "popup"，退回普通窗口。
    created = await chrome.windows.create({
      url: PANEL_URL,
      width: FALLBACK_PANEL_WIDTH,
      height: FALLBACK_PANEL_HEIGHT,
      focused: true
    });
  }

  if (created?.id != null) {
    await rememberPanelWindow(created.id);
  }
}

async function openPanelSurface(tab) {
  if (hasNativeSidePanel()) {
    const target =
      tab?.id != null ? { tabId: tab.id } : tab?.windowId != null ? { windowId: tab.windowId } : null;
    if (target) {
      try {
        await chrome.sidePanel.open(target);
        return;
      } catch (error) {
        console.warn("[选译] 原生侧栏打开失败，改用浮动窗口", error);
      }
    }
  }

  await openFloatingPanel();
}

if (chrome.windows?.onRemoved?.addListener) {
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId !== panelWindowId) return;
    panelWindowId = null;
    try {
      chrome.storage.session.remove(PANEL_WINDOW_KEY).catch(() => {});
    } catch {
      // 忽略。
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void setupContextMenu();
  chrome.storage.local.get("settings").then((stored) => {
    if (!stored?.settings) {
      getSettings().then((settings) => chrome.storage.local.set({ settings })).catch(() => {});
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  void setupContextMenu();
});

chrome.action.onClicked.addListener((tab) => {
  openPanelSurface(tab).catch((error) => {
    console.warn("[选译] 打开翻译面板失败", error);
  });
});

if (chrome.commands?.onCommand?.addListener) {
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== "open-panel") return;
    openPanelSurface(tab).catch((error) => {
      console.warn("[选译] 快捷键打开翻译面板失败", error);
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const text = info.selectionText || "";
  if (!text.trim()) return;

  startSelection(
    {
      text,
      url: info.pageUrl || tab?.url || "",
      title: tab?.title || "",
      origin: "context-menu"
    },
    { force: true }
  );

  openPanelSurface(tab).catch((error) => {
    console.warn("[选译] 从右键菜单打开翻译面板失败", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (typeof type !== "string" || !type.startsWith("XY_")) {
    return false;
  }

  switch (type) {
    case "XY_SELECTION": {
      const tab = sender.tab;
      startSelection({
        text: message.text,
        url: message.url || tab?.url || "",
        title: message.title || tab?.title || "",
        origin: message.origin || "page"
      });
      return false;
    }

    case "XY_GET_STATE":
      handleGetState()
        .then(sendResponse)
        .catch((error) => {
          console.error("[选译] 获取状态失败", error);
          sendResponse({ ok: false, error: "读取状态失败" });
        });
      return true;

    case "XY_TRANSLATE":
      startSelection(
        {
          text: message.text,
          url: message.url,
          title: message.title,
          origin: message.origin || "sidebar"
        },
        {
          force: true,
          source: message.source,
          target: message.target
        }
      );
      sendResponse({ ok: true });
      return false;

    case "XY_GET_HISTORY":
      handleGetHistory()
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false, history: [] }));
      return true;

    case "XY_DELETE_HISTORY":
      handleDeleteHistory(message.id)
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false }));
      return true;

    case "XY_CLEAR_HISTORY":
      handleClearHistory()
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false }));
      return true;

    case "XY_CLEAR_CACHE":
      clearCache()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;

    case "XY_UPDATE_SETTINGS":
      updateSettings(message.patch || {})
        .then((settings) => sendResponse({ ok: true, settings }))
        .catch((error) => {
          console.warn("[选译] 保存设置失败", error);
          sendResponse({ ok: false, error: "保存设置失败" });
        });
      return true;

    case "XY_TEST_PROVIDER":
      handleTestProvider(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: { message: errorMessage(error) } }));
      return true;

    default:
      return false;
  }
});

void readyPromise;
})();
