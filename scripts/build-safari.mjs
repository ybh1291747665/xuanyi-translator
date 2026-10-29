#!/usr/bin/env node
/**
 * 生成可供 Safari 26「Add Temporary Extension」直接加载的目录。
 *
 * Safari 不支持 Chrome 的 sidePanel，也不支持 background.type = module，
 * 所以这里生成：
 *   - 独立的 Safari manifest
 *   - 一个无依赖、无 import 的经典后台脚本（用于 background.service_worker）
 *
 * 不依赖 npm。运行：node scripts/build-safari.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "safari");
const expectedPrefix = projectRoot + path.sep;

if (!outputDir.startsWith(expectedPrefix)) {
  throw new Error(`Refusing to write outside project: ${outputDir}`);
}

const rootManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));

function copyFile(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const target = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function writeFile(relativePath, content) {
  const target = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

// 页面和内容脚本需要的资源。
for (const file of [
  "src/content.js",
  "src/browser-compat.js",
  "src/sidepanel.html",
  "src/sidepanel.css",
  "src/sidepanel.js",
  "src/options.html",
  "src/options.css",
  "src/options.js",
  "src/lib/languages.js",
  "src/lib/providers.js",
  "src/lib/settings.js",
  "src/lib/cache.js",
  "src/lib/platform.js"
]) {
  copyFile(file);
}

for (const icon of fs.readdirSync(path.join(projectRoot, "icons"))) {
  if (icon.endsWith(".png")) copyFile(path.join("icons", icon));
}

// 自定义无依赖打包：把这些 ES Module 顺序拼接成经典 Service Worker。
const modules = [
  "src/browser-compat.js",
  "src/lib/languages.js",
  "src/lib/providers.js",
  "src/lib/settings.js",
  "src/lib/cache.js",
  "src/background.js"
];

function stripModuleSyntax(source, file) {
  let code = source
    .replace(/^import\s+[^;\n]+;\s*$/gm, "")
    .replace(/^export\s+/gm, "");

  if (/^import\s/m.test(code)) {
    throw new Error(`Unresolved import remains in ${file}`);
  }
  if (/^export\s/m.test(code)) {
    throw new Error(`Unresolved export remains in ${file}`);
  }
  return code.trim();
}

const sections = modules.map((file) => {
  const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
  return `/* ---- ${file} ---- */\n${stripModuleSyntax(source, file)}`;
});

const bundle = `/* 选译 Safari background bundle：由 scripts/build-safari.mjs 生成，请勿直接修改。 */\n(() => {\n"use strict";\n${sections.join("\n\n")}\n})();\n`;
writeFile("background.js", bundle);

// 至少做一次语法检查。Node 只负责校验，不执行。
execFileSync(process.execPath, ["--check", path.join(outputDir, "background.js")], {
  stdio: "inherit"
});

const safariManifest = {
  manifest_version: 3,
  name: "选译 · 划词翻译（Safari）",
  version: rootManifest.version,
  description: "选中网页上的单词或句子，在浮动翻译窗口中立即查看译文。支持 Google、Azure、DeepL。",
  icons: rootManifest.icons,
  permissions: ["storage", "contextMenus"],
  host_permissions: rootManifest.host_permissions,
  background: {
    service_worker: "background.js"
  },
  action: {
    default_title: "选译：选中文字后打开翻译窗口",
    default_icon: rootManifest.action.default_icon
  },
  options_ui: {
    page: "src/options.html"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/browser-compat.js", "src/content.js"],
      run_at: "document_idle",
      all_frames: true
    }
  ],
  commands: {
    "open-panel": {
      suggested_key: {
        default: "Alt+Shift+T",
        mac: "Alt+Shift+T"
      },
      description: "打开选译翻译窗口"
    }
  }
};

writeFile("manifest.json", `${JSON.stringify(safariManifest, null, 2)}\n`);

writeFile(
  "README.md",
  `# 选译 · Safari 临时加载版

这个目录是给 **Safari 26+** 使用的独立构建，不需要 Xcode，也没有 npm 依赖。Chrome/Edge 版见项目根目录的 \`README.md\`。

> 由 \`scripts/build-safari.mjs\` 生成；如需修改功能，请改 \`src/\` 后重新构建。

## 和 Edge 版的区别

- Safari 没有 Chrome 的 \`sidePanel\` API，所以点击工具栏图标会打开一个约 420px 宽的**浮动翻译窗口**，而不是浏览器原生停靠侧栏。
- 该窗口会保持打开；再次点击图标会聚焦已有窗口。它不会遮挡或修改网页内容。
- 由于是临时安装，**退出 Safari 后扩展会被卸载**，下次启动需要重新添加。长期使用需要 Xcode 签名并安装一个包含扩展的 App。

## 安装（Safari 26）

1. 打开 Safari → 设置 → 高级，勾选「显示网页开发者功能」（如果已有「开发者」标签页可跳过）。
2. 切换到「开发者」标签页，点击 **「添加临时扩展…」**。
3. 选择当前这个 \`safari\` 文件夹（包含 \`manifest.json\` 的那一层），输入 Mac 密码授权。
4. 打开 Safari 设置 → 扩展，启用「选译」，并按需授予网站访问权限（要划词翻译，需要允许访问网页）。
5. 点击 Safari 工具栏上的「选译」图标，浮动翻译窗口就会打开。
6. 刷新已经打开的网页，然后选中文字即可翻译。

## 快捷键

Safari 26 的扩展设置中可以查看/修改快捷键。默认快捷键是 \`Alt+Shift+T\`（macOS 上显示为 \`⌥⇧T\`）。

## 限制

- **没有原生停靠侧栏**：浮动窗口是 Safari WebExtension 能做到的最接近形态。
- **临时安装**：关闭 Safari 后失效；这是 Apple 对未签名扩展的限制。
- 需要在 Safari 设置中允许扩展访问网页，否则内容脚本无法捕获划词。
- 默认 Google 公共接口可能因网络或频率限制不可用，可在设置中改用 Azure / DeepL。
- 不支持 \`safari://\`、扩展商店等受保护页面。

## 重新构建

在项目根目录运行：

\`\`\`bash
node scripts/build-safari.mjs
\`\`\`

构建会用 \`src/\` 生成 \`background.js\`、Safari manifest 和本文件；不要直接修改 \`safari/\` 内的生成文件。
`
);

console.log(`Safari build ready: ${outputDir}`);
console.log("Load this folder via Safari > Settings > Developer > Add Temporary Extension…");
