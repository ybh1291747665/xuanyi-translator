import { clearCache, getCached, initCache, setCached } from "./lib/cache.js";
import { normalizeLang, resolveTargetLang } from "./lib/languages.js";
import { PROVIDERS, translate } from "./lib/providers.js";
import { getSettings, normalizeSettings, updateSettings } from "./lib/settings.js";

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
