import { getLanguage, guessSourceLang, normalizeLang, providerLang } from "./languages.js";

export const PROVIDERS = Object.freeze({
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

export class TranslationError extends Error {
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
export async function translate({ text, source = "auto", target, settings = {}, signal }) {
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
