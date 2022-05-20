import { ScopedRequest } from '../es/index.js'
import { ScopeX } from 'scopex'

// 最基础用法
async function basic() {
  const data = await ScopedRequest.run(`
    GET "https://api.github.com/search/repositories?q={keyword}" -> {
      /**
       * 多行注释效果
       */
      items: [
        {
          id: string
          full_name
          description
          html_url
        }
      ],
    }
  `, { keyword: 'js' })
  console.log('basic:', data)
}

// POST请求
async function post() {
  const fetch = (url, config, data) => {
    console.log('postData:', data)
    return {
      name: 'tomy',
      age: 10,
      height: 100,
    }
  }
  const data = await new ScopedRequest({ fetch }).run(`
    POST "http://localhost:1333/post.json" + {
      id
      name
    } -> {
      name
      age: string
    }
  `, null, {
    id: '123',
    name: 'tomy',
    weight: 123,
  })
  console.log('post:', data)
}

// Headers
async function headers() {
  const data = await ScopedRequest.run(`
    GET "https://api.github.com/search/repositories?q={keyword}" \\
    // 换行效果
    -H "Content-Type: application/json" \\
    -> {
      items
    }
  `, { keyword: 'react' })
  console.log('headers:', data)
}

// COMPOSE
async function compose() {
  const data = await new ScopedRequest({
    scopex: ScopeX,
  }).run(`
    GET "https://api.github.com/search/repositories?q=reactjs" -> { total_count } as React
    GET "https://api.github.com/search/repositories?q=vuejs" -> { total_count } as Vue
    COMPOSE -> {
      react_total: (React.total_count)
      vue_total: (Vue.total_count)
      total: (React.total_count + Vue.total_count)
    }
  `)
  console.log('compose:', data)
}

// AWAIT
async function wait() {
  const data = await ScopedRequest.run(`
    GET "https://api.github.com/search/repositories?q=reactjs" -> {
      items: [
        {
          full_name
        }
      ]
    } as React

    AWAIT React

    // 在后面的请求中，使用前面的请求的结果
    GET "https://api.github.com/search/repositories?q=(React.items.0.full_name)" -> {
      items: [
        {
          full_name
        }
      ]
      total_count
    }
  `)
  console.log('await:', data)
}

// 自定义格式器
async function formatters() {
  const data = await new ScopedRequest({
    formatters: {
      date: (sep = '-') => function(value) {
        if (typeof value === 'number') {
          const date = new Date(value)
          return `${date.getFullYear()}${sep}${date.getMonth() + 1}${sep}${date.getDate()}`
        }
        return (value + '').substring(0, 10).replace(/\-/g, sep)
      },
    },
  }).run(`
    GET "https://api.github.com/search/repositories?q=reactjs" -> {
      items: [
        {
          full_name
          created_at: date("/")
        }
      ]
    }
  `)
  console.log('formatter date:', data)
}

// 修饰符
async function decorate() {
  const data = await ScopedRequest.run(`
    GET "https://api.github.com/search/repositories?q=reactjs" -> {
      /**
       * 将后端的items字段名映射为前端的item字段名
       * 将后端返回的items强制转换为对象，强制转换时，会使用第一个元素作为对象
       */
      item~items!: {
        full_name
        // 后端没有返回这个字段，前端拿到的结果就不会出现这个字段
        date?
        // 后端没有返回这个字段时，仍然会出现这个字段，赋值为null
        empty??
      }
    }
  `)
  console.log('decorate:', data)
}

// 片段
async function fragment() {
  const data = await ScopedRequest.run(`
    FRAGMENT libraryInfo: {
      full_name
      url
    }
    GET "https://api.github.com/search/repositories?q=reactjs" -> {
      items: [&libraryInfo]
    } as React
    GET "https://api.github.com/search/repositories?q=vuejs" -> {
      items: [&libraryInfo]
    } as Vue
    COMPOSE -> {
      react: (React.items)
      vuew: (Vue.items)
    }
  `)
  console.log('fragment:', data)
}

window.basic = basic;
window.post = post;
window.httpHeaders = headers;
window.compose = compose;
window.wait = wait;
window.formatters = formatters
window.decorate = decorate;
window.fragment = fragment;
