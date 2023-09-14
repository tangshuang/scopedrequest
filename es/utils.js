export function isMatch(str, ...args) {
  return args.some(arg => str.toLowerCase() === arg)
}

export async function sleep(time = 16) {
  // 使用异步来和run对齐，也不会阻塞进程
  await new Promise((r) => {
    // eslint-disable-next-line no-undef
    setTimeout(r, time)
  })
}

export function getStringHash(str) {
  let hash = 5381
  let i = str.length

  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }

  return hash >>> 0
}

export function parseFn(str) {
  const matched = str.match(/([a-zA-Z0-9_]+)(\((.*?)\))?/);
  const [, name, , _params] = matched;
  const params = typeof _params === 'string'
    ? _params
      .split(',')
      .map(item => item.trim())
      .filter(item => !!item)
    : null;
  return [name, params];
}

export function parseKey(str) {
  let name = ''
  let decorators = ''
  for (let i = 0; i < str.length; i ++) {
    const char = str[i]
    if (/^\w$|\./.test(char)) {
      name += char
    }
    else {
      decorators = str.substring(i)
      break
    }
  }

  return [name, decorators]
}

export function parseValue(str) {
  let operators = ''
  let content = ''
  for (let i = 0; i < str.length; i ++) {
    const char = str[i]
    if (['&'].includes(char)) {
      operators += char
    }
    else {
      content = str.substring(i, str.length)
      break
    }
  }

  return [operators, content]
}

export function tryParse(str) {
  if (typeof str === 'string') {
    try {
      return JSON.parse(str)
    }
    catch (e) {
      return str
    }
  }
  return str
}

export function parseKeyPath(obj, keyPath) {
  const chain = keyPath.split('.')
  let curr = obj
  for (let i = 0, len = chain.length; i < len; i ++) {
    const at = chain[i]
    curr = curr[at]
    if (typeof curr === 'undefined') {
      return
    }
    if (curr === null) {
      return null
    }
  }
  return curr
}
