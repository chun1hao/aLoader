const { parse } = require("@vue/compiler-sfc");
const { parse: babelParse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");
const path = require("path");

// 配置常量
const CONFIG = {
  EXECUTE_NAME: "useHeader",
  FILE_PATH: "@/hooks/header",
  TRACK_FILES: require("../autoimport.config").keys(), // 埋点配置文件
};

module.exports = function (source) {
  const filePath = normalizePath(this.resourcePath);

  // 快速过滤无需处理的文件
  if (!shouldProcess(filePath, CONFIG.TRACK_FILES)) return source;

  // 解析SFC
  const { descriptor } = parse(source);
  if (!descriptor.script) return source;

  // 转换AST
  const ast = babelParse(descriptor.script.content, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  // AST处理逻辑
  processAST(ast, CONFIG);

  // 生成新代码
  const newScriptContent = generateCode(ast);
  return regenerateSFC(descriptor, newScriptContent);
};

// ---------- 工具函数 ----------
function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldProcess(filePath, trackFiles) {
  const fileName = path.basename(filePath, ".vue");
  return trackFiles.some((name) => name === fileName);
}

// ---------- AST处理核心 ----------
function processAST(ast, config) {
  let isImported = false;
  let setupFunction = null;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === config.FILE_PATH) {
        isImported = true;
        path.stop();
      }
    },

    ExportDefaultDeclaration(path) {
      const setupProp = path
        .get("declaration")
        .get("properties")
        .find((p) => p.get("key").isIdentifier({ name: "setup" }));

      if (setupProp) {
        setupFunction = setupProp.get("value");
      }
    },
  });

  // 插入import
  if (!isImported) {
    injectImport(ast, config);
  }

  // 插入执行语句
  if (setupFunction) {
    injectFunctionCall(setupFunction, config.EXECUTE_NAME);
  }
}

function injectImport(ast, { EXECUTE_NAME, FILE_PATH }) {
  const importNode = t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier(EXECUTE_NAME))],
    t.stringLiteral(FILE_PATH)
  );

  ast.program.body.unshift(importNode);
}

function injectFunctionCall(setupFunction, funcName) {
  const blockStatement = setupFunction.get("body");

  // 优先插入到return语句前
  const returnIndex = blockStatement.node.body.findIndex(
    (n) => n.type === "ReturnStatement"
  );

  const position = returnIndex !== -1 ? returnIndex : 0;
  const callExpression = t.expressionStatement(
    t.callExpression(t.identifier(funcName), [])
  );

  blockStatement.node.body.splice(position, 0, callExpression);
}

// ---------- SFC生成 ----------
function generateCode(ast) {
  return generator(ast, {
    retainLines: true,
    compact: false,
  }).code;
}

function regenerateSFC(descriptor, scriptContent) {
  const { template, styles, customBlocks } = descriptor;

  return [
    template?.content ? `<template>${template.content}</template>` : "",
    `<script>\n${scriptContent}\n</script>`,
    ...styles.map(
      (s) => `<style ${attrsToString(s.attrs)}>${s.content}</style>`
    ),
    ...customBlocks.map(
      (b) => `<${b.type} ${attrsToString(b.attrs)}>${b.content}</${b.type}>`
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function attrsToString(attrs) {
  return Object.entries(attrs)
    .map(([k, v]) => (v === true ? k : `${k}="${v}"`))
    .join(" ");
}
