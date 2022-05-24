const { parseSRLContent } = require('./compile')
const transfer = require('./tsd')
const fs = require('fs')

module.exports = function(content) {
  const options = this.getOptions()
  const file = this.resourcePath
  if (file && options && options.ts) {
    const tsd = transfer(content)
    fs.writeFile(file + '.d.ts', tsd, () => {})
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
