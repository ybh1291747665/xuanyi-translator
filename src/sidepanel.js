import {
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  languageLabel,
  speechLang
} from "./lib/languages.js";
import { isFloatingPanelMode } from "./lib/platform.js";
import { normalizeSettings } from "./lib/settings.js";

const $ = (id) => document.getElementById(id);

const els = {
  appHeader: $("appHeader"),
  historyBtn: $("historyBtn"),
  settingsBtn: $("settingsBtn"),
  sourceLang: $("sourceLang"),
  targetLang: $("targetLang"),
  swapBtn: $("swapBtn"),
  mainView: $("mainView"),
  mainScroll: $("mainScroll"),
  emptyState: $("emptyState"),
  emptyDesc: $("emptyDesc"),
  tipAuto: $("tipAuto"),
  demoBtn: $("demoBtn"),
  workspace: $("workspace"),
  detectedChip: $("detectedChip"),
  copySourceBtn: $("copySourceBtn"),
  speakSourceBtn: $("speakSourceBtn"),
  sourceText: $("sourceText"),
  sourcePhonetic: $("sourcePhonetic"),
  sourcePhoneticLabel: $("sourcePhoneticLabel"),
  sourcePhoneticText: $("sourcePhoneticText"),
  sourceMeta: $("sourceMeta"),
  resultCard: $("resultCard"),
  providerChip: $("providerChip"),
  copyTranslationBtn: $("copyTranslationBtn"),
  speakTranslationBtn: $("speakTranslationBtn"),
  retryBtn: $("retryBtn"),
  loadingState: $("loadingState"),
  loadingProvider: $("loadingProvider"),
  slowRetryBtn: $("slowRetryBtn"),
  resultContent: $("resultContent"),
  translationText: $("translationText"),
  targetPhonetic: $("targetPhonetic"),
  targetPhoneticLabel: $("targetPhoneticLabel"),
  targetPhoneticText: $("targetPhoneticText"),
  dictionary: $("dictionary"),
  resultFooter: $("resultFooter"),
  latency: $("latency"),
  resultPair: $("resultPair"),
  idleState: $("idleState"),
  idleMessage: $("idleMessage"),
  translateBtn: $("translateBtn"),
  errorState: $("errorState"),
  errorTitle: $("errorTitle"),
  errorMessage: $("errorMessage"),
  errorRetryBtn: $("errorRetryBtn"),
  errorSettingsBtn: $("errorSettingsBtn"),
  pageContext: $("pageContext"),
  pageHost: $("pageHost"),
  pageSeparator: $("pageSeparator"),
  pageTitle: $("pageTitle"),
  autoTranslateToggle: $("autoTranslateToggle"),
  appFooter: $("appFooter"),
  shortcutHint: $("shortcutHint"),
  historyView: $("historyView"),
  historyBackBtn: $("historyBackBtn"),
  historyCount: $("historyCount"),
  clearHistoryBtn: $("clearHistoryBtn"),
  historyList: $("historyList"),
  historyEmpty: $("historyEmpty"),
  historyEmptyText: $("historyEmptyText"),
  historySettingsBtn: $("historySettingsBtn"),
  toast: $("toast")
};

const DEMO_TEXT = "serendipity";
const FLOATING_MODE = isFloatingPanelMode();
const PANEL_NOUN = FLOATING_MODE ? "窗口" : "侧栏";
const CONFIG_ERROR_CODES = new Set(["config", "unsupported", "http"]);

const state = {
  settings: normalizeSettings({}),
  current: null,
  history: [],
  historyEnabled: true,
  view: "translate",
  slowTimer: null,
  toastTimer: null,
  speakingButton: null
};

function populateSelect(select, options) {
  const fragment = document.createDocumentFragment();
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.label;
    if (item.code === "smart") {
      option.title = "中文自动译为英文，其他语言自动译为中文";
    }
    fragment.append(option);
  }
  select.replaceChildren(fragment);
}

function setSelectValue(select, value, fallback) {
  const target = value || fallback;
  const exists = Array.from(select.options).some((option) => option.value === target);
  select.value = exists ? target : fallback;
}

function init() {
  applyPlatformCopy();
  populateSelect(els.sourceLang, SOURCE_LANGUAGES);
  populateSelect(els.targetLang, TARGET_LANGUAGES);
  setSelectValue(els.sourceLang, "auto", "auto");
  setSelectValue(els.targetLang, state.settings.targetLang, "smart");
  syncSettingsUI();
  renderShortcut();
  bindEvents();
  registerRuntimeListeners();
  loadInitialState();
}

