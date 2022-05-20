/**
 * 将SRL转换为typescript
 */

const { parseSRLFileContent, transferToTypescirpt } = require('./compile')
const fs = require('fs')

module.exports = function(file, options) {
  const content = fs.readFileSync(file).toString()
  const mapping = parseSRLFileContent(content)
  const codes = []
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    const types = transferToTypescirpt(name, code, options)
    codes.push(...types)
  })
  return codes.join('\n')
}
