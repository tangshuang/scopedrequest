import { TYPES, interpret } from './compiler.js'
import { isMatch, sleep } from './utils.js'

const defaultMockers = {
  string: () => () => {
    const CHARS = '0123456789abcdefghigklmnopqrstuvwxyz'
    let text = ''
    for (let i = 0; i < 8; i++) {
      text += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
    }
    return text
  },
  number: () => () => +((Math.random() * 100).toFixed(2)),
  boolean: () => () => [true, false][parseInt((Math.random() * 100 % 2) + '', 10)],
}

const defaultFormatters = {
  string: () => function(value, keyPath) {
    const { debug, target, command, direction } = this

    if (typeof value === 'string') {
      return value
    }

    debug?.({
      command,
      url: target,
      keyPath,
      should: 'string',
      receive: value,
      direction,
    })
    return value === null || value === undefined ? '' : '' + value
  },
  number: (defaultValue) => function(value, keyPath) {
    const { debug, target, command, direction } = this

    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value
    }

    if (typeof value === 'string' && !Number.isNaN(+value)) {
      return +value
    }

    debug?.({
      command,
      url: target,
      keyPath,
      should: 'number',
      receive: value,
      direction,
    })
    return +defaultValue || 0
  },
  boolean: () => function(value, keyPath) {
    const { debug, target, command, direction } = this

    if (typeof value === 'boolean') {
      return value
    }

    debug?.({
      command,
      url: target,
      keyPath,
      should: 'boolean',
      receive: value,
      direction,
    })
    return !!value
  },
}

export class ScopedRequest {
  constructor(options = {}) {
    this.options = options
  }

  compile(code) {
    const { ast } = interpret(code)

    const commands = ast.body

    const fragments = {}
    const groups = [[]]
    let groupIndex = 0

    commands.forEach((item) => {
      if (item.type !== TYPES.COMMAND) {
        return
      }

      if (isMatch(item.command, 'fragment')) {
        fragments[item.args[0]] = item.body
      }
      else if (isMatch(item.command, 'await')) {
        groups[groupIndex].push(item)
        groupIndex ++
        groups[groupIndex] = []
      }
      else if (isMatch(item.command, 'compose')) {
        groupIndex ++
        groups[groupIndex] = [item]
      }
      else {
        groups[groupIndex].push(item)
      }
    })

    return { groups, fragments, commands, ast }
  }