function applyPlatformCopy() {
  if (!FLOATING_MODE) return;
  document.body.classList.add("is-floating-panel");
  if (els.emptyDesc) {
    els.emptyDesc.textContent = "在任意网页划选单词或句子，译文会自动出现在这个翻译窗口。";
  }
  if (els.tipAuto) {
    els.tipAuto.textContent = "选中文字后，窗口自动更新译文";
  }
}

function bindEvents() {
  els.historyBtn.addEventListener("click", openHistory);
  els.settingsBtn.addEventListener("click", openOptions);
  els.sourceLang.addEventListener("change", handleSourceChange);
  els.targetLang.addEventListener("change", handleTargetChange);
  els.swapBtn.addEventListener("click", swapLanguages);
  els.autoTranslateToggle.addEventListener("change", handleAutoToggle);

  els.demoBtn.addEventListener("click", translateDemo);
  els.copySourceBtn.addEventListener("click", copySource);
  els.speakSourceBtn.addEventListener("click", speakSource);
  els.copyTranslationBtn.addEventListener("click", copyTranslation);
  els.speakTranslationBtn.addEventListener("click", speakTranslation);
  els.retryBtn.addEventListener("click", retryCurrent);
  els.slowRetryBtn.addEventListener("click", retryCurrent);
  els.translateBtn.addEventListener("click", retryCurrent);
  els.errorRetryBtn.addEventListener("click", retryCurrent);
  els.errorSettingsBtn.addEventListener("click", openOptions);

  els.historyBackBtn.addEventListener("click", closeHistory);
  els.clearHistoryBtn.addEventListener("click", clearHistory);
  els.historySettingsBtn.addEventListener("click", openOptions);
  els.historyList.addEventListener("click", onHistoryListClick);
  els.historyList.addEventListener("keydown", onHistoryListKeydown);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.view === "history") {
      closeHistory();
    }
  });
}

function registerRuntimeListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "XY_STATE" && message.current) {
      applyCurrent(message.current);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.settings) return;
    state.settings = normalizeSettings(changes.settings.newValue || {});
    state.historyEnabled = state.settings.historyEnabled;
    syncSettingsUI({ preserveTarget: false });
  });
}

async function loadInitialState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "XY_GET_STATE" });
    if (!response?.ok) {
      throw new Error(response?.error || "无法读取状态");
    }

    state.settings = normalizeSettings(response.settings || {});
    state.history = Array.isArray(response.history) ? response.history : [];
    state.historyEnabled = state.settings.historyEnabled;
    syncSettingsUI();

    if (response.current?.text) {
      applyCurrent(response.current, { initial: true });
    } else {
      showEmpty();
    }
  } catch (error) {
    console.warn("[选译] 初始化失败", error);
    showEmpty();
    toast(`后台暂时不可用，请重新打开${PANEL_NOUN}`);
  }
}

function applyCurrent(next, options = {}) {
  if (!next?.text) return;

  const previous = state.current;
  const nextTime = Number(next.updatedAt || 0);
  const previousTime = Number(previous?.updatedAt || 0);
  if (previous && !options.initial && nextTime < previousTime) {
    return;
  }

  const isNewRequest = !previous || previous.requestId !== next.requestId;
  state.current = next;

  if (isNewRequest) {
    stopSpeaking();
    setSelectValue(els.sourceLang, next.requestedSource, "auto");
    setSelectValue(
      els.targetLang,
      next.requestedTarget || state.settings.targetLang,
      "smart"
    );
    if (!options.initial) {
      els.mainScroll.scrollTop = 0;
    }
  }

  if (state.view === "history") {
    state.view = "translate";
    showTranslateShell();
  }

  render();
}

function render() {
  const current = state.current;
  if (!current?.text) {
    showEmpty();
    return;
  }

  els.emptyState.hidden = true;
  els.workspace.hidden = false;
  const result = current.result;
  const wordLike = looksLikeWord(current.text, result);
  els.workspace.classList.toggle("is-word", wordLike);

  renderSource(current);
  renderResult(current);
  renderPageContext(current);
  renderSwapButton(current);
}

