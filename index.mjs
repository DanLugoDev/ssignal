/**
 * @type {readonly any[]}
 */
const emptyArr = Object.freeze([])

const zero = 0
const one = 1
const minusOne = -1

/**
 * @template T
 * @typedef {(curr: T, trigDep?: Signal<any>) => T|null|undefined|void} Transducer Called with
 * the signal dep that emitted unless it was a manual emit of this signal.
 */

/**
 * @template T
 * @typedef {object} Signal
 * @prop {(data?: T) => void} emit
 * @prop {() => T} getCurr
 * @prop {(subFn: () => void) => () => void} sub
 */

/**
 * @template T
 * @template {readonly Signal<any>[]} Deps
 * @param {T=} initialData
 * @param {(readonly [...Deps])=} deps
 * @param {Transducer<T>=} transducer
 * @return {Signal<T>}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createSignal(initialData, deps, transducer) {
  /** @type {T} */
  let currData = /** @type {T} */ (initialData)

  if (arguments.length === zero)
    currData = /** @type {T} */ ('$$__SSIGNAL__EMPTY')

  /**
   * @type {readonly (() => void)[]}
   */
  let ownSubs = emptyArr
  if ((deps?.length ?? minusOne) > zero) ownSubs = []

  /**
   * @type {(() => void)[]}
   */
  const subbers = []

  const notify = () => void subbers.forEach((subber) => void subber())

  let hasSubbedOwn = false

  const ownSub = () => {
    hasSubbedOwn = true

    if (deps)
      ownSubs = deps.map((dep) =>
        dep.sub(() => {
          if (transducer)
            currData = /** @type {T} */ (transducer(currData, dep))

          notify()
        })
      )
  }

  /**
   * @return {void}
   */
  const ownUnsub = () => {
    ownSubs.forEach((unsubber) => void unsubber())
    ownSubs = []
  }

  return {
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    emit(...args) {
      const isEventSignal = currData === '$$__SSIGNAL__EMPTY'
      const isDataSignal = !isEventSignal
      const noArg = args.length === zero
      const withArg = args.length === one

      if (isEventSignal && withArg)
        throw new Error(
          'Called emit() with a value on an event signal. Non-event signals with an undefined initial value should be created as such: createSignal(undefined)'
        )

      if (isDataSignal && noArg)
        throw new Error(
          'Called emit() without a value on an non-event signal. For setting undefined as the actual value, it must be passed in as an argument, as such: signal.emit(undefined)'
        )

      if (isDataSignal) {
        const [data] = args

        currData = /** @type {T} */ (data)

        if (transducer) currData = /** @type {T} */ (transducer(currData))
      }

      notify()
    },
    getCurr: () => {
      if (currData === '$$__SSIGNAL__EMPTY')
        throw new ReferenceError('Called getCurr() on a event signal')

      return /** @type {T} */ (currData)
    },
    sub: (subber) => {
      if (!hasSubbedOwn) ownSub()

      subbers.push(subber)

      return () => {
        subbers.splice(subbers.indexOf(subber), one)

        // Don't unnecessarily sub this signal to dependents if no other
        // signal is subbed to this one.
        if (subbers.length === zero) ownUnsub()
      }
    }
  }
}
