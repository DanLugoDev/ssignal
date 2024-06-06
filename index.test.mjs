/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-magic-numbers */
// https://github.com/nodejs/node/issues/50431#issuecomment-2028077686

import assert from 'node:assert'
import { mock, test } from 'node:test'

import { createSignal } from './index.mjs'

// #region mocks ///////////////////////////////////////////////////////////////
/**
 * Returns a random number between min (inclusive) and max (exclusive)
 * @param {number} min
 * @param {number} max
 * @return {number}
 */
const rndBetween = (min, max) => Math.random() * (max - min) + min
console.log(rndBetween(0, 0))

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

void test('I can create an empty signal, for event signaling', async (t) => {
  const evSignal = createSignal()

  await t.test(
    'it has no value in it, and will throw if I try to access it',
    () => {
      assert.throws(() => {
        evSignal.getCurr()
      })
    }
  )

  await t.test('I can then call emit() on it', () => {
    evSignal.emit()
  })

  await t.test('but if I give it a value it will crash', () => {
    assert.throws(() => {
      const rndValues = [0, 1, -1, 'a', {}, []]
      const rndVal = rndValues[rndIntBetween(0, 6)]
      evSignal.emit(rndVal)
    }, Error)
  })

  await t.test('I can sub to it, and it will transmit when it emits', () => {
    const numOfCalls = rndIntBetween(10, 100)
    const mockFn = mock.fn(() => {})

    const unsub = evSignal.sub(mockFn)

    let i = 0
    while (i++ < numOfCalls) evSignal.emit()

    assert.strictEqual(mockFn.mock.calls.length, numOfCalls)

    unsub()
  })

  await t.test(
    'I can plug it as a dependency into another signal',
    async (tt) => {
      const initialDerivedVal = Math.random()
      const derivedSignal = createSignal(initialDerivedVal, [evSignal])

      await tt.test(
        'and the derived signal will trigger when the event signal does',
        () => {
          const numOfCalls = rndIntBetween(10, 100)
          const mockFn = mock.fn(() => {})

          derivedSignal.sub(mockFn)

          let i = 0
          while (i++ < numOfCalls) evSignal.emit()

          assert.strictEqual(mockFn.mock.calls.length, numOfCalls)
        }
      )

      await tt.test(
        "also the derived signal shouldn't have changed it's value",
        () => {
          assert.strictEqual(derivedSignal.getCurr(), initialDerivedVal)
        }
      )
    }
  )
})

void test('I can create a data signal that holds a value and transmits when it changes', async (t) => {
  const users = createSignal({
    john: {
      id: 4320383123,
      name: 'john'
    }
  })

  const userIDs = createSignal([0], [users], (curr, trigDep) => {
    if (trigDep === users) {
      const newIDs = curr.slice()

      newIDs.push(...Object.values(users.getCurr()).map((u) => u.id))

      return newIDs
    }

    // Unreachable, but to please Typescript
    return curr
  })

  await t.test(
    'it transmits to a new signal that has it as a dependency',
    (_, done) => {
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

void test('I can create a signal containing instances of a class', async (t) => {
  t.test('closurew')
})
