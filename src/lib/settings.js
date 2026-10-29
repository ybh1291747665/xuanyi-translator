import { normalizeLang } from "./languages.js";
import { PROVIDERS } from "./providers.js";

export const DEFAULT_SETTINGS = Object.freeze({
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

export function normalizeSettings(input = {}) {
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

export async function getSettings() {
  try {
    const stored = await chrome.storage.local.get("settings");
    return normalizeSettings(stored.settings || {});
  } catch (error) {
    console.warn("[选译] 读取设置失败，使用默认设置", error);
    return normalizeSettings({});
  }
}

export async function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ settings: normalized });
  return normalized;
}

export async function updateSettings(patch = {}) {
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
