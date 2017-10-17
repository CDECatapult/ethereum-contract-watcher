'use strict'

const Web3 = require('web3')
const makeProvider = require('./provider')

function createContractWatcher ({address, abi, ethereumNode, fromBlock}) {
  // Create a new Web3 instance, to ensure that when it polls for filter
  // changes, it doesn't multiplex requests into a single JSON-RPC batch. Such
  // batching might be problematic since the underlying `eth_getFilterChanges`
  // method returns results since the last poll. Batching may cause errors to
  // affect other watchers.
  const instance = new Web3(makeProvider(ethereumNode))
  return instance.eth.contract(abi).at(address).allEvents({fromBlock})
}
exports.createContractWatcher = createContractWatcher
