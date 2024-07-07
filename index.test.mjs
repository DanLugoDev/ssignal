/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-magic-numbers */
// https://github.com/nodejs/node/issues/50431#issuecomment-2028077686

import assert from 'node:assert'
import { mock, test } from 'node:test'

import { createSignal } from './index.mjs'

// #region mocks ///////////////////////////////////////////////////////////////
// /**
//  * Returns a random number between min (inclusive) and max (exclusive)
//  * @param {number} min
//  * @param {number} max
//  * @return {number}
//  */
// const rndBetween = (min, max) => Math.random() * (max - min) + min

/**
 * @param {number} min
 * @param {number} max
 * @return {number}
 */
const rndIntBetween = (min, max) => {
  const _min = Math.ceil(min)
  const _max = Math.floor(max)
  return Math.floor(Math.random() * (_max - _min + 1)) + _min
}
// #endregion mocks ////////////////////////////////////////////////////////////

void test('I can create a signal, without or without an empty value, ', async t => {
  const evSignal = createSignal(Math.random() > 0.5 ? undefined : Math.random())

  await t.test('I can sub to it, and it will transmit when it emits', () => {
    const numOfCalls = rndIntBetween(10, 100)
    const mockFn = mock.fn(s => {
      assert(s === evSignal)
    })

    evSignal.sub(mockFn)

    let i = 0

    while (i++ < numOfCalls) evSignal.emit(Math.random())

    assert.strictEqual(mockFn.mock.callCount(), numOfCalls)

    evSignal.unsub(mockFn)
  })

  await t.test(
    'I can plug it as a dependency into another signal',
    async tt => {
      const initialDerivedVal = Math.random()
      const derivedSignal = createSignal(initialDerivedVal, [evSignal])

      await tt.test(
        'and the derived signal will trigger when the original signal does',
        () => {
          const numOfCalls = rndIntBetween(10, 100)
          const mockFn = mock.fn(s => void assert(s === derivedSignal))

          derivedSignal.sub(mockFn)

          let i = 0
          while (i++ < numOfCalls) evSignal.emit(Math.random())

          assert.strictEqual(mockFn.mock.callCount(), numOfCalls)
        }
      )

      await tt.test(
        "also the derived signal shouldn't have changed it's value, because it wasn't provided a transducer",
        () =>
          void assert.strictEqual(derivedSignal.getCurr(), initialDerivedVal)
      )
    }
  )
})

void test('I can create a data signal that holds a value and transmits when it changes', async t => {
  const users = createSignal({
    john: {
      id: 4320383123,
      name: 'john'
    }
  })

  await t.test(
    'it transmits to a new signal that has it as a dependency',
    (_, done) => {
      const userIDs = createSignal([0], [users], (curr, trigDep) => {
        if (trigDep === users) {
          const newIDs = curr.slice()

          newIDs.push(...Object.values(users.getCurr()).map(u => u.id))

          return newIDs
        }
        return curr
      })

      userIDs.sub(() => {
        assert(userIDs.getCurr().includes(4320383123))
        done()
      })

      users.emit({
        john: {
          id: 4320383123,
          name: 'john'
        }
      })
    }
  )
})

// void test('I can create a signal containing instances of a class', async t => {
//   t.test('closure', () => {})
// })
