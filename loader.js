const { parseSRLContent } = require('./compile')
const transfer = require('./tsd')
const fs = require('fs')
const path = require('path')

module.exports = function(content) {
  const options = this.getOptions()
  const file = this.resourcePath
  if (file && options && options.ts) {
    const ts = transfer(content)

    // 替换文件后缀，比如把 .srl.md 替换为 .srl.ts
    if (options.tsFileExtReplace) {
      const s = file.split(path.sep)
      s.pop()
      const tsfile = s.join(path.sep) + '.ts'
      fs.writeFile(tsfile, ts, () => {})
    }
    else {
      fs.writeFile(file + '.ts', ts, () => {})
    }
  }

  const { $, ...mapping } = parseSRLContent(content)
  const codes = []
  if ($) {
    codes.push(`const $ = \`${$}\`;`)
  }
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    if ($) {
      codes.push(`export const ${name} = \`$\{$}; ${code}\`;`)
    }
    else {
      codes.push(`export const ${name} = \`${code}\`;`)
    }
  })
  return codes.join('\n')
}
