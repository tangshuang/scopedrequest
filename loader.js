const { parseSRLFileContent } = require('./compile')

module.exports = function(content) {
  // const file = this.resourcePath
  // const options = this.getOptions()
  const mapping = parseSRLFileContent(content)
  const codes = []
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    codes.push(`export const ${name} = \`${code}\`;`)
  })
  return codes.join('\n')
}
