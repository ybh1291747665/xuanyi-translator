import { TARGET_LANGUAGES } from "./lib/languages.js";
import { isFloatingPanelMode } from "./lib/platform.js";
import { normalizeSettings } from "./lib/settings.js";

const $ = (id) => document.getElementById(id);

const els = {
  saveState: $("saveState"),
  brandSub: $("brandSub"),
  step1Title: $("step1Title"),
  step1Text: $("step1Text"),
  step2Text: $("step2Text"),
  step3Text: $("step3Text"),
  autoDesc: $("autoDesc"),
  shortcutDesc: $("shortcutDesc"),
  shortcutLabel: $("shortcutLabel"),
  shortcutPathHint: $("shortcutPathHint"),
  shortcutCopyRow: $("shortcutCopyRow"),
  saveText: $("saveText"),
  activeProviderLabel: $("activeProviderLabel"),
  googleConfig: $("googleConfig"),
  azureConfig: $("azureConfig"),
  deeplConfig: $("deeplConfig"),
  azureKey: $("azureKey"),
  azureRegion: $("azureRegion"),
  deeplKey: $("deeplKey"),
  defaultTarget: $("defaultTarget"),
  autoTranslate: $("autoTranslate"),
  historyEnabled: $("historyEnabled"),
  clearHistoryBtn: $("clearHistoryBtn"),
  historyCount: $("historyCount"),
  clearCacheBtn: $("clearCacheBtn"),
  cacheStatus: $("cacheStatus"),
  testBtn: $("testBtn"),
  testBtnLabel: $("testBtnLabel"),
  testResult: $("testResult"),
  shortcutKeys: $("shortcutKeys"),
  copyShortcutBtn: $("copyShortcutBtn"),
  shortcutCopyStatus: $("shortcutCopyStatus"),
  version: $("version")
};

const PROVIDER_NAMES = {
  google: "Google 翻译",
  azure: "Microsoft Azure",
  deepl: "DeepL"
};

const HISTORY_KEY = "xy_history_v1";

let settings = normalizeSettings({});
let editVersion = 0;
let saveTimer = null;
let isSaving = false;
let testSequence = 0;
let historyTotal = 0;
let isTesting = false;

init();

async function init() {
  populateTargets();
  renderShortcut();
  bindEvents();

  try {
    const stored = await chrome.storage.local.get(["settings", HISTORY_KEY]);
    settings = normalizeSettings(stored?.settings || {});
    historyTotal = Array.isArray(stored?.[HISTORY_KEY]) ? stored[HISTORY_KEY].length : 0;
  } catch (error) {
    console.warn("[选译] 读取设置失败", error);
    setSaveState("error", "读取设置失败");
  }

  applySettingsToForm();
  applyPlatformCopy();
  updateHistoryCount();
  setVersion();
}

function applyPlatformCopy() {
  if (!isFloatingPanelMode()) return;
  document.body.classList.add("is-floating-panel");

  if (els.brandSub) els.brandSub.textContent = "划词翻译";
  if (els.step1Title) els.step1Title.textContent = "打开扩展";
  if (els.step1Text) {
    els.step1Text.textContent = "点击 Safari 工具栏的「选译」图标，打开浮动的翻译窗口。";
  }
  if (els.step2Text) {
    els.step2Text.textContent = "选中单词、短语或句子。翻译窗口会立刻显示原文和译文，无需复制粘贴。";
  }
  if (els.step3Text) {
    els.step3Text.textContent = "如果翻译窗口还没打开，右键选中文字，选择「用『选译』翻译」即可直接打开并翻译。";
  }
  if (els.autoDesc) {
    els.autoDesc.textContent = "关闭后只捕获原文，需要在翻译窗口中点击翻译。";
  }
  if (els.shortcutDesc) els.shortcutDesc.textContent = "需要时快速唤出翻译窗口。";
  if (els.shortcutLabel) els.shortcutLabel.textContent = "打开翻译窗口";
  if (els.shortcutPathHint) {
    els.shortcutPathHint.textContent = "可以在 Safari 设置的「扩展」中查看或修改快捷键。";
  }
  if (els.shortcutCopyRow) els.shortcutCopyRow.hidden = true;
}

