/* eslint-disable @typescript-eslint/init-declarations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
// import WebSocket from 'isomorphic-ws'
// const uuid = () => Math.random().toString()

/**
 * @template [T=unknown]
 * @typedef {import('./types.ts').SignalSubber<T>} SignalSubber
 */
/**
 * @template [T=unknown]
 * @typedef {import('./types.ts').Signal<T>} Signal
 */
/**
 * @template T
 * @template {readonly Signal<unknown>[]} Deps
 * @typedef {import('./types.ts').Transducer<T,Deps>} Transducer
 */

/**
 * @typedef {() => void} VoidFn
 */

/**
 * @template S
 * @typedef {S | ((prevState: S) => S)} SetStateAction
 */

/** Unique path delimiter to avoid collisions */
// export const del = '////$$__SSIGNAL__PATH__DELIMITER////'

// const numbers = '01234567890'.split('')

export const emptyFn = () => void null

// /**
//  * @type {readonly any[]}
//  */
// export const emptyArr = Object.freeze([])

// const signalSym = Symbol('ssignal-signal')

/**
 * @param {unknown} o
 * @return {o is Record<number|string|symbol, unknown>}
 */
export const isObj = o => typeof o === 'object' && o !== null

/**
 * @param {unknown} o
 * @return {o is Array<unknown>}
 */
export const isArray = o => Array.isArray(o)

// /**
//  * @param {string} path
//  * @param {unknown} o
//  * @return {unknown}
//  */
// export const pathGet = (path, o) => {
//   /** @typedef {Record<number|string, unknown>} CastObj */
//   if (path === '') throw new Error('pathGet() got empty path')

//   // 'anything'.split(unique) will always yield at least one item
//   const [bit, ...bitsRest] = /** @type {[string, ...string[]]} */ (
//     path.split(del)
//   )

//   if (!isObj(o)) return undefined

//   if (bit.startsWith('[')) {
//     if (!Array.isArray(o)) return undefined
//     const idx = bit.replaceAll('[', '').replaceAll(']', '')
//     const i = Number(idx)
//     const res = /** @type {unknown[]} */ (o)[i]
//     if (bitsRest.length === 0) return res
//     return pathGet(bitsRest.join(del), res)
//   }

//   const res = /** @type {CastObj} */ (o)[bit]

//   if (bitsRest.length === 0) return res

//   return pathGet(bitsRest.join(del), res)
// }

// /**
//  * @template {object} T
//  * @template U
//  * @param {T} obj
//  * @param {(val: T[keyof T], k: number|string) => U} mapper
//  * @return {{[K in keyof T]: U}}
//  */
// export const mapObj = (obj, mapper) => {
//   /** @type {Record<keyof T, U>} */
//   // @ts-expect-error
//   const res = {}

//   for (const [key, value] of Object.entries(obj)) {
//     // TODO: Should work as long as data is not using symbols.
//     const k = /** @type {keyof T} */ (key)
//     // mapper will erase the any
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//     const val = /** @type {T[keyof T]} */ (value)

//     res[k] = mapper(val, key)
//   }

//   return res
// }

// /**
//  * @param {Record<string, any>} o
//  * @return {o is Signal}
//  */
// export const objIsSignal = o => Boolean(o['__isSignal'])

// /**
//  * @param {unknown} o
//  * @returns {boolean}
//  */
// const detectSignalsInside = o => {
//   if (typeof o === 'object' && o !== null) {
//     // @ts-expect-error
//     // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
//     if (o._isSignal) return true

//     return Object.values(o).every(subO => detectSignalsInside(subO))
//   }

//   if (Array.isArray(o)) return o.every(subO => detectSignalsInside(subO))

//   return false
// }

// /**
//  * @template InnerShape
//  * @param {InnerShape} data
//  * @param {((path: string, signal: Signal<unknown>) => void)=} onSignalDetected
//  * @param {string=} path
//  * @return {Readonly<SignalData<InnerShape>>}
//  */
// const serializeSignalData = (data, onSignalDetected = emptyFn, path = '') => {
//   if (isArray(data)) {
//     // TODO: Why is this cast needed?
//     const processed = /** @type {SignalData<InnerShape>}*/ (
//       data.map((val, i) =>
//         serializeSignalData(val, onSignalDetected, `path[${i}]`)
//       )
//     )

//     return processed
//   }

//   if (typeof data === 'object' && data !== null) {
//     if (objIsSignal(data)) {
//       onSignalDetected(path, data)
//       // @ts-expect-error
//       return data.getCurr()
//     }

//     const newObj = mapObj(data, (item, key) =>
//       serializeSignalData(
//         item,
//         onSignalDetected,
//         // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
//         path + del + key
//       )
//     )

//     // TODO: Why is cast needed?
//     return /** @type {SignalData<InnerShape>} */ (newObj)
//   }

//   // TODO: Why is cast needed?
//   return /** @type {SignalData<InnerShape>} */ (data)
// }

