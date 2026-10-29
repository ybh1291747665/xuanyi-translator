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
