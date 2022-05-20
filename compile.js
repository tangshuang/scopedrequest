const { interpret } = require('./index')

function parseSRLFileContent(content) {
  const lines = content.split('\n')
  const usable = []
  let item = null
  let inSide = false
  lines.forEach((line) => {
    const text = line.trim()
    if (/#+\s+\w+$/.test(text)) {
      item = {
        name: text.replace(/#+\s+/, ''),
        codes: [],
      }
    }
    else if (item && inSide && text.indexOf('```') === 0) {
      item.codes = item.codes.join('').replace(/,(}|]|>)/g, '$1').replace(/([\{\}\[\]<>,]\w+:)\s+/g, '$1').replace(/\s?->\s?/, '->')
      usable.push(item)
      item = null
      inSide = false
    }
    else if (text.indexOf('```') === 0 && item && !inSide) {
      inSide = true
    }
    else if (text.indexOf('//') === 0) {
      return
    }
    else if (item && inSide) {
      const end = text[text.length - 1]
      let str = ''
      if (end === ';' || end === ',') {
        str = text
      }
      else if (['{', '}', '[', ']', '<', '>'].indexOf(end) > -1) {
        str = text
      }
      else {
        str = text + ','
      }
      item.codes.push(str)
    }
  })
  const mapping = {}
  usable.forEach(({ name, codes }) => {
    mapping[name] = codes
  })
  return mapping
}

function transferToTypescirpt(name, code, options) {
  const { groups, fragments } = interpret(code)
  const types = []

  // TODO

  return types
}

module.exports = {
  parseSRLFileContent,
  transferToTypescirpt,
}
