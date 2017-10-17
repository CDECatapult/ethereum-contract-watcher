'use strict'
// This module exists only so that the provider can be stubbed during tests.

const Web3 = require('web3')

function makeProvider (ethereumNode) {
  return new Web3.providers.HttpProvider(ethereumNode)
}
module.exports = makeProvider
