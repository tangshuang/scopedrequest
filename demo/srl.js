const transfer = require('../loader')
const fs = require('fs')
const path = require('path')

const contents = fs.readFileSync(path.resolve(__dirname, 'api.srl.md')).toString()
const codes = transfer(contents)
console.log(codes)
