import ganache from 'ganache-core'
import memdown from 'memdown'
import td from 'testdouble'
import truffleContract from 'truffle-contract'
import compiledContract from './fixtures/EventEmitter.json'

const makeProvider = td.replace('../lib/provider')

// Use require() since this should be loaded after module stubs have been
// configured.
const ContractWatcher = require('..')

async function deployEmitter (provider, from) {
  const contract = truffleContract(compiledContract)
  contract.setProvider(provider)
  contract.defaults({from, gas: 4700000, gasPrice: 1})

  return contract.new()
}

const seenTitles = new Set()
export default (setup = {}) => {
  return async t => {
    // Titles are used to ensure each watcher instance gets the correct Web3 provider.
    if (seenTitles.has(t.title)) throw new Error(`Test title has already been used: ${t.title}`)
    seenTitles.add(t.title)

    const provider = ganache.provider({
      accounts: [
        {balance: 10e18},
        {balance: 0}
      ],
      db: memdown(),
      mnemonic: 'i’ll be with you lost boys',
      locked: true
    })

    const addresses = Object.keys(provider.manager.state.accounts)

    const ethereumNode = `ethereumNode (${t.title})`
    td.when(makeProvider(ethereumNode)).thenReturn(provider)

    const contract = await deployEmitter(provider, addresses[0])

    let watcher
    const promise = new Promise(async (resolve, reject) => {
      const {
        onError = (_, err) => reject(err),
        onEvent = resolve,
        wrapWeb3Error
      } = setup

      watcher = new ContractWatcher({
        ethereumNode,
        onError (...args) {
          return onError(t, ...args)
        },
        onEvent (...args) {
          return onEvent(t, ...args)
        },
        wrapWeb3Error
      })

      const {createContractWatcher} = watcher
      const stubCreateContractWatcher = () => {
        let resumeGet, signalGetPending, getResumption, getPending
        let resumeWatch, signalWatchPending, watchResumption, watchPending

        const reset = () => {
          getResumption = new Promise(resume => { // eslint-disable-line promise/param-names
            resumeGet = (mutate = () => {}) => new Promise(async flushed => { // eslint-disable-line promise/param-names
              resume(mutate)
              await getPending
              setImmediate(flushed)
            })
          })
          getPending = new Promise(signal => { // eslint-disable-line promise/param-names
            signalGetPending = signal
          })

          watchResumption = new Promise(resume => { // eslint-disable-line promise/param-names
            resumeWatch = (mutate = () => {}) => new Promise(async flushed => { // eslint-disable-line promise/param-names
              resume(mutate)
              await watchPending
              setImmediate(flushed)
            })
          })
          watchPending = new Promise(signal => { // eslint-disable-line promise/param-names
            signalWatchPending = signal
          })

          return {
            reset,
            resumeGet,
            getPending,
            resumeWatch,
            watchPending
          }
        }

        watcher.createContractWatcher = options => {
          const web3Watcher = createContractWatcher.call(watcher, options)
          const {get, watch} = web3Watcher

          web3Watcher.get = propagate => {
            get.call(web3Watcher, async (...args) => {
              signalGetPending()
              const mutate = await getResumption

              let fail
              try {
                mutate(...args)
              } catch (err) {
                fail = err
              }

              if (fail) {
                propagate(fail)
              } else {
                propagate(...args)
              }
            })
          }
          web3Watcher.watch = propagate => {
            watch.call(web3Watcher, async (...args) => {
              signalWatchPending()
              const mutate = await watchResumption

              let fail
              try {
                mutate(...args)
              } catch (err) {
                fail = err
              }

              if (fail) {
                propagate(fail)
              } else {
                propagate(...args)
              }
            })
          }

          return web3Watcher
        }

        return reset()
      }

      t.context = {
        addresses,
        contract,
        done: resolve,
        provider,
        stubCreateContractWatcher,
        watcher
      }

      if (setup.run) {
        try {
          await setup.run(t)
        } catch (err) {
          reject(err)
        }
      }
    })

    try {
      await promise
    } finally {
      if (watcher) watcher.stop()
    }
  }
}