function renderSource(current) {
  els.sourceText.textContent = current.text;

  const detected =
    current.result?.detectedLang ||
    (current.requestedSource && current.requestedSource !== "auto" ? current.requestedSource : "");
  if (detected) {
    els.detectedChip.textContent = languageLabel(detected);
    els.detectedChip.hidden = false;
  } else {
    els.detectedChip.hidden = true;
  }

  const showPhonetic = shouldShowPhonetics(current);
  const sourcePhonetic =
    current.status === "done" && showPhonetic ? current.result?.phonetic?.source : null;
  setPhonetic(els.sourcePhonetic, els.sourcePhoneticLabel, els.sourcePhoneticText, sourcePhonetic);

  const meta = [];
  if (current.charCount) meta.push(`${current.charCount} 字符`);
  meta.push(originLabel(current.origin));
  if (current.truncated) meta.push("已截断");
  els.sourceMeta.textContent = meta.join(" · ");

  els.copySourceBtn.disabled = false;
  els.speakSourceBtn.disabled = false;
}

function renderResult(current) {
  const status = current.status || "idle";
  const result = current.result;
  const isDone = status === "done" && Boolean(result);

  els.resultCard.dataset.status = status;
  els.loadingState.hidden = status !== "loading";
  els.resultContent.hidden = !isDone;
  els.idleState.hidden = status !== "idle";
  els.errorState.hidden = status !== "error";
  els.retryBtn.hidden = !isDone;
  els.providerChip.hidden = false;
  els.copyTranslationBtn.disabled = !isDone;
  els.speakTranslationBtn.disabled = !isDone;

  const providerName = isDone ? result.providerName || current.providerName : current.providerName;
  if (providerName) {
    els.providerChip.textContent = shortProviderName(providerName);
    els.providerChip.title = providerName;
    els.providerChip.hidden = false;
  } else {
    els.providerChip.hidden = true;
  }

  if (status === "loading") {
    clearSlowTimer();
    els.loadingProvider.textContent = current.providerName
      ? `${current.providerName} · 正在翻译`
      : "正在翻译";
    els.slowRetryBtn.hidden = true;
    state.slowTimer = setTimeout(() => {
      if (state.current?.status === "loading") {
        els.loadingProvider.textContent = "仍在翻译，可稍等或重试";
        els.slowRetryBtn.hidden = false;
      }
    }, 8000);
    els.resultFooter.hidden = true;
    els.dictionary.hidden = true;
    return;
  }

  clearSlowTimer();

  if (status === "done" && result) {
    els.translationText.textContent = result.translation || "";
    setPhonetic(
      els.targetPhonetic,
      els.targetPhoneticLabel,
      els.targetPhoneticText,
      shouldShowPhonetics(current) ? result.phonetic?.target : null
    );
    renderDictionary(result.dictionary);
    renderResultFooter(current, result);
    els.providerChip.title = result.via === "fallback"
      ? `${result.providerName || "翻译服务"}（主通道失败，已自动使用备用通道）`
      : result.providerName || "翻译服务";
    return;
  }

  if (status === "error") {
    const error = current.error || {};
    els.errorTitle.textContent =
      error.code === "too-long" ? "选中的内容太长" : "没有翻译成功";
    els.errorMessage.textContent = error.message || "请稍后重试。";
    els.errorRetryBtn.hidden = error.code === "too-long";
    els.errorSettingsBtn.hidden = !CONFIG_ERROR_CODES.has(error.code);
    els.resultFooter.hidden = true;
    els.dictionary.hidden = true;
    return;
  }

  els.idleMessage.textContent = state.settings.autoTranslate
    ? "已捕获选中内容，点击下方按钮翻译。"
    : "自动翻译已关闭，点击下方按钮翻译这段文字。";
  els.resultFooter.hidden = true;
  els.dictionary.hidden = true;
}

function renderResultFooter(current, result) {
  let latency = "";
  if (result.fromHistory) {
    latency = `来自历史 · ${formatWhen(current.createdAt)}`;
  } else if (result.cached) {
    latency = "本地缓存 · 即刻";
  } else {
    const elapsed = Number.isFinite(result.elapsedMs) ? `${result.elapsedMs} ms` : "已翻译";
    latency = `${shortProviderName(result.providerName || current.providerName)} · ${elapsed}`;
    if (result.via === "fallback") latency += " · 备用通道";
  }

  const detected = result.detectedLang || current.sourceLang;
  const pair = `${detected ? languageLabel(detected) : "自动检测"} → ${languageLabel(
    current.targetLang || result.targetLang
  )}`;

  els.latency.textContent = latency;
  els.resultPair.textContent = pair;
  els.resultPair.title = pair;
  els.resultFooter.hidden = false;
}