/**
 * @template T
 * @template {readonly Signal<unknown>[]} Deps
 * @param {T=} initialData Optional. If no value given, the signal will be
 * treated as an event signal and will have some additional optimizations. This
 * value must not be a signal itself, the library will not throw for performance
 * reasons but behavior will be undefined.
 * @param {Deps=} deps Optional. If not provided, the signal only fire when
 * emit() is called on it.
 * @param {Transducer<T, Deps>=} transducer Optional. - Must return a new value
 * for the signal, depending on its inputs.
 * - It can return the existing value in the signal.
 * - Can accept and return non-serializable values.
 * - Must tear-down side-effects created by current value before returning the
 *   new value. Must also comply with this when processing values emitted by
 *   signals inside this signal.
 * - Must set-up any side-effects that the new value to be stored needs.
 * - The triggering signal is provided, the transducer then can decide how to
 *   process info according to the signal dependency that triggered it, for
 *   either optimization (do not have to read all of the dependency signals
 *   again to compute a new value) or business logic purposes.
 * - Must not reject null/false/undefined or otherwise falsy values.
 * - Inner signals created
 * param {boolean=} usesInnerSignals False by default, pass true to tell
 * createSignal() the signal can and will hold inner signals, this is turned off
 * by default as an optimization.
 * param {string=} _path For inner usage of this library. Do not pass.
 * @return {Signal<T>}
 */
export function createSignal(
  initialData,
  deps,
  transducer
  // usesInnerSignals,
  // _path
) {
  /** @type {Signal<T>} */
  // eslint-disable-next-line prefer-const
  let self
  // undefined is part of T at this point
  let currData = /** @type {T} */ (initialData)
  // /**
  //  * This value shall be memoized (updated on writes, reads don't compute). This
  //  * value shall be checked before running serializeSignalData()
  //  */
  // let hasSignalInside = false
  // /** @type {Record<string, Signal<unknown>>} */
  // const pathToSignal = {}
  // /**
  //  * @type {Readonly<SignalData<T>>}
  //  */
  // // eslint-disable-next-line
  // let currSerialized
  // if (usesInnerSignals) currSerialized = serializeSignalData(currData)
  // // else currSerialized = /** @type {SignalData<T>} */ (currData)
  // const transducerUsesEmit = transducer?.length === 4
  // /**
  //  * @type {SignalSubber<unknown>} signal
  //  */
  // const handleInnerSignal = (signal, path) => {
  //   const nxt = signal.getCurr()
  //   pathGet(path, currData)
  // }

  // const processSignalsInside = () => {
  //   // This could probably optimized later by not generating the whole list
  //   // unnecessarily.
  //   /** @type {Record<string, Signal} */
  //   const pathToSignalNew = {}

  //   currSerialized = serializeSignalData(currData, (path, signal) => {
  //     hasSignalInside = true
  //     pathToSignalNew[path] = signal
  //   })
  // }
  // processSignalsInside()

  // #region subscribedToMe
  /** @type {SignalSubber<T>[]} */
  const mySubbers = []
  /** @type {VoidFn} */
  const notifyMySubscribers = () => {
    for (const subber of mySubbers) subber(self)
  }
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  // if (_path)
  //   notifyMySubscribers = () => {
  //     for (const subber of mySubbers) subber(self, _path)
  //   }
  // else
  //   notifyMySubscribers = () => {
  //     for (const subber of mySubbers) subber(self)
  //   }
  // #endregion subscribedToMe

  // #region myOwnSubscriptions
  /**
   * @param {Signal<unknown>} dep
   * @return {void}
   */
  const onDepFire = dep => {
    if (transducer) currData = transducer(currData, dep)

    // hasSignalInside = detectSignalsInside(currData)
    // if (hasSignalInside) currSerialized = serializeSignalData(currData)
    // else currSerialized = /** @type {SignalData<T>} */ (currData)
    notifyMySubscribers()
  }

  if (deps) deps.forEach(dep => void dep.sub(onDepFire))
  // #endregion myOwnSubscriptions

  self = {
    emit(data) {
      const prevData = currData

      if (transducer) currData = transducer(prevData, data)
      else currData = /** @type {T} */ (data) // T is Nullable

      // if (!hasSignalInside) return
      // hasSignalInside = false
      // if (!currData) {
      // }
      // for (const [path, existingSignal] of Object.entries(pathToSignal)) {
      //   const newVal = pathGet(path, currData)

      //   // eslint-disable-next-line no-continue
      //   if (newVal === existingSignal.getCurr()) continue

      //   existingSignal.emit(newVal)

      //   if (typeof newVal === 'object' && newVal !== null) {
      //     hasSignalInside = true

      //     if (objIsSignal(newVal) /* transducer replaced signal */) {
      //       // Should this be an anti-pattern?
      //       existingSignal.unsub(handleInnerSignal)
      //       pathToSignal[path] = newVal
      //       newVal.sub(handleInnerSignal)
      //     } else existingSignal.emit(newVal)
      //   } else if (typeof newVal === 'function') existingSignal.emit(newVal)
      //   else {
      //     existingSignal.unsub(handleInnerSignal)
      //     delete pathToSignal[path]
      //   }
      // }

      // if (hasSignalInside) currSerialized = serializeSignalData(currData)
      // else currSerialized = /** @type {SignalData<T>} */ (currData)

      notifyMySubscribers()

      // TODO: explore weak set
    },
    getCurr() {
      // if (hasSignalInside) return currSerialized
      // True positive but hasSignalInside var checks for this
      return currData
    },
    // // @ts-expect-error
    // [signalSym]: true,
    sub(subber) {
      mySubbers.push(subber)
    },
    unsub(subber) {
      mySubbers.splice(mySubbers.indexOf(subber), 1)
    }
  }

  return self
}
