import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const lwcRoot = path.join(root, "force-app", "main", "default", "lwc");
const lucidePath = path.join(
  root,
  "node_modules",
  "lucide-static",
  "icon-nodes.json"
);

const lucideNames = new Set(
  Object.keys(JSON.parse(fs.readFileSync(lucidePath, "utf8")))
);
const findings = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    if (/\.(html|js|css)$/.test(entry.name)) return [entryPath];
    return [];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function report(file, line, message) {
  findings.push(`${path.relative(root, file)}:${line}: ${message}`);
}

for (const file of walk(lwcRoot)) {
  if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;

  const source = fs.readFileSync(file, "utf8");

  const lightningIconIndex = source.indexOf("lightning-icon");
  if (lightningIconIndex !== -1) {
    report(
      file,
      lineNumber(source, lightningIconIndex),
      "lightning-icon is not allowed"
    );
  }

  const legacyIconMatch = source.match(
    /\b(?:utility|standard|action|custom):[A-Za-z0-9_]+/
  );
  if (legacyIconMatch) {
    report(
      file,
      lineNumber(source, legacyIconMatch.index),
      `legacy SLDS icon namespace is not allowed: ${legacyIconMatch[0]}`
    );
  }

  const iconRegex =
    /<c-newton-selector-icon\b[\s\S]*?<\/c-newton-selector-icon>/g;
  for (const match of source.matchAll(iconRegex)) {
    const tag = match[0].replace(/\s+/g, " ");
    const nameMatch = tag.match(/\bname="([^"]+)"/);
    if (nameMatch && !lucideNames.has(nameMatch[1])) {
      report(
        file,
        lineNumber(source, match.index),
        `static icon name is not in Lucide: ${nameMatch[1]}`
      );
    }

    const classMatch = tag.match(/\bclass="([^"]+)"/);
    if (classMatch && /\bslds-icon(?:_| |$)/.test(classMatch[1])) {
      report(
        file,
        lineNumber(source, match.index),
        `slds-icon classes should not be applied to newtonSelectorIcon: ${classMatch[1]}`
      );
    }

    if (classMatch && /\bslds-float_right\b/.test(classMatch[1])) {
      report(
        file,
        lineNumber(source, match.index),
        'floating newtonSelectorIcon breaks icon/text symmetry; use a flex wrapper and box="button"'
      );
    }

    if (classMatch && /\bslds-button__icon\b/.test(classMatch[1])) {
      report(
        file,
        lineNumber(source, match.index),
        'slds-button__icon should not be applied to newtonSelectorIcon; use box="button"'
      );
    }

    if (
      classMatch &&
      /\bslds-input__icon\b/.test(classMatch[1]) &&
      !/\bbox="input"/.test(tag)
    ) {
      report(
        file,
        lineNumber(source, match.index),
        'input-positioned newtonSelectorIcon must use box="input" for centered glyph sizing'
      );
    }

    if (!/\bsize\s*=\s*(?:"[^"]+"|\{[^}]+\})/.test(tag)) {
      report(
        file,
        lineNumber(source, match.index),
        "newtonSelectorIcon must declare size explicitly"
      );
    }
  }

  if (file.endsWith(".js")) {
    const iconPropertyRegex = /\b(?:icon|optionIcon)\s*:\s*["']([^"']+)["']/g;
    for (const match of source.matchAll(iconPropertyRegex)) {
      const iconName = match[1];
      if (!lucideNames.has(iconName)) {
        report(
          file,
          lineNumber(source, match.index),
          `JS icon option name is not in Lucide: ${iconName}`
        );
      }
    }
  }
}

// Field-type icon maps: every value must be a Lucide icon name.
const typeIconMaps = [
  {
    file: path.join(
      lwcRoot,
      "newtonSelectorFlowCpeUtilityHelpers",
      "newtonSelectorFlowCpeUtilityHelpers.js"
    ),
    label: "TYPE_ICON_MAP",
    body: /export\s+const\s+TYPE_ICON_MAP\s*=\s*(?:Object\.freeze\(\s*)?\{([\s\S]*?)\}/,
    entry: /\b\w+\s*:\s*["']([^"']*)["']/g
  },
  {
    file: path.join(
      root,
      "force-app",
      "main",
      "default",
      "classes",
      "NewtonSelectorFlowCpeDescribeService.cls"
    ),
    label: "field-type icon map",
    body: /Map<String,\s*String>\s+\w*ICON\w*\s*=\s*new\s+Map<String,\s*String>\s*\{([\s\S]*?)\}\s*;/i,
    entry: /'[^']*'\s*=>\s*'([^']*)'/g
  }
];

for (const map of typeIconMaps) {
  const source = fs.existsSync(map.file)
    ? fs.readFileSync(map.file, "utf8")
    : "";
  const bodyMatch = source.match(map.body);
  if (!bodyMatch) {
    report(map.file, 1, `${map.label} not found; cannot audit its icon names`);
    continue;
  }
  const bodyStart = bodyMatch.index + bodyMatch[0].indexOf(bodyMatch[1]);
  for (const match of bodyMatch[1].matchAll(map.entry)) {
    if (!lucideNames.has(match[1])) {
      report(
        map.file,
        lineNumber(source, bodyStart + match.index),
        `${map.label} value is not in Lucide: ${match[1]}`
      );
    }
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Lucide icon usage audit passed.");
