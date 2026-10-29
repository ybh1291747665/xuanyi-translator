/**
 * 划词捕获脚本：只负责把“用户当前选中的文字”发给后台。
 * 不读取整页内容、不修改页面 DOM、不注入任何 UI。
 */
(() => {
  "use strict";

  if (window.__xuanYiSelectionLoaded) return;
  window.__xuanYiSelectionLoaded = true;

  const MAX_SEND_LENGTH = 12000;
  const DEDUPE_MS = 900;
  let timer = null;
  let lastText = "";
  let lastSentAt = 0;
  let disabled = false;

  function normalize(raw) {
    return String(raw || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_SEND_LENGTH);
  }

  function readSelection() {
    const active = document.activeElement;

    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      if (active.tagName === "INPUT" && String(active.type || "").toLowerCase() === "password") {
        return "";
      }
      try {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        if (typeof start === "number" && typeof end === "number" && end > start) {
          return active.value.slice(start, end);
        }
      } catch {
        // 某些 input 类型不支持 selectionStart/End，继续尝试页面选区。
      }
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return "";
    return selection.toString();
  }

  function sendSelection(text) {
    if (disabled || !text) return;
    if (!/[\p{L}\p{N}]/u.test(text)) return;

    const now = Date.now();
    if (text === lastText && now - lastSentAt < DEDUPE_MS) return;
    lastText = text;
    lastSentAt = now;

    const payload = {
      type: "XY_SELECTION",
      text,
      url: location.href,
      title: document.title ? document.title.slice(0, 240) : "",
      origin: "selection"
    };

    try {
      const result = chrome.runtime.sendMessage(payload);
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch {
      // 扩展被更新或重新加载后，旧页面里的脚本会失效，静默退出。
      disabled = true;
    }
  }

  function checkSelection() {
    const text = normalize(readSelection());
    if (!text) return;
    sendSelection(text);
  }

  function scheduleCheck(delay = 60) {
    clearTimeout(timer);
    timer = setTimeout(checkSelection, delay);
  }

  document.addEventListener(
    "mouseup",
    (event) => {
      if (event.button !== 0) return;
      scheduleCheck(60);
    },
    true
  );

  document.addEventListener(
    "keyup",
    (event) => {
      const isSelectAll =
        (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "a";
      if (event.key === "Shift" || event.shiftKey || isSelectAll) {
        scheduleCheck(90);
      }
    },
    true
  );

  document.addEventListener(
    "touchend",
    () => {
      scheduleCheck(280);
    },
    { capture: true, passive: true }
  );

  // 部分页面会阻止事件冒泡，下面再挂一次 window 捕获作为兜底。
  window.addEventListener(
    "mouseup",
    (event) => {
      if (event.button !== 0) return;
      scheduleCheck(80);
    },
    true
  );
})();
