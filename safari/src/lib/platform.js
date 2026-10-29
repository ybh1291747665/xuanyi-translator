/**
 * 当前页面所在的宿主形态。Safari 没有 sidePanel，因此使用浮动窗口。
 * 通过 manifest 权限而不是 UA 判断，便于在 Chromium 中测试 Safari 构建。
 */
export function isFloatingPanelMode() {
  try {
    const manifest = globalThis.chrome?.runtime?.getManifest?.();
    const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];
    return !permissions.includes("sidePanel") || !globalThis.chrome?.sidePanel?.open;
  } catch {
    return false;
  }
}