  async run(code, params = {}, dataList, context) {
    // ?????????????????????????????????????????????catch???????????????
    await sleep()

    const { debug } = this.options
    const { groups, fragments, commands } = this.compile(code)

    /**
     * ???dataList??????????????????
     */
    const postAndPut = commands.filter((item) => item.type === TYPES.COMMAND && item.req)
    if (postAndPut.length) {
      // ????????????????????????????????????????????????????????????????????????????????????
      if (postAndPut.length === 1 && dataList && !Array.isArray(dataList)) {
        dataList = [dataList]
      }
      else if (!dataList || !Array.isArray(dataList) || dataList.length !== postAndPut.length) {
        throw new Error(`901: run(${code})???dataList???????????????${postAndPut.length}??????????????????`)
      }
    }

    // ????????????alias
    const results = {}

    // ????????????????????????????????????
    const replaceBy = (str, warning) => {
      return str.replace(/{([a-z][a-zA-Z0-9_]+)}/g, (matched, key) => {
        if (params && typeof params[key] !== 'undefined') {
          return params[key]
        }

        // ??????????????????
        if (warning && (!params || typeof params[key] === 'undefined')) {
          debug?.({
            level: 'error',
            message: `${str} ${key} ????????????`,
          })
        }

        return matched
      }).replace(/\((.*?)\)/g, (_, expcom) => {
        const exps = expcom.split(',')
        const exp = exps[exps.length - 1]
        const v = this.parse(exp, results)
        return v
      })
    }

    // ???url???search??????????????????
    const replaceUrl = (str) => {
      // ??????????????????url????????????????????????????????????????????????? {xxx?} ???????????????
      const [pathname, ...queries] = str.split('?')
      const search = queries.join('?')
      const path = replaceBy(pathname, true)
      if (!search) {
        return path
      }

      const pairs = search.split('&').map((item) => {
        const [key, value] = item.split('=')
        if (!value) {
          return
        }

        if (/^\{[a-z][a-zA-Z0-9_]+[!?]?\}$/.test(value)) {
          const content = value.substring(1, value.length - 1)
          const end = content[content.length - 1]
          let paramKey = content
          if (end === '!' || end === '?') {
            paramKey = content.substring(0, content.length - 1)
          }

          // ???????????????????????????params?????????????????????param?????????url???????????????query
          if (typeof params[paramKey] === 'undefined') {
            if (end !== '?') {
              debug?.({
                level: 'error',
                message: `${str} ${paramKey} ????????????`,
              })
            }
            // ??????????????????????????????
            if (end === '!') {
              return `${key}=`
            }
            return
          }

          return `${key}=${params[paramKey]}`
        }
      }).filter(item => item)

      if (!pairs.length) {
        return path
      }

      return path + '?' + pairs.join('&')
    }

    const allFetchings = []

    const fn = async (node, index = -1) => {
      const { args = [], options = {}, alias, command, req, res } = node
      const [url] = args

      if (!url) {
        throw new Error(`800: run(${code})??? ${command} ?????????url`)
      }

      const { headers = {} } = options

      const realUrl = replaceUrl(url)
      const realHeaders = Object.keys(headers).reduce((obj, key) => {
        obj[key] = replaceBy(headers[key], true)
        return obj
      }, {})

      let realData = null
      const postData = index > -1 ? dataList[index] : null
      if (req && postData) {
        realData = this.generate(
          {
            structure: req,
            data: postData,
            fragments,
            results,
          },
          {
            command,
            url,
            alias,
            req,
            target: realUrl,
            root: postData,
            use: 'req',
            keyPath: [],
            direction: 'request',
          },
        )
      }

      const data = await this.fetch(realUrl, { method: command, headers: realHeaders }, realData, context)

      let output = null
      if (res) {
        output = this.generate(
          {
            structure: res,
            data,
            fragments,
            results,
          },
          {
            command,
            url,
            alias,
            res,
            target: realUrl,
            root: data,
            use: 'res',
            keyPath: [],
            direction: 'response',
          },
        )
      }

      allFetchings[index] = {
        url: realUrl,
        data,
        method: command,
        headers: realHeaders,
        payload: realData,
        node,
      }

      return output
    }

    const compose = (node) => {
      const { command, alias, res } = node
      return this.generate(
        {
          structure: res,
          fragments,
          results,
        },
        {
          command,
          alias,
          res,
          use: 'res',
          keyPath: [],
          direction: 'response',
        },
      )
    }

    return await new Promise((resolve, reject) => {
      let i = 0
      let meet = 0
      let isCompelet = false

      const allRequests = []

      const through = () => {
        const group = groups[i]
        if (!group || isCompelet) {
          return
        }
        return new Promise((next, stop) => {
          const awaits = []
          const awaitItem = group.find(item => item.type === TYPES.COMMAND && isMatch(item.command, 'await'))
          const awaitNames = awaitItem ? awaitItem.args : []

          group.forEach((item, n) => {
            const { alias, command, req } = item

            if (isMatch(command, 'await')) {
              return
            }

            // ????????????????????????
            const isFinal = i === groups.length - 1 && n === group.length - 1

            if (isMatch(command, 'compose')) {
              // compose ?????? await ??????
              Promise.all(allRequests).then(() => {
                const data = compose(item)
                if (alias) {
                  results[alias] = data
                }
                if (isFinal) {
                  resolve(data)
                  isCompelet = true
                }
              })
              return
            }

            let index = -1
            if (req) {
              index = meet
              meet ++
            }
            const p = fn(item, index).then((data) => {
              if (alias) {
                results[alias] = data
              }
              if (isFinal) {
                resolve(data)
                isCompelet = true
              }
            })
            if (alias) {
              allRequests.push(p)
            }
            if (awaitNames.includes(alias)) {
              awaits.push(p)
            }
          })

          Promise.all(awaits).then(() => {
            i ++
            next()
          }).catch(stop)
        }).then(through).catch(reject)
      }
      through()
    }).then((data) => {
      if (this.options.onData) {
        return this.options.onData(data, { code, params, context, requests: allFetchings })
      }
      return data
    })
  }