function setPhonetic(container, labelEl, textEl, phonetic) {
  if (!phonetic?.text) {
    container.hidden = true;
    labelEl.textContent = "";
    textEl.textContent = "";
    return;
  }
  labelEl.textContent = phonetic.label || "注音";
  textEl.textContent = phonetic.text;
  container.hidden = false;
}

function renderDictionary(groups) {
  const validGroups = Array.isArray(groups)
    ? groups.filter((group) => group && Array.isArray(group.terms) && group.terms.length)
    : [];

  els.dictionary.replaceChildren();
  if (!validGroups.length) {
    els.dictionary.hidden = true;
    return;
  }

  for (const group of validGroups.slice(0, 3)) {
    const row = document.createElement("div");
    row.className = "dict-group";

    const pos = document.createElement("span");
    pos.className = "dict-pos";
    pos.textContent = group.pos || "释义";

    const terms = document.createElement("div");
    terms.className = "dict-terms";
    for (const term of group.terms.slice(0, 4)) {
      const chip = document.createElement("span");
      chip.className = "dict-term";
      chip.textContent = term;
      terms.append(chip);
    }

    row.append(pos, terms);
    els.dictionary.append(row);
  }

  els.dictionary.hidden = false;
}

function renderPageContext(current) {
  let host = "";
  try {
    const url = new URL(current.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      host = url.hostname.replace(/^www\./i, "");
    } else if (url.protocol === "file:") {
      host = "本地文件";
    }
  } catch {
    host = "";
  }

  const title = current.title || "";
  if (!host && !title) {
    els.pageContext.hidden = true;
    return;
  }

  els.pageHost.textContent = host || "网页";
  els.pageTitle.textContent = title;
  els.pageTitle.hidden = !title;
  els.pageSeparator.hidden = !(host && title);
  els.pageContext.hidden = false;
}

function renderSwapButton(current) {
  const status = current?.status;
  const targetValue = els.targetLang.value;
  const detected = current?.result?.detectedLang;
  const targetLang = current?.targetLang;
  const canSwap =
    status === "done" &&
    Boolean(detected) &&
    Boolean(targetLang) &&
    targetValue !== "smart" &&
    detected !== targetLang;

  els.swapBtn.disabled = !canSwap;
  els.swapBtn.title = canSwap
    ? "交换原文和译文语言"
    : targetValue === "smart"
      ? "智能互译模式无需交换"
      : "获取译文后可交换语言";
}

function showEmpty() {
  els.emptyState.hidden = false;
  els.workspace.hidden = true;
  els.swapBtn.disabled = true;
}

function syncSettingsUI(options = {}) {
  const preserveTarget = Boolean(options.preserveTarget);
  els.autoTranslateToggle.checked = Boolean(state.settings.autoTranslate);
  if (!preserveTarget) {
    setSelectValue(els.targetLang, state.settings.targetLang, "smart");
  }
}

function renderShortcut() {
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || "");
  const kbd = document.createElement("kbd");
  kbd.textContent = isMac ? "⌥⇧T" : "Alt+Shift+T";
  els.shortcutHint.replaceChildren(
    kbd,
    document.createTextNode(FLOATING_MODE ? " 打开窗口" : " 打开侧栏")
  );
}

function shouldShowPhonetics(current) {
  const text = String(current?.text || "").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return text.length <= 64 && words <= 8;
}

