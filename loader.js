const compile = require('./compile')

module.exports = function(content) {
  const mapping = compile(content)
  const codes = []
  Object.keys(mapping).forEach((name) => {
    const code = mapping[name]
    codes.push(`export const ${name} = \`${code}\`;`)
  })
  return codes.join('\n')
}
