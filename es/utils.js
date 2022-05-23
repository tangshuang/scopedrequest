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