function looksLikeWord(text, result) {
  if (Array.isArray(result?.dictionary) && result.dictionary.length > 0) return true;
  const value = String(text || "").trim();
  if (/^[A-Za-z][A-Za-z'’.-]*$/.test(value) && value.length <= 30) return true;
  return /^[\u3400-\u9fff·]{1,6}$/.test(value);
}

function shortProviderName(name) {
  return String(name || "翻译")
    .replace(/\s*翻译$/, "")
    .replace(/^Microsoft\s+/i, "");
}

function originLabel(origin) {
  switch (origin) {
    case "context-menu":
      return "右键翻译";
    case "demo":
      return "示例";
    case "history":
      return "历史记录";
    case "sidebar":
      return "手动翻译";
    default:
      return "划词";
  }
}

function handleSourceChange() {
  if (!state.current?.text) return;
  requestTranslation({
    source: els.sourceLang.value,
    target: els.targetLang.value
  });
}

async function handleTargetChange() {
  const target = els.targetLang.value;
  const saved = await saveSettings({ targetLang: target });
  if (!saved) {
    setSelectValue(els.targetLang, state.settings.targetLang, "smart");
    return;
  }

  if (state.current?.text) {
    requestTranslation({
      source: els.sourceLang.value,
      target
    });
  }
}

async function handleAutoToggle() {
  const enabled = els.autoTranslateToggle.checked;
  const saved = await saveSettings({ autoTranslate: enabled });
  if (!saved) {
    els.autoTranslateToggle.checked = state.settings.autoTranslate;
    return;
  }

  if (enabled && state.current?.status === "idle") {
    requestTranslation({
      source: els.sourceLang.value,
      target: els.targetLang.value
    });
  }
}

async function saveSettings(patch) {
  const previous = state.settings;
  state.settings = normalizeSettings({
    ...state.settings,
    ...patch,
    azure: {
      ...state.settings.azure,
      ...(patch.azure && typeof patch.azure === "object" ? patch.azure : {})
    },
    deepl: {
      ...state.settings.deepl,
      ...(patch.deepl && typeof patch.deepl === "object" ? patch.deepl : {})
    }
  });
  syncSettingsUI({ preserveTarget: true });

  try {
    const response = await chrome.runtime.sendMessage({
      type: "XY_UPDATE_SETTINGS",
      patch
    });
    if (!response?.ok) throw new Error(response?.error || "保存失败");
    state.settings = normalizeSettings(response.settings || state.settings);
    syncSettingsUI({ preserveTarget: true });
    return true;
  } catch (error) {
    console.warn("[选译] 保存设置失败", error);
    state.settings = previous;
    syncSettingsUI();
    toast("设置保存失败");
    return false;
  }
}

function requestTranslation(overrides = {}) {
  const current = state.current;
  const text = overrides.text || current?.text;
  if (!text) return;
  if (current?.truncated && !overrides.text) {
    toast("内容过长，请缩短选择后重试");
    return;
  }

  const payload = {
    type: "XY_TRANSLATE",
    text,
    source: overrides.source || els.sourceLang.value,
    target: overrides.target || els.targetLang.value,
    url: overrides.url !== undefined ? overrides.url : current?.url || "",
    title: overrides.title !== undefined ? overrides.title : current?.title || "",
    origin: overrides.origin || current?.origin || "sidebar"
  };

  try {
    chrome.runtime
      .sendMessage(payload)
      .then((response) => {
        if (!response?.ok) toast("翻译请求失败，请重试");
      })
      .catch(() => toast(`无法连接翻译后台，请重新打开${PANEL_NOUN}`));
  } catch {
    toast("扩展已重新加载，请刷新页面后重试");
  }
}

function retryCurrent() {
  if (!state.current?.text) return;
  requestTranslation({
    source: els.sourceLang.value,
    target: els.targetLang.value
  });
}

function translateDemo() {
  requestTranslation({
    text: DEMO_TEXT,
    source: "auto",
    target: els.targetLang.value,
    url: "",
    title: "",
    origin: "demo"
  });
}

async function swapLanguages() {
  const current = state.current;
  if (els.swapBtn.disabled || !current?.result?.detectedLang || !current.targetLang) return;

  const newTarget = current.result.detectedLang;
  const newSource = current.targetLang;
  if (newTarget === newSource) return;

  setSelectValue(els.sourceLang, newSource, "auto");
  setSelectValue(els.targetLang, newTarget, "smart");
  await saveSettings({ targetLang: newTarget });
  requestTranslation({
    source: newSource,
    target: newTarget
  });
}

function copySource() {
  if (!state.current?.text) return;
  copyText(state.current.text, state.current.truncated ? "已复制可见部分" : "已复制原文");
}

function copyTranslation() {
  const text = state.current?.result?.translation;
  if (!text) return;
  copyText(text, "已复制译文");
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
    return;
  } catch {
    // 使用旧版复制接口兜底。
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    toast(ok ? successMessage : "复制失败，请手动复制");
  } catch {
    toast("复制失败，请手动复制");
  }
}

function speakSource() {
  const current = state.current;
  if (!current?.text) return;
  const detected =
    current.result?.detectedLang ||
    (current.requestedSource !== "auto" ? current.requestedSource : "") ||
    "en";
  speakText(current.text, detected, els.speakSourceBtn);
}

function speakTranslation() {
  const current = state.current;
  const text = current?.result?.translation;
  if (!text) return;
  speakText(text, current.targetLang || current.result?.targetLang, els.speakTranslationBtn);
}

function speakText(text, language, button) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    toast("当前环境不支持语音朗读");
    return;
  }

  if (state.speakingButton === button) {
    stopSpeaking();
    return;
  }

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang(language);
  utterance.rate = 0.96;
  utterance.onend = () => {
    if (state.speakingButton === button) stopSpeakingUI();
  };
  utterance.onerror = (event) => {
    if (state.speakingButton === button) stopSpeakingUI();
    if (event.error !== "interrupted" && event.error !== "canceled") {
      toast("朗读失败，可能缺少对应语音包");
    }
  };

  state.speakingButton = button;
  button.classList.add("is-active");
  window.speechSynthesis.speak(utterance);
}

