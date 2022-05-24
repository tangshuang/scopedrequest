import { ScopedRequest } from '../es/index.js'

ScopedRequest.mock(`
  FRAGMENT DATA: {
    name: string
    age: number
  }

  GET "" -> {
    code: number
    data: &DATA
  }
`).then(console.log)
