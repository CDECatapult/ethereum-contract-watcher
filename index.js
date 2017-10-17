'use strict'

const {PassThrough} = require('stream')
const util = require('util')
const funstream = require('funstream')
const {createContractWatcher} = require('./lib/web3')

class ContractWatcher {
  constructor ({ethereumNode, onEvent, onError, wrapWeb3Error = err => err}) {
    this.ethereumNode = ethereumNode
    this.onEvent = onEvent
    this.onError = onError
    this.wrapWeb3Error = wrapWeb3Error

    // Assign to make it easier to stub in tests.
    this.createContractWatcher = createContractWatcher

    this.handles = new Set()
    this.stopping = false
  }

  add ({abi, address, fromBlock, token}) {
    if (this.stopping) return

    const {ethereumNode} = this
    const watcher = this.createContractWatcher({address, abi, ethereumNode, fromBlock})
    const stopWatching = util.promisify(watcher.stopWatching.bind(watcher))

    // Prepare to stream the events.
    const stream = new PassThrough({objectMode: true})

    const handle = {
      stop: async () => {
        stream.end()
        this.handles.delete(handle)
        await stopWatching()
      }
    }
    this.handles.add(handle)

    // Use funstream to ensure events for this contract are processed serially.
    funstream(stream, {async: true})
      .forEach(async event => this.onEvent(event, token))
      .catch(err => {
        this.onError(err, token)
        handle.stop()
      })

    // Even though `watcher.watch()` gets all events, Web3 doesn't properly
    // ensure that new events won't be emitted before it's gotten all existing
    // events. Theoretically this may even lead to duplicates. Instead events
    // from `watcher.watch()` are buffered until we can be sure we've gotten all
    // existing events, and compared against the last existing event to ensure
    // it's actually new.
    let newEventBuffer = []
    let lastExistingEvent = null

    const push = event => {
      stream.write(event)
      lastExistingEvent = event
    }

    // TODO: Abort this request when stopping. Web3 does not currently
    // support this.
    watcher.get((err, events) => {
      // Bail if the watcher is being stopped since `watcher.get()` began.
      if (this.stopping) return

      // Guard against Web3 calling this even after the watcher has been stopped.
      if (!stream.writable) return

      if (err) {
        stream.emit('error', this.wrapWeb3Error(err))
        return
      }

      // Assume `events` are serialized.
      for (const event of events) {
        push(event)
      }

      // Internally, Web3 does a get() call to get historical events whenever
      // watch() is called. This creates a race condition where events may be
      // returned out of order. Sort the buffer so the watcher can ensure that
      // only new events are emitted.
      newEventBuffer.sort((a, b) => {
        return a.blockNumber === b.blockNumber
          ? a.logIndex - b.logIndex
          : a.blockNumber - b.blockNumber
      })

      for (const event of newEventBuffer) {
        if (lastExistingEvent === null) {
          push(event)
        } else if (event.blockNumber !== lastExistingEvent.blockNumber) {
          if (event.blockNumber > lastExistingEvent.blockNumber) {
            // Only emit events that are actually new.
            push(event)
          }
        } else if (event.logIndex > lastExistingEvent.logIndex) {
          // Only emit events that are actually new.
          push(event)
        }
      }

      // Clear the buffer, allowing `watcher.watch()` to emit events directly.
      newEventBuffer = null
    })

    // TODO: Abort in-flight watch requests when stopping. Web3 does not
    // currently support this (it just prevents the next poll).
    watcher.watch((err, event) => {
      // Bail if the watcher is being stopped since `watcher.watch()` began.
      if (this.stopping) return

      // Guard against Web3 calling this even after the watcher has been stopped.
      if (!stream.writable) return

      if (err) {
        stream.emit('error', this.wrapWeb3Error(err))
      } else if (newEventBuffer !== null) {
        newEventBuffer.push(event)
      } else if (lastExistingEvent === null) {
        push(event)
      } else if (event.blockNumber !== lastExistingEvent.blockNumber) {
        if (event.blockNumber > lastExistingEvent.blockNumber) {
          // Only emit events that are actually new.
          push(event)
        }
      } else if (event.logIndex > lastExistingEvent.logIndex) {
        // Only emit events that are actually new.
        push(event)
      }
    })
  }

  async stop () {
    this.stopping = true
    return Promise.all(Array.from(this.handles, handle => handle.stop()))
  }
}
module.exports = ContractWatcher