  parse(exp, data) {
    const { scopex, debug, fns = {} } = this.options

    if (scopex) {
      const scope = new scopex({ ...data, ...fns })
      return scope.parse(exp)
    }

    if (/^[a-zA-Z]+(\.?|$)/.test(exp)) {
      const chain = exp.split('.')
      let curr = data
      for (let i = 0, len = chain.length; i < len; i ++) {
        const key = chain[i]
        if (curr && typeof curr === 'object') {
          curr = curr[key]
        }
        else {
          return
        }
      }
      return curr
    }

    try {
      exp = exp.replace(/'/g, '"').replace(/(\w+):/g, '"$1":')
      return JSON.parse(exp)
    }
    catch (e) {
      debug?.({
        message: `????????????????????????${exp}`,
        level: 'debug',
      })
      return exp
    }
  }

  async fetch(url, config = {}, data, context) {
    if (this.options.fetch) {
      return await this.options.fetch(url, config, data, context)
    }
    const { method } = config
    const options = { ...config }
    if (data && isMatch(method, 'post', 'put')) {
      options.body = JSON.stringify(data)
    }
    // eslint-disable-next-line no-undef
    const res = await fetch(url, options)
    return await res.json()
  }

  /**
   *
   * @param {*} node
   * @param {*} data ???????????????????????????????????????????????????????????????????????????????????????
   * @param {*} params
   * @param {number} [params.index] ??????????????????????????????????????????????????????????????????????????????
   * @returns
   */
  create(node, data, { fragments, results, context, index }) {
    const { debug } = this.options
    const { keyPath = [], command, target, alias, direction } = context

    const { key: keyInfo, value: valueInfo } = node
    const [name, decorators] = keyInfo || []

    if (typeof index !== 'undefined' && typeof name !== 'undefined' && +name !== +index) {
      debug?.({
        command,
        url: target,
        keyPath,
        alias,
        message: `???????????????${keyPath.join('.')}.${name}???????????? ${index} ?????????????????????`,
        level: 'debug',
        direction,
      })
    }

    const key = name || index
    // ????????????????????????
    const [, field = key] = decorators?.match(/~(\w+)/) || []
    const value = data[field]

    const output = {
      key,
    }

    // ?????????null???undefined??????????????????????????????????????????null
    if ((value === null || typeof value === 'undefined') && decorators?.indexOf('??') > -1) {
      output.value = null
      return output
    }

    // ?????????????????????
    if (typeof value === 'undefined' && decorators?.indexOf('?') > -1) {
      return
    }

    const currContext = {
      ...context,
      keyPath: [...keyPath, key],
      debug,
    }

    const transfer = (decorators, data, structure) => {
      // ??????!???????????????
      if (decorators?.indexOf('!') > -1) {
        if ((structure.type === TYPES.ARRAY || structure.type === TYPES.TUPLE) && !Array.isArray(data)) {
          return [data]
        }
        else if (structure.type === TYPES.OBJECT && Array.isArray(data) && data[0] && typeof data[0] === 'object') {
          return data[0]
        }
        else if (structure.type === TYPES.ARRAY || structure.type === TYPES.TUPLE) {
          return []
        }
        else if (structure.type === TYPES.OBJECT) {
          return {}
        }
      }
      return data
    }

    // ???????????????
    if (!valueInfo) {
      output.value = value
      return output
    }

    // ??????????????????
    if (Array.isArray(valueInfo)) {
      const [operators, tag, exps = []] = valueInfo
      if (tag && operators === '&') {
        const fragment = fragments[tag]
        if (!fragment) {
          throw new Error(`${tag} Fragment at ${keyPath.join('.')}.${key} ?????????????????????`)
        }

        const useData = transfer(decorators, value, fragment)

        const out = this.generate({
          structure: fragment,
          data: useData,
          fragments,
          results,
        }, currContext)

        output.value = out
        return output
      }
      else if (tag) {
        const out = this.format(value, tag, exps.map(exp => this.parse(exp, results)), currContext)
        output.value = out
        return output
      }
      else if (exps.length) {
        const out = this.parse(exps[exps.length - 1], results)
        output.value = out
        return output
      }
      else {
        throw new Error(`?????? ${valueInfo.join(' ')} at ${keyPath.join('.')}.${key} ???????????????`)
      }
    }

    // ??????????????????
    if (valueInfo && typeof valueInfo === 'object') {
      const useData = transfer(decorators, value, valueInfo)
      const out = this.generate({
        structure: valueInfo,
        data: useData,
        fragments,
        results,
      }, currContext)
      output.value = out
      return output
    }
  }

  generate(information, context) {
    // compose????????????data
    const { structure, results, fragments } = information
    const { keyPath = [], command, target, alias, direction } = context
    const { debug } = this.options

    let data = information.data

    /**
     * ????????????
     */
    if (structure.type === TYPES.OBJECT) {
      if (typeof data !== 'object' || !data) {
        debug?.({
          command,
          url: target,
          keyPath,
          alias,
          should: 'object',
          receive: data,
          direction,
        })
        // ???????????????????????????????????????????????????????????????????????????
        data = {}
      }

      const output = {}
      structure.nodes.forEach((node) => {
        const gened = this.create(node, data, { fragments, results, context })
        if (gened) {
          const { key, value } = gened
          output[key] = value
        }
      })

      if (this.options.keepProperty) {
        const keys = Object.keys(data)
        keys.forEach((key) => {
          const value = data[key]
          if (this.options.keepProperty(key, value, data)) {
            output[key] = value
          }
        })
      }

      return output
    }

    /**
     * ????????????
     */
    if (structure.type === TYPES.ARRAY) {
      if (!Array.isArray(data)) {
        // array like??????????????????????????????????????????????????????????????????????????? { 0: ..., 1: ..., 2: ... }???????????????????????????????????????
        if (data && typeof data === 'object' && Object.keys(data).every(key => /^\d+$/.test(key))) {
          const keys = Object.keys(data)
          data = []
          keys.forEach((key) => {
            const value = data[key]
            data[key] = value
          })
          debug?.({
            command,
            url: target,
            keyPath,
            alias,
            should: 'array',
            receive: data,
            message: '???ArrayLike????????????????????????',
            level: 'warn',
            direction,
          })
        }
        else {
          debug?.({
            command,
            url: target,
            keyPath,
            alias,
            should: 'array',
            receive: data,
            direction,
          })
          // ??????????????????
          return []
        }
      }

      const { nodes } = structure

      // ?????????????????????
      // ??????????????????????????????????????????????????????????????????????????????????????????
      if (!nodes.length) {
        return data
      }

      const output = []
      data.forEach((value, index) => {
        // ???????????????????????????????????????????????????
        let node = this.choose(nodes, value, index, fragments)

        // ??????????????????????????????????????????????????????????????????????????????
        if (value && typeof value === 'object' && typeof node === 'undefined') {
          return
        }

        // ??????????????????????????????????????????
        if (typeof node === 'undefined') {
          node = nodes[0]
        }

        const gened = this.create(node, data, { fragments, results, context, index })
        if (gened) {
          const { key, value } = gened
          output[key] = value
        }
      })

      return output
    }

    /**
     * ????????????
     */
    if (structure.type === TYPES.TUPLE) {
      if (!Array.isArray(data)) {
        // array like??????????????????????????????????????????????????????????????????????????? { 0: ..., 1: ..., 2: ... }???????????????????????????????????????
        if (data && typeof data === 'object' && Object.keys(data).every(key => /^\d+$/.test(key))) {
          const keys = Object.keys(data)
          data = []
          keys.forEach((key) => {
            const value = data[key]
            data[key] = value
          })
          debug?.({
            command,
            url: target,
            keyPath,
            alias,
            should: 'tuple',
            receive: data,
            message: '???ArrayLike????????????????????????',
            level: 'warn',
            direction,
          })
        }
        else {
          debug?.({
            command,
            url: target,
            keyPath,
            alias,
            should: 'tuple',
            receive: data,
            direction,
          })
          // ???????????????????????????????????????????????????????????????????????????
          data = []
        }
      }

      const output = []
      const { nodes } = structure

      if (data.length !== nodes.length) {
        debug?.({
          command,
          url: target,
          keyPath,
          alias,
          should: 'tuple',
          shouldLength: nodes.length,
          receive: data,
          direction,
        })
        // ??????????????????????????????????????????
        data = data.slice(0, nodes.length)
      }

      nodes.forEach((node, index) => {
        const gened = this.create(node, data, { fragments, results, context, index })
        if (gened) {
          const { key, value } = gened
          output[key] = value
        }
      })
      return output
    }
  }

  choose(items, value, index, fragments) {
    // ?????????????????????????????? `2: string` ???????????????????????????????????? index ??????????????????????????????????????????
    const indexMatchedNode = items.find((node) => {
      const { key: keyInfo } = node
      const [name] = keyInfo || []
      if (typeof name !== 'undefined' && +name === +index) {
        return true
      }
      return false
    })
    if (indexMatchedNode) {
      return indexMatchedNode
    }

    const { debug } = this.options

    const nodes = items.filter((item) => {
      const { key: keyInfo } = item
      const [name] = keyInfo || []
      // ??????????????????????????????
      if (typeof name !== 'undefined') {
        return false
      }
      return true
    }).map((item) => {
      // ??????fragment???????????????
      if (Array.isArray(item.value) && typeof item.value[0] === 'string' && item.value[0] === '&') {
        const [, frag] = item.value
        const value = fragments[frag]
        if (!value) {
          debug?.({
            message: `Fragment ${frag} ???????????????`,
            level: 'warn',
          })
          return item
        }
        return {
          ...item,
          value,
        }
      }
      return item
    })

    /**
     * ??????????????????????????????????????????????????????????????????item
     */
    if (Array.isArray(value)) {
      const subItems = nodes.filter(item => item && (item.value?.type === TYPES.ARRAY || item.value?.type === TYPES.TUPLE))
      if (!subItems.length) {
        return
      }

      const getType = (desc) => {
        if (desc?.type === TYPES.OBJECT) {
          return 'object'
        }
        if (desc?.type === TYPES.ARRAY || desc?.type === TYPES.TUPLE) {
          return 'array'
        }
        if (desc?.type === TYPES.PROP || desc?.type === TYPES.ITEM) {
          return desc?.value?.[1]
        }
      }

      // TODO choose real item, now not support sub-array
      // [[string, number], [string, boolean]]
      const typesOfData = value.map(v => Array.isArray(v) ? 'array' : typeof v)
      const scores = subItems.map((item) => {
        const sub = item.value
        if (sub.type === TYPES.TUPLE) {
          const subDescs = sub.nodes
          let score = 0
          for (let i = 0, len = value.length; i < len; i ++) {
            const desc = subDescs[i]
            const descType = desc ? getType(desc.value) : NaN
            const dataType = typesOfData[i]
            score += descType === dataType ? 1 : 0
          }
          return score
        }
        else {
          const subDescs = sub.nodes
          let score = 0
          for (let i = 0, len = value.length; i < len; i ++) {
            const dataType = typesOfData[i]
            score += subDescs.some(desc => dataType === getType(desc)) ? 1 : 0
          }
          return score
        }
      })

      const highest = scores.reduce((info, score, index) => {
        if (info.score < score) {
          info.score = score
          info.index = index
        }
        return info
      }, {
        score: 0,
        index: 0,
      })

      const { index } = highest
      return subItems[index]
    }

    if (value && typeof value === 'object') {
      const subItems = nodes.filter(item => item && item.value?.type === TYPES.OBJECT)
      if (!subItems.length) {
        return
      }

      const keysOfData = Object.keys(value).reduce((keys, key) => {
        keys[key] = 1
        return keys
      }, {})

      const scores = subItems.map((item) => {
        const sub = item.value
        return sub.nodes.reduce((total, node) => {
          const { key: keyInfo } = node
          const [name] = keyInfo || []
          if (keysOfData[name]) {
            total ++
          }
          return total
        }, 0)
      }, {})

      const highest = scores.reduce((info, score, index) => {
        if (info.score < score) {
          info.score = score
          info.index = index
        }
        return info
      }, {
        score: 0,
        index: 0,
      })

      const { index } = highest
      return subItems[index]
    }
  }

  format(value, fn, args, context) {
    const { formatters = {} } = this.options
    const allFormatters = {
      ...defaultFormatters,
      ...formatters,
    }
    const { command, url, alias, keyPath, root } = context
    const format = allFormatters[fn]

    if (!format) {
      throw new Error(`10009: ?????????${fn}?????? at ${command} ${url} ${alias} ${keyPath.join('.')}`)
    }

    return format(...args).call(context, value, keyPath, root)
  }

  async mock(code) {
    await sleep()

    const { fragments, groups } = interpret(code)
    const { mockers = {}, debug } = this.options

    const results = {}

    const allMockers = {
      ...defaultMockers,
      ...mockers,
    }
    const willExist = () => parseInt((Math.random() * 100 % 2) + '', 10)
    const breakFragment = (keyPath) => {
      if (keyPath.length > 10) {
        debug?.({
          message: `????????????10 ${keyPath.join('.')} ???????????????`,
          level: 'warn',
        })
        return true
      }
    }
    const fn = (structure, context = {}) => {
      const { keyPath = [] } = context

      /**
       * ????????????
       */
      if (structure.type === TYPES.OBJECT) {
        const output = {}
        structure.nodes.forEach((prop) => {
          const { key: keyInfo, value: valueInfo } = prop
          const [key, decorators] = keyInfo || []

          const isOptional = decorators?.indexOf('?') > -1
          if (isOptional && !willExist()) {
            return
          }

          const currContext = {
            ...context,
            keyPath: [...keyPath, key],
            debug,
          }

          // ????????????
          if (!valueInfo) {
            output[key] = allMockers.string()()
          }
          else if (Array.isArray(valueInfo)) {
            const [operators, tag, exps = []] = valueInfo
            if (tag && operators === '&') {
              const fragment = fragments[tag]
              if (!fragment) {
                throw new Error(`${tag} Fragment at ${keyPath.join('.')}.${key} ?????????????????????`)
              }

              if (breakFragment(keyPath)) {
                return
              }

              const out = fn(fragment, currContext)
              output[key] = out
            }
            else if (tag && operators === '=') {
              output[key] = results[tag]
            }
            else if (tag) {
              const mockfn = allMockers[tag]
              if (!mockfn) {
                throw new Error(`10011: mock(${code})??? ${keyPath.join('.')}.${key} ?????????${tag}??????Mocker`)
              }
              output[key] = mockfn(...exps.map(exp => this.parse(exp, results))).call(currContext)
            }
            else {
              throw new Error(`${keyPath.join('.')}.${key} ?????????mock??????????????????????????????mocker`)
            }
          }
          else if (valueInfo && typeof valueInfo === 'object') {
            const out = fn(valueInfo, currContext)
            output[key] = out
          }
        })
        return output
      }

      /**
       * ????????????
       */
      if (structure.type === TYPES.ARRAY) {
        const output = []
        const { nodes } = structure
        for (let i = 0, len = Math.floor(Math.random() * 10); i < len; i ++) {
          if (!willExist()) {
            continue
          }

          const len = nodes.length
          const index = parseInt((Math.random() * 10) + '', 10) % len
          const item = nodes[index]

          const { key: keyInfo, value: valueInfo } = item

          const [key, decorators] = keyInfo || []

          if (decorators?.indexOf('?') > -1 && !willExist()) {
            return
          }

          const currContext = {
            ...context,
            keyPath: [...keyPath, key],
            debug,
          }

          if (Array.isArray(valueInfo)) {
            const [operators, tag, exps = []] = valueInfo
            if (tag && operators === '&') {
              const fragment = fragments[tag]
              if (!fragment) {
                throw new Error(`${tag} Fragment at ${keyPath.join('.')}.${key} ?????????????????????`)
              }

              if (breakFragment(keyPath)) {
                return
              }

              const out = fn(fragment, currContext)
              output.push(out)
            }
            else if (tag && operators === '=') {
              output.push(results[tag])
            }
            else if (tag) {
              const mockfn = allMockers[tag]
              if (!mockfn) {
                throw new Error(`10011: mock(${code})??? ${keyPath.join('.')}.${key} ?????????${tag}??????Mocker`)
              }
              const out = mockfn(...exps.map(exp => this.parse(exp, results))).call(currContext)
              output.push(out)
            }
            else {
              throw new Error(`${keyPath.join('.')}.${key} ?????????mock??????????????????????????????mocker`)
            }
          }
          else if (valueInfo && typeof valueInfo === 'object') {
            const out = fn(valueInfo, currContext)
            output.push(out)
          }
        }

        return output
      }

      /**
       * ????????????
       */
      if (structure.type === TYPES.TUPLE) {
        const output = []
        const { nodes } = structure

        nodes.forEach((item, index) => {
          const { key: keyInfo, value: valueInfo } = item
          const [key, decorators] = keyInfo || []

          if (decorators?.indexOf('?') > -1 && !willExist()) {
            return
          }

          const currContext = {
            ...context,
            keyPath: [...keyPath, key],
            debug,
          }

          if (Array.isArray(valueInfo)) {
            const [operators, tag, exps = []] = valueInfo || []
            if (tag && operators === '&') {
              const fragment = fragments[tag]
              if (!fragment) {
                throw new Error(`${tag} Fragment at ${keyPath.join('.')}.${key} ?????????????????????`)
              }

              if (breakFragment(keyPath)) {
                return
              }

              const out = fn(fragment, currContext)
              output[index] = out
            }
            else if (tag) {
              const mockfn = allMockers[tag]
              if (!mockfn) {
                throw new Error(`10011: mock(${code})??? ${keyPath.join('.')}.${key} ?????????${tag}??????Mocker`)
              }
              const out = mockfn(...exps.map(exp => this.parse(exp, results))).call(currContext)
              output[index] = out
            }
            else {
              throw new Error(`${keyPath.join('.')}.${key} ?????????mock??????????????????????????????mocker`)
            }
          }
          else if (valueInfo && typeof valueInfo === 'object') {
            const out = fn(valueInfo, currContext)
            output[index] = out
          }
        })
        return output
      }
    }

    let final = null
    groups.forEach((group, i) => {
      group.forEach((item, n) => {
        const isFinal = i === groups.length - 1 && n === group.length - 1
        const { alias, res } = item

        if (!res) {
          return
        }
        const data = fn(res)
        if (alias) {
          results[alias] = data
        }

        if (isFinal) {
          final = data
        }
      })
    })

    if (this.options.onMock) {
      return this.options.onMock(final, { code })
    }

    return final
  }

  static run(code, params, dataList, context) {
    const ins = new this()
    return ins.run(code, params, dataList, context)
  }

  static mock(code) {
    const ins = new this()
    return ins.mock(code)
  }
}