function bindEvents() {
  document.querySelectorAll('input[name="provider"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateProviderVisibility();
      markChanged(80);
    });
  });

  els.defaultTarget.addEventListener("change", () => markChanged(80));
  els.autoTranslate.addEventListener("change", () => markChanged(80));
  els.historyEnabled.addEventListener("change", () => markChanged(80));

  for (const input of [els.azureKey, els.azureRegion, els.deeplKey]) {
    input.addEventListener("input", () => markChanged(500));
    input.addEventListener("blur", flushPendingSave);
  }

  document.querySelectorAll(".reveal-btn").forEach((button) => {
    button.addEventListener("click", () => toggleSecret(button));
  });

  els.testBtn.addEventListener("click", testProvider);
  els.clearHistoryBtn.addEventListener("click", clearHistory);
  els.clearCacheBtn.addEventListener("click", clearCache);
  els.copyShortcutBtn.addEventListener("click", copyShortcutPath);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushPendingSave();
  });

  window.addEventListener("pagehide", () => {
    flushPendingSave();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[HISTORY_KEY]) {
      historyTotal = Array.isArray(changes[HISTORY_KEY].newValue)
        ? changes[HISTORY_KEY].newValue.length
        : 0;
      updateHistoryCount();
    }

    if (!changes.settings) return;
    if (isSaving || isTesting || saveTimer) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) return;

    settings = normalizeSettings(changes.settings.newValue || {});
    applySettingsToForm();
  });
}

function populateTargets() {
  const fragment = document.createDocumentFragment();
  for (const language of TARGET_LANGUAGES) {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = language.label;
    if (language.code === "smart") {
      option.title = "中文自动译为英文，其他语言自动译为中文";
    }
    fragment.append(option);
  }
  els.defaultTarget.replaceChildren(fragment);
}

function applySettingsToForm() {
  document.querySelectorAll('input[name="provider"]').forEach((input) => {
    input.checked = input.value === settings.provider;
  });

  setSelectValue(els.defaultTarget, settings.targetLang, "smart");
  els.autoTranslate.checked = Boolean(settings.autoTranslate);
  els.historyEnabled.checked = Boolean(settings.historyEnabled);
  els.azureKey.value = settings.azure?.key || "";
  els.azureRegion.value = settings.azure?.region || "";
  els.deeplKey.value = settings.deepl?.key || "";

  updateProviderVisibility();
}

function setSelectValue(select, value, fallback) {
  const exists = Array.from(select.options).some((option) => option.value === value);
  select.value = exists ? value : fallback;
}

function selectedProvider() {
  const checked = document.querySelector('input[name="provider"]:checked');
  return checked?.value || "google";
}

function updateProviderVisibility() {
  const provider = selectedProvider();
  els.googleConfig.hidden = provider !== "google";
  els.azureConfig.hidden = provider !== "azure";
  els.deeplConfig.hidden = provider !== "deepl";
  els.activeProviderLabel.textContent = PROVIDER_NAMES[provider] || "翻译服务";
}

function collectPatch() {
  return {
    provider: selectedProvider(),
    targetLang: els.defaultTarget.value,
    autoTranslate: els.autoTranslate.checked,
    historyEnabled: els.historyEnabled.checked,
    azure: {
      key: els.azureKey.value.trim(),
      region: els.azureRegion.value.trim()
    },
    deepl: {
      key: els.deeplKey.value.trim()
    }
  };
}

function effectiveSettings() {
  const patch = collectPatch();
  return normalizeSettings({
    ...settings,
    ...patch,
    azure: {
      ...settings.azure,
      ...patch.azure
    },
    deepl: {
      ...settings.deepl,
      ...patch.deepl
    }
  });
}

function markChanged(delay = 400) {
  editVersion += 1;
  testSequence += 1;
  clearTestResult();
  setSaveState("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistSettings();
  }, delay);
}

function flushPendingSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  void persistSettings();
}

async function persistSettings() {
  const patch = collectPatch();
  const version = editVersion;
  isSaving = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "XY_UPDATE_SETTINGS",
      patch
    });
    if (!response?.ok) {
      throw new Error(response?.error || "保存失败");
    }

    if (version === editVersion) {
      settings = normalizeSettings(response.settings || {});
      setSaveState("saved");
    } else {
      setSaveState("saving");
    }
  } catch (error) {
    console.warn("[选译] 保存设置失败", error);
    if (version === editVersion) {
      setSaveState("error");
    }
  } finally {
    isSaving = false;
  }
}

function setSaveState(state, text) {
  els.saveState.dataset.state = state;
  els.saveText.textContent =
    text ||
    (state === "saving" ? "保存中…" : state === "error" ? "保存失败" : "已自动保存");
}

function updateHistoryCount() {
  els.historyCount.textContent = historyTotal
    ? `${historyTotal} 条本地记录`
    : "暂无记录";
  els.clearHistoryBtn.disabled = historyTotal === 0;
}

