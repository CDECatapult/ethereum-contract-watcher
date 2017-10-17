# @digicat/ethereum-contract-watcher

This package can observe contracts on a
[web3.js](https://github.com/ethereum/web3.js/)-compatible
[Ethereum](https://ethereum.org/) network, providing callbacks for when events
are emitted. Requires [Node.js](https://nodejs.org/en/) 8.6 or newer.

## Usage

```js
const ContractWatcher = require('@digicat/ethereum-contract-watcher')

const watcher = new ContractWatcher({
  ethereumNode: 'http://localhost:8545',

  onError (err, token) {
    // Called when an error occurred. Expected to be synchronous.
  },

  onEvent (event, token) {
    // Called when an event occurs for a contract that's being watched.
    //
    // Can be asynchronous (if you return a promise). Won't interleave with
    // other events.
    //
    // The `event` object comes directly from Web3.
    // See <https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events>.
  },

  wrapWeb3Error (err) {
    // Allows for underlying Web3 errors to be wrapped in another Error class.
    // By default returns the error as-is.
    return err
  }
})

// Start watching a new contract. The `token` is provided in callbacks as-is.
watcher.add({
  // ABI array of the contract (required).
  abi: […],
  // Contract address (required, no default value).
  address: '0xef3b47f7e4865c72565f448cc162945ea5bcdc1e'
  // The block from which events should be observed. Defaults to 'latest'.
  fromBlock: 'latest',
  token: {
    an: {
      arbitrary: 'object'
    }s
  }
})

// Stop watchers all contracts.
watcher.stop()
```
