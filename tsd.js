/**
 * 将SRL转换为typescript
 */

const { parseSRLContent, transferToTypescirpt } = require('./compile')

module.exports = function(content) {
  const { $, ...mapping } = parseSRLContent(content)
  const codes = []
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    const { params, input, output, types } = transferToTypescirpt(code, { shared: $, name })

    Object.keys(types).forEach((key) => {
      const frag = types[key]
      codes.push(`type ${key} = ${frag}`)
    })

    codes.push(`export declare const ${name}: string`)
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
  return contents
}
