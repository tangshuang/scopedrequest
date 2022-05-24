const { parseSRLContent } = require('./compile')
const transfer = require('./tsd')

module.exports = function(content) {
  const options = this.getOptions()
  const file = this.resourcePath
  if (file && options && options.ts) {
    transfer(content, file + '.d.ts')
  }

  const { $, ...mapping } = parseSRLContent(content)
  const codes = []
  if ($) {
    codes.push(`const $ = \`${$}\`;`)
  }
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    codes.push(`export const ${name} = \`$\{$} ${code}\`;`)
  })
  return codes.join('\n')
}
