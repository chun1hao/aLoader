const { parse } = require("@vue/compiler-sfc");
const { parse: babelParse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const autoImportConfig = require("../autoimport.config");

const EXECUTE_NAME = "useHeader";
const FILE_PATH = "/hooks/header";

module.exports = function (context) {
  // 处理window上面路径\
  const resource = transWin(this.resource);
  // 判断配置文件是否有配置当前页面
  const needAddFlag = autoImportConfig.some(
    (i) => resource.indexOf(i + ".vue") >= 0
  );

  if (!needAddFlag) return context;
  // 利用sfc包 获取里面的script，并转化为ast
  const descriptor = parse(context).descriptor;
  let ast;
  if (descriptor.script) {
    ast = babelParse(descriptor.script.content, {
      sourceType: "module",
    });
  } else {
    return context;
  }

  let hasImportHeader = false; // 是否需要插入import语句
  traverse(ast, {
    Program: (nodePath) => {
      const bodyPath = nodePath.get("body");
      if (!bodyPath) return;
      // 是否已经引入文件，如果有引入不会再插入import 和 执行语句
      for (let path of bodyPath) {
        if (path.isImportDeclaration()) {
          if (
            path.get("source").isStringLiteral() &&
            path.get("source").node.value.indexOf(FILE_PATH) > 0
          ) {
            hasImportHeader = true;
            break;
          }
        }
      }

      if (!hasImportHeader) {
        // 插入import ... from
        const importDeclaration = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(EXECUTE_NAME))],
          t.stringLiteral("@" + FILE_PATH)
        );
        bodyPath[0].insertBefore(importDeclaration);

        // 插入 userHeader()，需要有setup，默认插入在return语句之前，没有return语句插入在最前面
        for (let path of bodyPath) {
          if (path.isExportDefaultDeclaration()) {
            const properties = path.get("declaration").node.properties;
            if (properties && properties.length) {
              for (let property of properties) {
                if (property.key && property.key.name == "setup") {
                  let insertIdx = 0;
                  try {
                    let idx = property.body.body.findIndex(
                      (i) => i.type == "ReturnStatement"
                    );
                    if (idx !== undefined) insertIdx = idx;
                    const expressionStatement = t.expressionStatement(
                      t.callExpression(t.identifier(EXECUTE_NAME), [])
                    );
                    property.body.body.splice(
                      insertIdx,
                      0,
                      expressionStatement
                    );
                  } catch (e) {
                    console.log(
                      `================\n${resource}，插入执行header失败\n================`
                    );
                  }
                }
              }
            }
          }
        }
      }
    },
  });

  const { code } = generator(ast);
  descriptor.script.content = code;
  context = generateSfc(descriptor);

  return context;
};

function transWin(str) {
  if (!str) return str;
  return str.split("\\").join("/");
}

function generateSfc(descriptor) {
  let result = "";

  const { template, script, scriptSetup, styles, customBlocks } = descriptor;
  [template, script, scriptSetup, ...styles, ...customBlocks].forEach(
    (block) => {
      if (block && block.type) {
        result += `<${block.type}${Object.entries(block.attrs).reduce(
          (attrCode, [attrName, attrValue]) => {
            if (attrValue === true) {
              attrCode += ` ${attrName}`;
            } else {
              attrCode += ` ${attrName}="${attrValue}"`;
            }

            return attrCode;
          },
          " "
        )}>${block.content}</${block.type}>`;
      }
    }
  );

  return result;
}