function stopSpeakingUI() {
  if (state.speakingButton) {
    state.speakingButton.classList.remove("is-active");
    state.speakingButton = null;
  }
}

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  stopSpeakingUI();
}

function openOptions() {
  let opened = false;

  const openFallback = () => {
    if (opened) return;
    opened = true;
    try {
      const url = chrome.runtime.getURL("src/options.html");
      const pending = chrome.windows?.create?.({
        url,
        type: "popup",
        width: 1000,
        height: 860,
        focused: true
      });
      if (pending?.catch) {
        pending.catch(() => {
          try {
            chrome.tabs.create({ url });
          } catch {
            toast("无法打开设置页");
          }
        });
      }
    } catch {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html") });
      } catch {
        toast("无法打开设置页");
      }
    }
  };

  try {
    if (typeof chrome.runtime.openOptionsPage !== "function") {
      openFallback();
      return;
    }
    const result = chrome.runtime.openOptionsPage();
    if (result && typeof result.then === "function") {
      result.then(() => { opened = true; }, openFallback);
    } else {
      opened = true;
    }
  } catch {
    openFallback();
  }
}

/* ---------- History ---------- */

async function openHistory() {
  state.view = "history";
  els.appHeader.hidden = true;
  els.mainView.hidden = true;
  els.appFooter.hidden = true;
  els.historyView.hidden = false;
  els.historyEmpty.hidden = true;
  els.clearHistoryBtn.disabled = true;
  els.historyCount.textContent = "正在读取…";
  els.historyList.replaceChildren(textDiv("history-loading", "正在读取翻译历史…"));
  stopSpeaking();

  try {
    const response = await chrome.runtime.sendMessage({ type: "XY_GET_HISTORY" });
    if (!response?.ok) throw new Error(response?.error || "读取失败");
    state.history = Array.isArray(response.history) ? response.history : [];
    state.historyEnabled = response.historyEnabled !== false;
    renderHistory();
  } catch (error) {
    console.warn("[选译] 读取历史失败", error);
    els.historyCount.textContent = "读取失败";
    els.historyList.replaceChildren();
    els.historyEmpty.hidden = false;
    els.historyEmptyText.textContent = "暂时无法读取历史记录";
    els.historySettingsBtn.hidden = true;
    els.clearHistoryBtn.disabled = true;
  }
}

function closeHistory() {
  if (state.view !== "history") return;
  state.view = "translate";
  setTranslateView();
  historyBtnFocus();
}

function showTranslateShell() {
  els.historyView.hidden = true;
  els.appHeader.hidden = false;
  els.mainView.hidden = false;
  els.appFooter.hidden = false;
}

function setTranslateView() {
  showTranslateShell();
  if (state.current?.text) {
    render();
  } else {
    showEmpty();
  }
}

function historyBtnFocus() {
  els.historyBtn.focus({ preventScroll: true });
}

