/**
 * 将SRL转换为typescript
 */

const { parseSRLContent, transferToTypescirpt } = require('./compile')
const fs = require('fs')

module.exports = function(content, tsdFile) {
  const mapping = parseSRLContent(content)
  const codes = []
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    const [params, input, output] = transferToTypescirpt(code)

    if (params) {
      codes.push(`export type ${name}Params = ${params}`)
    }
    if (input) {
      codes.push(`export type ${name}Input = ${input}`)
    }
    if (output) {
      codes.push(`export type ${name}Ouptut = ${output}`)
    }
  })
  const contents = codes.join('\n')
  fs.writeFileSync(tsdFile, contents);
}
