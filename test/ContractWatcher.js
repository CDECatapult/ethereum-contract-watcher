import test from 'ava'
import delay from 'delay'
import prepare from './_prepare'

test('calls onEvent when an event has occured', prepare({
  onEvent (t, {event, args}, token) {
    t.is(event, 'Emitted')
    t.is(token, t.context.token)
    t.is(args.value.toNumber(), 42)
    t.context.done()
  },

  async run (t) {
    const token = Symbol('token')
    t.context.token = token

    const {contract} = t.context
    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token})

    await contract.emit(42)
  }
}))

test('calls onEvent for historical events', prepare({
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())

    if (t.context.expected.length === 0) {
      t.context.done()
    }
  },

  async run (t) {
    const {contract} = t.context

    t.context.expected = [1, 2, 3]
    t.plan(t.context.expected.length)
    for (const value of t.context.expected) {
      await contract.emit(value)
    }

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})
  }
}))

test('calls onEvent for historical and new events', prepare({
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())

    if (t.context.expected.length === 0) {
      t.context.done()
    }
  },

  async run (t) {
    const {contract} = t.context

    t.context.expected = [1, 2, 3]
    t.plan(t.context.expected.length)
    const iterator = t.context.expected.slice()[Symbol.iterator]()
    await contract.emit(iterator.next().value)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of iterator) {
      await contract.emit(value)
    }
  }
}))

test('internal watch() buffers until get() completes', prepare({
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())

    if (t.context.expected.length === 0) {
      t.context.done()
    }
  },

  async run (t) {
    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    t.context.expected = [1, 2, 3]
    t.plan(t.context.expected.length)
    const iterator = t.context.expected.slice()[Symbol.iterator]()
    await contract.emit(iterator.next().value)
    await contract.emit(iterator.next().value)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of iterator) {
      await contract.emit(value)
    }

    await getPending
    await watchPending

    await resumeWatch()
    await resumeGet()
  }
}))

test('internal get() pushes events buffered by watch() when get() itself did not return events', prepare({
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())

    if (t.context.expected.length === 0) {
      t.context.done()
    }
  },

  async run (t) {
    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    t.context.expected = [1, 2, 3]
    t.plan(t.context.expected.length)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of t.context.expected) {
      await contract.emit(value)
    }

    await getPending
    await watchPending

    await resumeWatch()
    await resumeGet()
  }
}))

test('internal get() pushes events buffered by watch() that are in the same block as the last event it received, but at a higher index', prepare({ // eslint-disable-line max-len
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())

    if (t.context.expected.length === 0) {
      t.context.done()
    }
  },

  async run (t) {
    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    t.context.expected = [1, 2, 3, 4]
    t.plan(t.context.expected.length)
    const iterator = t.context.expected.slice()[Symbol.iterator]()
    await contract.emit(iterator.next().value)
    await contract.emit(iterator.next().value)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of iterator) {
      await contract.emit(value)
    }

    await watchPending
    await getPending

    await resumeWatch((err, event) => {
      if (!err && event.blockNumber > 3) {
        event.logIndex = event.blockNumber
        event.blockNumber = 3
      }
    })
    await resumeGet()
  }
}))

test('internal get() discards events buffered by watch() that are in older blocks as the last event it received', prepare({ // eslint-disable-line max-len
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())
  },

  async run (t) {
    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    t.context.expected = [1, 2, 3, 4]
    const iterator = t.context.expected.slice()[Symbol.iterator]()
    await contract.emit(iterator.next().value)
    await contract.emit(iterator.next().value)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of iterator) {
      await contract.emit(value)
    }

    await watchPending
    await getPending

    t.plan(t.context.expected.length - 2)
    await resumeWatch((err, event) => {
      if (!err && event.blockNumber > 3) {
        event.blockNumber = 2
      }
    })
    await resumeGet()
    t.context.done()
  }
}))

test('internal get() discards events buffered by watch() that are in the same block, but an older index as the last event it received', prepare({ // eslint-disable-line max-len
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())
  },

  async run (t) {
    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    t.context.expected = [1, 2, 3, 4]
    const iterator = t.context.expected.slice()[Symbol.iterator]()
    await contract.emit(iterator.next().value)
    await contract.emit(iterator.next().value)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of iterator) {
      await contract.emit(value)
    }

    await watchPending
    await getPending

    t.plan(t.context.expected.length - 2)
    let index = 0
    await resumeWatch((err, event) => {
      if (!err && event.blockNumber > 3) {
        event.logIndex = index++
        event.blockNumber = 3
      }
    })
    await resumeGet((err, events) => {
      if (!err) {
        for (const event of events) {
          if (event.blockNumber === 3) {
            event.logIndex = index++
          }
        }
      }
    })
    t.context.done()
  }
}))

