import { tokenize, parse, interpret } from '../es/index.js'

/////////////// 语法测试 ////////////////
const progamStr = `
  FRAGMENT fragment1: {
    name
    age
  }

  // 1. headers
  GET "https://api.github.com/search/repositories?q={keyword}" -H "content-type: application/json" -> {
    id
    // 可选
    total_count?
    // 类型
    count: number
    // 使用fragment
    person: &fragment1
    // 嵌套
    items: [
      // 可选的类型
      {
        // 分号结尾
        full_name;
        // 单行对象
        owner: { login };
        html_url
      };
    ];
    color: <"red", number>;
  } as dog

  AWAIT dog, others

  PUT "http://xxx/{dog.id}" + {
    name: string
    age
  } -> {
    name
    age
  } as see

  COMPOSE -> {
    a: dog,
    b: person,
    c: see,
  }
`

console.log(interpret(progamStr))


// /////////////// parse ////////////////
// const progamStr = `
//   get "https://api.github.com/search/repositories?q={keyword}" -> {
//     total_count?: string
//     items?: [
//       {
//         full_name
//         owner: {
//           login
//         };
//         html_url
//       };
//     ];
//   } as dog

//   get "http://xxx" -> {
//     name
//     age
//   } as person

//   PUT "http://xxx" + {
//     name: string
//     age
//   } -> {
//     name
//     age
//   } as see
// `
// const tokens = tokenize(progamStr)
// console.log('tokens:', tokens)
// const ast = parse(tokens, progamStr)
// console.log('ast:', ast)

// ///////////////////////// get ///////////////////
// const queryStr = `
//   get "https://api.github.com/search/repositories?q={keyword}" -> {
//     total_count
//     items: [
//       {
//         full_name
//         owner: {
//           login
//         }
//         html_url
//       }
//     ]
//   }
// `
// Request.run(queryStr, { keyword: 'angular' }).then((data) => {
//   console.log('get:', data)
// })

// ///////////////////////// post ///////////////////
// const postStr = `
//   POST "https://api.github.com/search/repositories?q={keyword}" + {
//     name
//     age
//   } -> {
//     total_count
//     items: [
//       {
//         full_name
//         owner: {
//           login
//         }
//         html_url
//       }
//     ]
//   }
// `
// Request.run(postStr, { keyword: 'post' }, {
//   name: 'tom',
//   age: 10,
//   height: 100,
// }).then((data) => {
//   console.log('post:', data)
// })

// ///////////////////// 分隔符 ////////////////////
// const sepStr = `
//   get "xxx" -> {
//     total_count: number;
//     items: [
//       {
//         full_name: number;
//         owner: {
//           login: string;
//         };
//         html_url: string;
//       };
//     ];
//   }
// `
// Request.mock(sepStr).then((data) => {
//   console.log('分隔符:', data)
// })


// ///////////////////////// compose ////////////////////
// const composeStr = `
//   get "https://api.github.com/search/repositories?q=angular" -> {
//     total_count
//     any: { age: number }
//     items: [
//       {
//         full_name;
//         owner: {
//           login
//         }
//         html_url;
//       }
//     ];
//     books: [string, ??: string, { name: string }]
//   } as angular

//   get "https://api.github.com/search/repositories?q=vue" -> {
//     total_count
//     items: [
//       {
//         full_name
//         owner: {
//           login
//         }
//         html_url
//       }
//     ]
//   } as vue

//   get "https://api.github.com/search/repositories?q=react" -> {
//     total_count
//     items: [
//       {
//         full_name
//         owner: {
//           login
//         }
//         html_url
//       }
//     ]
//   } as react

//   compose -> {
//     total_count: angular.total_count + vue.total_count + react.total_count
//     items: angular.items.concat(react.items).concat(vue.items)
//   }
// `
// new Request({ scopex: ScopeX }).run(composeStr).then((data) => {
//   console.log('compose:', data)
// })

// //////////////////// fetch ///////////////
// const query = new Request({
//   async fetch(url) {
//     return {
//       name: 'tomy',
//       age: 23,
//       sex: 'M',
//       books: [
//         {
//           book_id: 1001,
//           book_name: '3 guns',
//           price: 13.5,
//           pages: 100,
//         },
//         {
//           book_id: 1002,
//           book_name: 'Windy gone',
//           price: 16.5,
//         },
//       ]
//     }
//   }
// })

// query.run(`
//   get "xx" -> {
//     name
//     books: [
//       {
//         book_name
//         price: string
//         pages: number
//       },
//       {
//         boo
//         foo
//       }
//     ]
//   }
// `).then((data) => {
//   console.log('fetch:', data)
// })

// ///////////////// debug /////////////
// console.log(
//   'debug array:',
//   new Request({
//     debug: console.warn.bind(console, '[debug]:::'),
//   }).parse([1, 2, null, 3, '4', 5], `[string, number]`),
// )

// console.log(
//   'debug tuple:',
//   new Request({
//     debug: console.warn.bind(console, '[debug]:::'),
//   }).parse([1, 2, 3, 4, 5], `<string, number>`),
// )

// /////////////// shapes ///////////
// const q = new Request({
//   shapes: {
//     date: ({ y, s }) => (value, keyPath, data) => {
//       if (typeof value === 'number') {
//         const d = new Date(value)
//         return `${y ? d.getFullYear() : d.getFullYear().toString().substring(2)}${s}${d.getMonth() + 1}${s}${d.getDate()}`
//       }
//       return value
//     },
//   },
// })
// console.log(
//   'shapes:',
//   q.parse({
//     date: Date.now(),
//   }, `
//     {
//       date: date({ y: 0, s: "/" })
//     }
//   `),
// )

// ///////////////// mock ////////////////
// console.log(
//   'mock:',
//   Request.mock(`
//     get "a" -> {
//       name: string
//       books: [
//         {
//           book_name: string
//           price: number
//           pages: number
//         },
//         {
//           boo
//           foo
//         }
//       ]
//     } as a

//     get "b" -> {
//       age: number
//     } as b

//     compose -> {
//       name: a.name
//       age: b.age
//       books: a.books
//     }
//   `)
// )

// console.log(
//   'mock array:',
//   Request.mock(`
//     [string]
//   `)
// )