function renderHistory() {
  const entries = state.history;
  els.historyCount.textContent = entries.length ? `${entries.length} 条记录` : "暂无记录";
  els.clearHistoryBtn.disabled = entries.length === 0;

  if (!entries.length) {
    els.historyList.replaceChildren();
    els.historyEmpty.hidden = false;
    els.historyEmptyText.textContent = state.historyEnabled
      ? "还没有翻译记录"
      : "翻译历史已在设置中关闭";
    els.historySettingsBtn.hidden = state.historyEnabled;
    return;
  }

  els.historyEmpty.hidden = true;
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    fragment.append(createHistoryItem(entry));
  }
  els.historyList.replaceChildren(fragment);
}

function createHistoryItem(entry) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.dataset.id = entry.id;
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", `历史记录：${String(entry.text || "").slice(0, 40)}`);

  const main = document.createElement("div");
  main.className = "history-main";

  const source = document.createElement("p");
  source.className = "history-source";
  source.textContent = entry.text || "";

  const translation = document.createElement("p");
  translation.className = "history-translation";
  translation.textContent = entry.result?.translation || "";

  const meta = document.createElement("div");
  meta.className = "history-meta";

  const pair = document.createElement("span");
  const sourceLabel = entry.sourceLang ? languageLabel(entry.sourceLang) : "自动";
  pair.textContent = `${sourceLabel} → ${languageLabel(entry.targetLang)}`;

  const time = document.createElement("span");
  time.textContent = formatWhen(entry.at);

  meta.append(pair, time);
  main.append(source, translation, meta);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "history-delete";
  deleteBtn.dataset.id = entry.id;
  deleteBtn.title = "删除这条记录";
  deleteBtn.setAttribute("aria-label", "删除这条记录");
  deleteBtn.innerHTML =
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></svg>';

  item.append(main, deleteBtn);
  return item;
}

function onHistoryListClick(event) {
  const deleteButton = event.target.closest(".history-delete");
  if (deleteButton) {
    event.stopPropagation();
    void deleteHistoryEntry(deleteButton.dataset.id);
    return;
  }

  const item = event.target.closest(".history-item");
  if (item) {
    loadHistoryEntry(item.dataset.id);
  }
}

function onHistoryListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest(".history-delete")) return;
  const item = event.target.closest(".history-item");
  if (!item) return;
  event.preventDefault();
  loadHistoryEntry(item.dataset.id);
}

function loadHistoryEntry(id) {
  const entry = state.history.find((item) => item.id === id);
  if (!entry?.result?.translation) return;

  stopSpeaking();

  const result = {
    ...entry.result,
    fromHistory: true,
    cached: false,
    elapsedMs: 0
  };

  state.current = {
    requestId: `history_${entry.id}`,
    text: entry.text,
    charCount: String(entry.text || "").length,
    truncated: false,
    url: entry.url || "",
    title: entry.title || "",
    origin: "history",
    createdAt: entry.at,
    updatedAt: Date.now(),
    status: "done",
    requestedSource: "auto",
    sourceLang: entry.sourceLang || result.detectedLang || "",
    requestedTarget: entry.requestedTarget || entry.targetLang,
    targetLang: entry.targetLang || result.targetLang,
    provider: entry.provider,
    providerName: entry.providerName || result.providerName,
    auto: true,
    error: null,
    result
  };

  setSelectValue(els.sourceLang, "auto", "auto");
  setSelectValue(
    els.targetLang,
    entry.requestedTarget || entry.targetLang,
    state.settings.targetLang
  );

  state.view = "translate";
  setTranslateView();
  els.mainScroll.scrollTop = 0;
}

async function deleteHistoryEntry(id) {
  if (!id) return;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "XY_DELETE_HISTORY",
      id
    });
    if (!response?.ok) throw new Error();
    state.history = state.history.filter((entry) => entry.id !== id);
    renderHistory();
    toast("已删除");
  } catch {
    toast("删除失败，请重试");
  }
}

async function clearHistory() {
  if (!state.history.length) return;
  if (!window.confirm("清空全部翻译历史？此操作不可撤销。")) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: "XY_CLEAR_HISTORY" });
    if (!response?.ok) throw new Error();
    state.history = [];
    renderHistory();
    toast("历史记录已清空");
  } catch {
    toast("清空失败，请重试");
  }
}

function formatWhen(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `今天 ${time}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function textDiv(className, text) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  return div;
}

function clearSlowTimer() {
  if (state.slowTimer) {
    clearTimeout(state.slowTimer);
    state.slowTimer = null;
  }
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 1800);
}

init();
