# ScopedReuqest

高效的前端数据请求裁剪工具库。

*在使用前，你需要[阅读这里学习一门SRL语言](https://www.tangshuang.net/8445.html)。*

## 安装

```
npm i scopedrequest
```

## 使用

```js
import { ScopedRequest } from 'scopedrequest'

const data = await ScopedRequest.run(`
  GET "https://api.thecatapi.com/v1/images/search" -> [
    {
      id
      url
    }
  ]
`)
```

## API

### ScopedRequest.run(code:string, params:object, dataList:object[] | null, context:any): Promise<any>

运行查询，返回一个查询结果的promise。

- code: 基于SRL的代码
- params: 参数，在代码中，你可以使用 `{}` 作为插值，通过 params 传入运行时的真实值，仅在 url 和 headers 中生效
- dataList: 请求体，当发起 POST 或 PUT 请求时需要传入，由于我们在组合语法中并不知道内部会有几个请求需要发送数据，因此，我们必须传入一个数组与需要的请求进行位置上的对应
- context: 自定义透传信息

```js
ScopedRequest.run(`
  GET "http://xxx.com/detail/{id}" -> {
    title
    date
  }
`, { id: 123 }) // 使用params -> GET http://xxx.com/detail/123
```

上面这一句演示了通过插值替换为请求时的真实值。插值设计帮助我们可以把查询代码固化到一个纯文本文件中，而无需和js代码混杂在一起。

```js
ScopedRequest.run(`
  POST "xxx" + {
    name
    age
  } -> {
    name
    age
  }
`, null, {
  name: 'tom',
  age: 10,
  height: 12, // 不会被发送
})
```

上面这一句演示了发送请求体时，仅发送真实数据对象中的少数几个属性。
这里由于只有一个请求体，因此我们可以不传数组，直接传请求发送的数据。

### ScopedRequest.mock(code:string)

对一个查询语言进行mock，获得其结果。此处无需传入params, data等信息，你可以直接将`run`替换为`mock`，从而得到mock结果。

## 自定义

如果默认的行为无法满足你的需求，你需要通过 new ScopedRequest 来自定义自己的行为。

```js
const request = new ScopedRequest({
  // 覆盖数据请求过程
  async fetch(url, config, data, context) {},
  // 格式器
  formatters: {},
  // 模拟器，和格式器一一对应，返回结果为模拟的结果
  mockers: {},
  // 调试器，当内部认为不正确时，接收一个含有相关信息的对象
  debug(e) {},

  // 是否载入ScopeX来进行表达式增强，如果不载入，则只能解析路径，不能执行运算和函数调用
  scopex: null,
  // 向内提供函数，建议函数名全部大写，例如 AVG() SUM()，仅传入scopex之后有效，不传入时，调用函数会报错
  fns: {},

  // 运行run得到数据后，通过onData对数据进行统一转换
  onData(data): data,
  // 运行mock之后，通过onMock进行统一转换
  onMock(data): data,
  // 用于决定一个属性是否要保留，只对对象有效
  keepProperty(key, value, data): boolean,
})
```

传入的参数是自定义的关键。以上参数都是可选的

### fetch

通过什么方式将请求发送到后端接口，并返回数据，是由fetch配置项决定的。

- url: 语法解析后得到的url
- config: 语法解析后得到的参数部分，目前 config 的内容为 { headers }
- data: 透传过来的数据，你可以在自己的fetch函数中进行FormData化
- context: 在运行 query.run 时传入的 context，可实现透传

例如在nodejs中，你必须传入fetch来实现数据请求，否则无法在nodejs中运行。

```js
const axios = reuqire('axios')
const { ScopedRequest } = require('scopedrequest')

const request = new ScopedRequest({
  fetch(url, config, data, context) {
    if (config.method.toLowerCase() === 'get') {
      return axios.get(url).then(res => res.data)
    }
    ...
  },
})

// 使用实例化出来的request
request.run(`
  get "http://xxx.com/xxx" -> {
    name
    age
  }
`).then(data => {
  console.log(data)
})
```

### formatters

自定义格式化工具，你需要按照规范传入一系列的函数。

```js
const options = {
  formatters: {
    date: () => (value, keyPath, data) => {
      if (typeof value === 'number') {
        const d = new Date(value)
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate())}`
      }
      return value
    },
  },
}
```

一个formatter函数的结构如下：

```
(...args:参数) => (value:值, keyPath:路径, data:最外层的数据) => 格式化之后的结果
```

第一层args表示当你在使用该格式化工具时，在代码中写入的参数，例如：

```
{
  name: date("YY-MM-DD")
}
```

在代码中写入的参数会被传到这里作为args使用。

第二层参数value代表该位置的值，data代表最外层的数据，keyPath表示从data上读取value的路径。

返回结果将作为格式化后的结果展示。

例如内部的string, number都是基于上述的逻辑，对不符合类型的数据进行了转化。

## 使用ScopeX

基于 scopex 你可以在 表达式 语法中实现复杂的表达式和函数：

```js
import { ScopedRequest } from 'scopedrequest'
import { ScopeX } from 'scopex'

