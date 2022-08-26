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

export function parseKey(str) {
  let name = ''
  let decorators = ''
  for (let i = 0; i < str.length; i ++) {
    const char = str[i]
    if (/^\w$/.test(char)) {
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
  let content = str
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
