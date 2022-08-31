const { interpret, TYPES } = require('./index')

const clear = (str) => {
  if (!str) {
    return str
  }

  if (str[str.length - 1] === ';') {
    str = str.substring(0, str.length - 1)
  }

  str = str.replace(/;([}>\|\]])/g, '$1')
  str = str.replace(/;+/g, ';')
  str = str.replace(/:\s+/g, ':')

  return str
}

function parseSRLContent(content) {
  const lines = content.split('\n')
  const usable = []
  let item = null
  let inSide = false
  lines.forEach((line) => {
    const text = line.trim()
    if (/##+\s+\w+$/.test(text)) {
      item = {
        name: text.replace(/#+\s+/, ''),
        codes: [],
      }
    }
    else if (item && inSide && text.indexOf('```') === 0) {
      const codes = item.codes.join('').replace(/,(}|]|>)/g, '$1').replace(/([\{\}\[\]<>,]\w+:)\s+/g, '$1').replace(/\s?->\s?/, '->')
      item.codes = clear(codes)
      usable.push(item)
      item = null
      inSide = false
    }
    else if (text.indexOf('```') === 0 && item && !inSide) {
      inSide = true
    }
    else if (text.indexOf('```') === 0 && !item && !inSide) {
      item = {
        name: '$',
        codes: [],
      }
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
      else if (['{', '[', '<'].indexOf(end) > -1) {
        str = text
      }
      else {
        str = text + ';'
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

function transferToTypescirpt(code, { shared, name }) {
  const originCode = shared ? shared + ';' + code : code
  const { groups, fragments } = interpret(originCode)

  const dataList = []
  const resMapping = {}
  let output = null

  const params = {}
  const findParams = str => str && str.replace(/\{(.*?)\}/g, (_, key) => params[key] = 1)

  groups.forEach((group, gIndex) => {
    group.forEach((item, index) => {
      const { type, req, res, alias, args, options } = item
      if (type !== TYPES.COMMAND) {
        return
      }

      if (req) {
        dataList.push(req)
      }

      if (gIndex === groups.length - 1 && index === group.length - 1) {
        output = res
      }
      // 暂不支持compose组合，后面再支持
      // else if (alias) {
      //   resMapping[alias] = res
      // }

      args && args.forEach(findParams)
      options && Object.values(options).forEach(findParams)
    })
  })

  const paramsKeys = Object.keys(params)
  let paramsText = ''
  if (paramsKeys.length) {
    paramsText += '{'
    paramsKeys.forEach((content) => {
      const [key, value] = content.split(':')
      paramsText += key + ':' + (['string', 'number', 'boolean'].includes(value) ? value : 'any') + ';'
    })
    paramsText += '}'
  }

  const usedFragments = {}

  const transfer = (shape) => {
    if (Array.isArray(shape)) {
      let text = ''
      const [operators, tag, exps = []] = shape
      if (operators.indexOf('&') > -1) {
        const frag = name ? name.toUpperCase() + '_' + tag : tag
        usedFragments[frag] = 1
        text += frag
      }
      else if (!exps.length) {
        text += tag
      }
      // 暂不支持表达式
      else {
        text += 'any'
      }

      text += ';'
      return text
    }

    if (shape.type === TYPES.OBJECT) {
      let text = '{'
      const { nodes } = shape
      nodes.forEach((node) => {
        const { key: keyInfo, value } = node
        const [key, decorators] = keyInfo
        const keyText = decorators.indexOf('?') > -1 ? key + '?' : key
        text += keyText + ':' + (value ? transfer(value) : 'any;')
      })
      text += '};'
      return text
    }

    if (shape.type === TYPES.ARRAY) {
      const itemTexts = []
      const { nodes } = shape
      nodes.forEach((node) => {
        const { value } = node
        const type = transfer(value)
        itemTexts.push(type)
      })
      const itemText = itemTexts.join('|') || 'any'
      const text = 'Array<' + itemText + '>;'
      return text
    }

    if (shape.type === TYPES.TUPLE) {
      const itemTexts = []
      const { nodes } = shape
      nodes.forEach((node) => {
        const { value } = node
        const type = transfer(value)
        itemTexts.push(type)
      })
      const itemText = itemTexts.join(',')
      const text = '[' + itemText + '];'
      return text
    }

    // 其他未知情况全部any
    return 'any';
  }

  const dataInput = dataList.map(transfer)
  const inputType = dataInput.length ? `[${dataInput.join(',')}]` : null
  const outputType = output ? transfer(output) : null

  // 必须放在后面，因为在上面的transfer中会对usedFragments进行收集
  const fragmentsKeys = Object.keys(fragments)
  let fragmentsMapping = {}
  fragmentsKeys.forEach((key) => {
    const frag = name ? name.toUpperCase() + '_' + key : key
    if (!usedFragments[frag]) {
      return
    }
    const fragment = fragments[key]
    const fragType = transfer(fragment)
    fragmentsMapping[frag] = clear(fragType)
  })

  return {
    types: fragmentsMapping,
    params: clear(paramsText),
    input: clear(inputType),
    output: clear(outputType),
  }
}

module.exports = {
  parseSRLContent,
  transferToTypescirpt,
}
