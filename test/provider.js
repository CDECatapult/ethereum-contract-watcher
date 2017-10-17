import test from 'ava'
import td from 'testdouble'

const HttpProvider = td.constructor(['sentinel'])
td.replace('web3', {
  providers: {HttpProvider}
})

const makeProvider = require('../lib/provider')

test('creates a Web3 HTTP provider', t => {
  const sentinel = Symbol('sentinel')
  td.when(HttpProvider.prototype.sentinel()).thenReturn(sentinel)

  const instance = makeProvider('http://localhost:8545')
  const {calls: [{args}]} = td.explain(HttpProvider)
  t.deepEqual(args, ['http://localhost:8545'])
  t.is(instance.sentinel(), sentinel)
})