async function testProvider() {
  flushPendingSave();

  const sequence = ++testSequence;
  const testSettings = effectiveSettings();
  isTesting = true;
  els.testBtn.disabled = true;
  els.testBtn.classList.add("is-testing");
  els.testBtnLabel.textContent = "测试中…";
  els.testResult.className = "test-result";
  els.testResult.textContent = "正在连接当前服务…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "XY_TEST_PROVIDER",
      settings: testSettings
    });

    if (sequence !== testSequence) return;

    if (response?.ok) {
      els.testResult.className = "test-result is-ok";
      els.testResult.textContent = `连接成功 · ${response.providerName} · ${response.elapsedMs} ms · “${truncate(response.translation, 56)}”`;
    } else {
      els.testResult.className = "test-result is-error";
      els.testResult.textContent = `连接失败：${response?.error?.message || "请检查设置后重试"}`;
    }
  } catch (error) {
    if (sequence !== testSequence) return;
    els.testResult.className = "test-result is-error";
    els.testResult.textContent = "连接失败：无法调用扩展后台，请重新打开设置页。";
    console.warn("[选译] 测试翻译服务失败", error);
  } finally {
    isTesting = false;
    if (sequence === testSequence) {
      els.testBtn.disabled = false;
      els.testBtn.classList.remove("is-testing");
      els.testBtnLabel.textContent = "测试当前服务";
    }
  }
}

function clearTestResult() {
  els.testResult.className = "test-result";
  els.testResult.textContent = "";
  els.testBtn.classList.remove("is-testing");
  els.testBtnLabel.textContent = "测试当前服务";
  els.testBtn.disabled = false;
}

function toggleSecret(button) {
  const input = document.getElementById(button.dataset.target);
  if (!input) return;
  const willShow = input.type === "password";
  input.type = willShow ? "text" : "password";
  button.textContent = willShow ? "隐藏" : "显示";
  button.setAttribute("aria-label", willShow ? "隐藏密钥" : "显示密钥");
}

async function clearHistory() {
  if (!historyTotal) return;
  if (!window.confirm("清空全部翻译历史？此操作不可撤销。")) return;

  const originalText = els.clearHistoryBtn.textContent;
  els.clearHistoryBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: "XY_CLEAR_HISTORY" });
    if (!response?.ok) throw new Error("清空失败");
    historyTotal = 0;
    updateHistoryCount();
    els.clearHistoryBtn.textContent = "已清空";
    window.setTimeout(() => {
      els.clearHistoryBtn.textContent = originalText;
    }, 1500);
  } catch (error) {
    console.warn("[选译] 清空历史失败", error);
    updateHistoryCount();
    els.clearHistoryBtn.textContent = "清空失败";
    window.setTimeout(() => {
      els.clearHistoryBtn.textContent = originalText;
    }, 1500);
  }
}

async function clearCache() {
  const originalText = els.clearCacheBtn.textContent;
  els.clearCacheBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: "XY_CLEAR_CACHE" });
    if (!response?.ok) throw new Error("清理失败");
    els.cacheStatus.textContent = "缓存已清理";
    els.clearCacheBtn.textContent = "已清除";
  } catch (error) {
    console.warn("[选译] 清理缓存失败", error);
    els.cacheStatus.textContent = "清理失败，请重试";
    els.clearCacheBtn.textContent = "清理失败";
  } finally {
    window.setTimeout(() => {
      els.clearCacheBtn.disabled = false;
      els.clearCacheBtn.textContent = originalText;
    }, 1600);
  }
}

async function copyShortcutPath() {
  const path = "edge://extensions/shortcuts";
  try {
    await navigator.clipboard.writeText(path);
    els.shortcutCopyStatus.textContent = "已复制";
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = path;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      els.shortcutCopyStatus.textContent = "已复制";
    } catch {
      els.shortcutCopyStatus.textContent = "复制失败";
    }
  }

  window.setTimeout(() => {
    els.shortcutCopyStatus.textContent = "";
  }, 1800);
}

function renderShortcut() {
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || "");
  const kbd = document.createElement("kbd");
  if (isMac) {
    kbd.textContent = "⌥ ⇧ T";
  } else {
    kbd.textContent = "Alt + Shift + T";
  }
  els.shortcutKeys.replaceChildren(kbd);
}

function setVersion() {
  try {
    els.version.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    els.version.textContent = "";
  }
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length)}…` : text;
}