const query = new ScopedRequest({
  scopex: ScopeX,
  fns: {
    AVG(args) {
      return args.reduce((total, curr) => total + curr, 0) / args.length
    },
  },
})

query.run(`
  get "..." -> {
    ...
  } as A

  get "..." -> {
    ...
  } as B

  compose -> {
    total: (A.total + B.total); // 使用表达式
    avg: (AVG(A.items.concat(B.items))); // 使用上面定义的函数 AVG()
  }
`)
```

函数使用 `fns` 传入，推荐使用全大写命名。

注意：由于此处调用的函数实际上是表达式的一部分，因此，上面代码中，avg的内容必须放在一个 `()` 内部，虽然它只执行了函数。

注意：你需要另外安装 scopex，你需要根据你的实际情况来选择是否使用 scopex，避免造成不必要的问题。

## Mock

当你的后端没有准备好时，你可以基于已有的语法进行数据mock。

```js
ScopedRequest.mock(`
  get "http://xxx.com/{id}" -> {
    name
    age
  }
`).then(data => console.log(data))
```

为了和`run`保持一致的使用，mock以异步的形式返回数据。在使用时，你只需要把`run`方法替换为`mock`方法即可。

另外，你可以传入 `mockers` 这个参数来对不同 formatter 进行mock。传入的mockers与`formatters`一致。

## 语言即文档

你可以创建一个 .srl.md 文件来包含多个 request 并且通过 webpack 来实现自动导出。首先，我们创建一个名叫 requests.srl.md 的文件：

```md
# 接口说明

下面这个部分是整个文档共享部分，可在下方全部接口中使用。
在生成文档/代码时，它实际上会产生多份。

\```
FRAGMENT SOME_DATA: {
  name
  age
}
\```

## detail

这里可以写一些注释，所有的语法被放在 \``` 内部.

\```
GET "..." -> {
  name
  age
}
\```

## list

\```
GET "..." -> [
  {
    name
    age
  }
]
\```
```

上面这个md文件，可以直接在markdown阅读器中进行阅读，可帮助前后端同学一起预览。接下来我们在自己的js代码中直接使用这个文件。

```js
import { detail, list } from './requests.srl.md'
import { ScopedRequest } from 'scopedrequest'

const data = await ScopedRequest.run(detail, { id: 111 })
```

我们从 .srl.md 中导入了 `##` 后面的名字。接下来，我们要通过webpack loader让这个导入真正可用。*注意，必须是##开头，而非单个#开头。*

```js
// webpack.config.js

module.exports = {
  module: {
    rules: [
      {
        test: /\.srl\.md$/,
        loader: 'scopedrequest/loader',
        options: {
          // 是否生成/导出ts文件，通过该文件可用于ts代码检查
          // 注意，由于语法上的差异，如果出现大量函数、表达式，将无法得到你想要的ts效果，仅支持较为通用的简单的类型检查
          ts: true,
        },
      },
    ],
  },
}
```

通过加入上面的那个rule，我们就可以让 .srl.md 文件导出我们需要的内容。

## License

AGPL