test('internal watch() pushes events that are in the same block as the last event it received, but at a higher index', prepare({ // eslint-disable-line max-len
  async onEvent (t, {args}) {
    t.is(args.value.toNumber(), t.context.expected.shift())

    if (t.context.expected.length === 0) {
      t.context.done()
    }
  },

  async run (t) {
    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    t.context.expected = [1, 2]
    t.plan(t.context.expected.length)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    for (const value of t.context.expected) {
      await contract.emit(value)
    }

    await getPending
    await watchPending

    await resumeGet()
    await resumeWatch((err, event) => {
      if (!err && event.blockNumber > 2) {
        event.logIndex = event.blockNumber
        event.blockNumber = 2
      }
    })
  }
}))

test('forwards errors from internal get() to onError()', prepare({
  onError (t, err) {
    t.is(err, t.context.err)
    t.context.done()
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const {resumeGet, resumeWatch} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeGet(() => { throw err })
    await resumeWatch()
  }
}))

test('forwards errors from internal watch() to onError()', prepare({
  onError (t, err) {
    t.is(err, t.context.err)
    t.context.done()
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const {resumeGet, resumeWatch} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeGet()
    await resumeWatch(() => { throw err })
  }
}))

test('can wrap Web3 errors from internal get()', prepare({
  wrapWeb3Error (err) {
    return {err, wrapped: true}
  },

  onError (t, err) {
    t.is(err.err, t.context.err)
    t.true(err.wrapped)
    t.context.done()
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const {resumeGet, resumeWatch} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeGet(() => { throw err })
    await resumeWatch()
  }
}))

test('can wrap Web3 errors from internal watch()', prepare({
  onError (t, err) {
    t.is(err, t.context.err)
    t.context.done()
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const {resumeGet, resumeWatch} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeGet()
    await resumeWatch(() => { throw err })
  }
}))

test('stops watching a particular contract after errors occur in internal watch(), before internal get() is called', prepare({
  onError (t, err) {
    t.is(err, t.context.err)
  },

  onEvent (t) {
    t.fail('Should not receive event')
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const stub = t.context.stubCreateContractWatcher()
    const {resumeGet, resumeWatch} = stub

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeWatch(() => { throw err })
    await resumeGet()
    t.context.done()
  }
}))

test('stops watching a particular contract after errors occur in internal watch()', prepare({
  onError (t, err) {
    t.is(err, t.context.err)
  },

  onEvent (t) {
    t.fail('Should not receive event')
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const {reset, resumeGet, resumeWatch} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeGet()
    await resumeWatch(() => { throw err })

    const {watchPending} = reset()
    await contract.emit(2)

    const result = await Promise.race([watchPending, delay(500, 'pending')])
    t.is(result, 'pending')
    t.context.done()
  }
}))

test('stops watching a particular contract after errors occur in internal get(), before watch() is called', prepare({
  onError (t, err) {
    t.is(err, t.context.err)
  },

  onEvent (t) {
    t.fail('Should not receive event')
  },

  async run (t) {
    const err = new Error()
    t.context.err = err

    const {contract} = t.context
    const {resumeGet, resumeWatch} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await resumeGet(() => { throw err })
    await resumeWatch()
    t.context.done()
  }
}))

test('once stopped, internal get() discards events', prepare({
  onEvent (t) {
    t.fail('Should not receive event')
  },

  async run (t) {
    t.plan(1)
    t.pass()

    const {contract} = t.context
    const {resumeGet, getPending} = t.context.stubCreateContractWatcher()

    await contract.emit(1)

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await getPending

    await t.context.watcher.stop()
    await resumeGet()
    t.context.done()
  }
}))

test('once stopped, internal watch() discards events', prepare({
  onEvent (t) {
    t.fail('Should not receive event')
  },

  async run (t) {
    t.plan(1)
    t.pass()

    const {contract} = t.context
    const {resumeGet, getPending, resumeWatch, watchPending} = t.context.stubCreateContractWatcher()

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    await contract.emit(1)

    await getPending
    await watchPending

    await resumeGet()
    await t.context.watcher.stop()
    await resumeWatch()
    t.context.done()
  }
}))

test('add() is a noop once stopped', prepare({
  async run (t) {
    const {contract} = t.context
    await t.context.watcher.stop()
    t.context.watcher.createContractWatcher = () => {
      throw new Error('Should not be called')
    }

    const {address, abi} = contract
    t.context.watcher.add({address, abi, fromBlock: 0, token: Symbol('token')})

    t.pass()
    t.context.done()
  }
}))
