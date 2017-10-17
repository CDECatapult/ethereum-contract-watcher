'use strict'

const fs = require('fs')
const path = require('path')
const solc = require('solc')

const contract = fs.readFileSync(path.join(__dirname, 'EventEmitter.sol'), 'utf8')
const {contracts: {':EventEmitter': {interface: abi, bytecode: unlinked_binary}}} = solc.compile(contract)

fs.writeFileSync(path.join(__dirname, 'EventEmitter.json'), JSON.stringify({
  contract_name: 'EventEmitter',
  abi: JSON.parse(abi),
  unlinked_binary
}, null, 2))
