const transfer = require('../loader')
const fs = require('fs')
const path = require('path')

const resourcePath = path.resolve(__dirname, 'api.srl.md')
const contents = fs.readFileSync(resourcePath).toString()
const codes = transfer.call({
  resourcePath,
  getOptions() {
    return {
      ts: true,
    }
  },
}, contents)
console.log(codes)
