/* eslint-disable @typescript-eslint/init-declarations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import WebSocket from 'isomorphic-ws'
// const uuid = () => Math.random().toString()

/**
 * @template T
 * @typedef {import('./types.ts').Nullable<T>} Nullable
 */
/**
 * @template T
 * @typedef {import('./types.ts').SignalSubber<T>} SignalSubber
 */
/**
 * @template T
 * @typedef {import('./types.ts').Signal<T>} Signal
 */
/**
 * @template T
 * @template {readonly Signal<unknown>[]} Deps
 * @typedef {import('./types.ts').Transducer<T,Deps>} Transducer
 */
/**
 * @template T
 * @typedef {import('./types.ts').SignalData<T>} SignalData
 */

/**
 * @typedef {() => void} VoidFn
 */

/** Unique path delimiter to avoid collisions */
export const del = '////$$__SSIGNAL__PATH__DELIMITER////'

const zero = 0
const one = 1
// const minusOne = -1
// const two = 2
// const three = 3
// const numbers = '01234567890'.split('')

export const emptyFn = () => void null

/**
 * @type {readonly any[]}
 */
export const emptyArr = Object.freeze([])

const signalSym = Symbol('ssignal-signal')

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

/**
 * @template Cast
 * @param {string} path
 * @param {Cast|Record<number|string, Cast>|Cast[]|undefined} o
 * @return {Nullable<Cast>}
 */
export const pathGet = (path, o) => {
  /** @typedef {Record<number|string, Cast>} CastObj */
  if (path === '') throw new Error('pathGet() got empty path')

  // 'anything'.split(unique) will always yield at least one item
  const bits = /** @type {[string, ...string[]]} */ (path.split(del))

  const [bit, ...bitsRest] = bits

  if (!isObj(o)) return undefined

  if (bit.startsWith('[')) {
    if (!Array.isArray(o)) return undefined
    const idx = bit.replaceAll('[', '').replaceAll(']', '')
    const i = Number(idx)
    const res = /** @type {Cast[]} */ (o)[i]
    if (bitsRest.length === 0) return res
    return pathGet(bitsRest.join(del), res)
  }

  const res = /** @type {CastObj} */ (o)[bit]

  if (bitsRest.length === 0) return res

  return pathGet(bitsRest.join(del), res)
}

/**
 * @template {object} T
 * @template U
 * @param {T} obj
 * @param {(val: T[keyof T], k: number|string) => U} mapper
 * @return {{[K in keyof T]: U}}
 */
export const mapObj = (obj, mapper) => {
  /** @type {Record<keyof T, U>} */
  // @ts-expect-error
  const res = {}

  for (const [key, value] of Object.entries(obj)) {
    // TODO: Should work as long as data is not using symbols.
    const k = /** @type {keyof T} */ (key)
    // mapper will erase the any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const val = /** @type {T[keyof T]} */ (value)

    res[k] = mapper(val, key)
  }

  return res
}

/**
 * @template T
 * @param {T} prevData
 * @param {T} currData
 * @return {unknown}
 */
const teardownInnerSignalsIfNeeded = (prevData, currData) => {}

/**
 * @template T
 * @param {unknown} o
 * @return {o is Signal<T>}
 */
export const isSignal = o => {
  if (isObj(o)) return Boolean(o['__isSignal'])
  return false
}

/**
 * @param {unknown} o
 * @returns {boolean}
 */
const detectSignalsInside = o => {
  if (typeof o === 'object' && o !== null) {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (o._isSignal) return true

    return Object.values(o).every(subO => detectSignalsInside(subO))
  }

  if (Array.isArray(o)) return o.every(subO => detectSignalsInside(subO))

  return false
}

/**
 * @template InnerShape
 * @param {InnerShape} data
 * @param {((path: string, signal: Signal<unknown>) => void)=} onSignalDetected
 * @param {string=} path
 * @return {Readonly<SignalData<InnerShape>>}
 */
const serializeSignalData = (data, onSignalDetected = emptyFn, path = '') => {
  if (isArray(data)) {
    // TODO: Why is this cast needed?
    const processed = /** @type {SignalData<InnerShape>}*/ (
      data.map((val, i) =>
        serializeSignalData(val, onSignalDetected, `path[${i}]`)
      )
    )

    return processed
  }

  if (typeof data === 'object' && data !== null) {
    if (isSignal(data)) {
      onSignalDetected(path, data)
      return data.getCurr()
    }

    const newObj = mapObj(data, (item, key) =>
      serializeSignalData(
        item,
        onSignalDetected,
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        path + del + key
      )
    )

    // TODO: Why is cast needed?
    return /** @type {SignalData<InnerShape>} */ (newObj)
  }

  // TODO: Why is cast needed?
  return /** @type {SignalData<InnerShape>} */ (data)
}

/**
 * @template T
 * @template {readonly Signal<any>[]} Deps
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
 * @param {boolean=} usesInnerSignals False by default, pass true to tell
 * createSignal() the signal can and will hold inner signals, this is turned off
 * by default as an optimization.
 * @param {string=} _path For inner usage of this library. Do not pass.
 * @return {Signal<T>}
 */
export function createSignal(
  initialData,
  deps,
  transducer,
  usesInnerSignals,
  _path
) {
  /** @type {Signal<T>} */
  // eslint-disable-next-line prefer-const
  let self
  // undefined is part of T at this point
  let currData = /** @type {T} */ (initialData)
  /**
   * This value shall be memoized (updated on writes, reads don't compute). This
   * value shall be checked before running serializeSignalData()
   */
  let hasSignalInside = false
  /** @type {Record<string, Signal<unknown>>} */
  const pathToSignal = {}
  /**
   * @type {Readonly<SignalData<T>>}
   */
  // eslint-disable-next-line
  let currSerialized
  if (usesInnerSignals) currSerialized = serializeSignalData(currData)
  // else currSerialized = /** @type {SignalData<T>} */ (currData)

  /**
   * @type {SignalSubber<unknown>} signal
   */
  const handleInnerSignal = (signal, path) => {
    signal.getCurr()
  }

  const processSignalsInside = () => {
    // This could probably optimized later by not generating the whole list
    // unnecessarily.
    /** @type {Record<string, { signal: Signal<unknown>, unsub: VoidFn }>} */
    const pathToSignalNew = {}

    currSerialized = serializeSignalData(currData, (path, signal) => {
      hasSignalInside = true
      pathToSignalNew[path] = signal
    })
  }
  processSignalsInside()

  // #region subscribedToMe
  /** @type {SignalSubber<T>[]} */
  const mySubbers = []
  /** @type {VoidFn} */
  let notifyMySubscribers
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (_path)
    notifyMySubscribers = () => {
      for (const subber of mySubbers) subber(self, _path)
    }
  else
    notifyMySubscribers = () => {
      for (const subber of mySubbers) subber(self)
    }
  // #endregion subscribedToMe

  // #region myOwnSubscriptions
  /**
   * @param {Signal<unknown>} dep
   * @return {void}
   */
  const onDepFire = dep => {
    if (!transducer) return

    const prevData = currData

    transducer(currData, dep)

    if (currData !== prevData) {
      hasSignalInside = detectSignalsInside(currData)
      if (hasSignalInside) currSerialized = serializeSignalData(currData)
      else currSerialized = /** @type {SignalData<T>} */ (currData)
      notifyMySubscribers()
    }
  }

  let iHaveSubscribed = false
  const performMySubscriptions = () => {
    iHaveSubscribed = true

    if (deps) deps.forEach(dep => void dep.sub(onDepFire))
  }
  /**
   * @return {void}
   */
  const ownUnsub = () => {
    /** @type {Deps}*/ deps?.forEach(dep => void dep.unsub(onDepFire))
  }
  // #endregion myOwnSubscriptions

  self = {
    emit(data) {
      const prevData = currData

      if (transducer) currData = transducer(prevData, data)
      else currData = /** @type {T} */ (data) // T is Nullable

      //#region innerSignalTeardown
      if (hasSignalInside) {
        //#region simpleTeardown
        // The transducer nulled out all previous inner signals, simple teardown
        if (Array.isArray(prevData) && !Array.isArray(currData))
          for (const [i, signal] of Object.entries(pathToSignal)) {
            signal.unsub(handleInnerSignal)
            delete pathToSignal[i]
          }

        if (isObj(prevData) && !isObj(currData))
          for (const [path, signal] of Object.entries(pathToSignal)) {
            signal.unsub(handleInnerSignal)
            delete pathToSignal[path]
          }
        //#endregion simpleTeardown

        // Reconciliation is needed
        for (const [path, existingSignal] of Object.entries(pathToSignal)) {
          const newVal = pathGet(path, currData)
          if (newVal !== existingSignal) {
            existingSignal.unsub(handleInnerSignal)
            if (isSignal(newVal)) {
              pathToSignal[path] = newVal
              newVal.sub(handleInnerSignal)
            } else delete pathToSignal[path]
          }
        }
      }

      //#endregion innerSignalTeardown

      // weak set
      if (!Object.is(currData, prevData)) {
        hasSignalInside = detectSignalsInside(currData)
        if (hasSignalInside) currSerialized = serializeSignalData(currData)
        else currSerialized = /** @type {SignalData<T>} */ (currData)

        notifyMySubscribers()
      }
    },
    getCurr() {
      if (hasSignalInside) return currSerialized
      // True positive but hasSignalInside var checks for this
      return /** @type {SignalData<T>} */ (currData)
    },
    // @ts-expect-error
    [signalSym]: true,
    sub(subber) {
      if (!iHaveSubscribed) performMySubscriptions()

      mySubbers.push(subber)
    },
    unsub(subber) {
      mySubbers.splice(mySubbers.indexOf(subber), one)

      // Don't unnecessarily sub this signal to dependents if no other
      // signal is subbed to this one.
      if (mySubbers.length === zero) ownUnsub()
    }
  }

  return self
}

/**
 * @typedef {object} User
 * @prop {string} latestMsg
 * @prop {string} name
 */

/**
 * @typedef {{ readonly [K: string]: User }} Users
 */

/**
 * @param {unknown} o
 * @return {o is Users}
 */
const isUsers = o => typeof o === 'object'

/**
 * @type {Users}
 */
const initUsersData = {
  john: {
    latestMsg: 'Hello',
    name: 'John'
  }
}

/**
 * @typedef {object} UserMsg
 * @prop {string} id
 * @prop {string} text
 */

/**
 * @param {unknown} o
 * @return {o is UserMsg}
 */
const isUserMsg = o => typeof o === 'object'

/**
 * @type {UserMsg}
 */
const userMsgInit = {
  id: 'amy',
  text: 'hyd'
}

// Equivalent to a boolean property on some random slice.
const isAuth = createSignal(false, [])
// These types of signals are akin to action creators in redux.
const reqUsersData = createSignal()
const resUsersData = createSignal(initUsersData)
const resUserMsg = createSignal(userMsgInit)

// Here's one way to set up a an external reactive data source.
const wss = new WebSocket('wss://ws.postman-echo.com/raw')

isAuth.sub(() => {
  if (isAuth.getCurr())
    wss.onmessage = function onWsMsg({ data, type }) {
      if (type === 'resUsersData')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string
        resUsersData.emit(JSON.parse(data.toString()))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string
      if (type === 'resUserMsg') resUserMsg.emit(JSON.parse(data.toString()))
    }
})

reqUsersData.sub(() => void wss.send('reqUsersData'))

/**
 * @type {Users}
 */
const usersInitData = {
  amy: {
    latestMsg: 'Hey',
    name: 'amy'
  }
}

// A signal that holds a table of users
const users = createSignal(
  usersInitData,
  [resUserMsg, resUsersData],
  /**
   * @returns {Users}
   */
  (currUsers, trigDep) => {
    if (trigDep === resUserMsg) {
      const { id, text } = resUserMsg.getCurr()

      return {
        ...currUsers,
        [id]: {
          ...(currUsers[id] ?? { name: id }),
          latestMsg: text
        }
      }
    }
    if (trigDep === resUsersData) {
      const usersData = resUsersData.getCurr()

      return {
        ...currUsers,
        ...usersData
      }
    }
    // Please typescript
    return currUsers
  }
)

users.sub(() => void console.log(users.getCurr()))

// Here's another way to set up a an external reactive data source. Here ssignal
// handles the sub/pub. A signal that contains a mutable value, similar to
// saga's take().

/**
 * @typedef {object} SocketMsg
 * @prop {unknown} data
 * @prop {string} type
 */

/**
 * @typedef {object} SocketSignalShape
 * @prop {SocketMsg} lastMsg
 * @prop {WebSocket} ws
 */

/**
 * @type {SocketSignalShape}
 */
const initSocketSignal = {
  lastMsg: {
    data: null,
    type: 'null'
  },
  ws: new WebSocket('wss://ws.postman-echo.com/raw')
}

const socketSignal = createSignal(
  initSocketSignal,
  [isAuth, reqUsersData],
  (curr, trigDep) => {
    const { lastMsg, ws } = curr

    if (trigDep === isAuth && isAuth.getCurr()) {
      /**
       * @param {SocketMsg} socketMsg
       * @return {SocketSignalShape|void}
       */
      ws.onmessage = function onWsMsg({ data, type }) {
        if (typeof data !== 'string')
          throw new TypeError('Non-string socket msg')

        const parsedData = /** @type {unknown} */ (JSON.parse(data.toString()))

        if (type === 'resUsersData') {
          if (!isUsers(parsedData)) throw new TypeError()
          resUsersData.emit(parsedData)
        }

        if (type === 'resUserMsg') {
          if (!isUserMsg(parsedData)) throw new TypeError()
          resUserMsg.emit(parsedData)
        }

        // This setTimeout ensures this runs after the return statement below.
        // Some libraries that accept event handlers can and will call the event
        // handler with an initial value without an event having actually
        // occurred as part of their API.
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          socketSignal.emit({ lastMsg: { data: parsedData, type }, ws })
          // ^^^^ With this socketSignal.getCurrent() will always provide the
          // latest event received of any type to its subbers.
        }, zero)
      }

      return {
        lastMsg,
        ws
      }
    }

    return curr
  }
)

// Another version of the users signal, but with a take() approach.
const usersB = createSignal(
  usersInitData,
  [socketSignal],
  /** @return {Users} */
  currUsers => {
    // No need to look at trigSignal because there's only one dep
    const {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      lastMsg: { data, type }
    } = socketSignal.getCurr()

    if (type === 'resUserMsg') {
      if (!isUserMsg(data)) throw new TypeError()
      const { id, text } = data

      return {
        ...currUsers,
        [id]: {
          ...(currUsers[id] ?? { name: id }),
          latestMsg: text
        }
      }
    }
    if (type === 'resUsersData') {
      if (!isUsers(data)) throw new TypeError()
      const usersData = data

      return {
        ...currUsers,
        ...usersData
      }
    }
    // please typescript
    return currUsers
  }
)

usersB.sub(() => void console.log(usersB.getCurr()))

// Use case for take approach:

// Equivalent to an action creator with payload.
const onKeyPressSignal = createSignal('up')

// Equivalent to an action creator with payload.
const onPieceClickedSignal = createSignal(Math.random().toString())

const api = {
  /**
   * @param {string} html
   */
  render(html) {
    console.log(html)
  },
  /**
   * @param {(key: string) => void} cb
   */
  subToKeyPress(cb) {
    // eslint-disable-next-line
    setInterval(() => void cb('up'), 1000)
  }
}

api.subToKeyPress(key => void onKeyPressSignal.emit(key))

const chessPiece = createSignal(
  {
    id: Math.random().toString(),
    x: 0,
    y: 0
  },
  [onKeyPressSignal, onPieceClickedSignal],
  (curr, trigDep) => {
    if (trigDep === onKeyPressSignal) {
      const { id, x, y } = curr
      const key = onKeyPressSignal.getCurr()

      if (key === 'up') return { id, x, y: y + 1 }
      if (key === 'down') return { id, x, y: y - 1 }
      if (key === 'left') return { id, x: x - 1, y }
      if (key === 'right') return { id, x: x + 1, y }
    }

    // please typescript
    return curr
  }
)

chessPiece.sub(() => {
  const { id } = chessPiece.getCurr()

  api.render(`
    ...
      <div
        class="piece"
        id=${id}
        onclick="onPieceClickedSignal(e.target.id)"
      />
    ...
    ...
  `)
})

// For cancellables, including chainable ones, signals inside signals can be
// used, leveraging set-up or teardown capabilities inside the transducer. Any
// signal will detect when given signals as children and treat those values as
// special, but will return them serialized (calling getCurr on each descendant
// signal and merging the values). This helps contain tear-down logic, Downloads
// doesn't need to know how a HTTPSocket has to be cancelled.

const currVidPlaying = createSignal('')
const userCancelledDl = createSignal(['', ''])

/**
 * @typedef {object} HTTPSocket
 * @prop {() => void} abort
 * @prop {null|string} lastErr
 * @prop {(subber: VoidFn)=> VoidFn} on
 * @prop {() => void} pause
 * @prop {'cancelled'|'connecting'|'failed'|'open'|'paused'|'transmitting'} status
 * @prop {string} url
 */

/**
 * @param {string} url
 * @return {Signal<HTTPSocket>}
 */
const createHTTPSocketSignal = url => {
  /** @type {VoidFn[]} */
  const subbers = []

  // This object would have an underlying state itself that is encapsulated.
  /** @type {HTTPSocket} */
  const httpSocket = {
    // Non-serializable methods for managing req internal update.
    abort() {
      // Close http connection etc here
    },
    lastErr: null,
    on(subber) {
      subbers.push(subber)
      return () => void subbers.splice(subbers.indexOf(subber), one)
    },
    pause() {
      this.status = 'paused'
    },
    status: 'connecting',
    url
  }

  // No deps, if we did it this without signals inside signals, every signal
  // like this would have to listen to maybe too many deps each one, and then
  // the transducer has to be written and provided for each of these kind of
  // signals. With this approach, a signal higher up in the tree can signal to
  // all descendants to cancel (via nulling out or property setting). It's up to
  // the consumer to know how much granularity is best. More complex messaging
  // than nulling out a value is going to require some coupling but will still
  // conserve some good encapsulation.
  const theSignal = createSignal(httpSocket)

  httpSocket.on(() => {
    console.log('socket msg')
  })

  return theSignal
}

/**
 * Hypothetical download object with an arbitrary number of concurrent
 * connections.
 * @typedef {object} Download
 * @prop {readonly Signal<HTTPSocket>[]} sockets
 * @prop {'canceled'|'ongoing'|'paused'} status
 * @prop {string} url
 */

/**
 * @typedef {{ [K: string]: Signal<Download> }} Downloads
 */

const maxHttpSocketsAtOnce = 4

/**
 * @param {string} url
 * @return {Signal<Download>}
 */
const createDownloadSignal = url => {
  const sockets = new Array(maxHttpSocketsAtOnce)
    .fill(null)
    .map(() => createHTTPSocketSignal(url))

  /** @type {Download} */
  const dlInit = {
    sockets,
    status: 'paused',
    url
  }

  // If any of the http socket signals updates itself, the transducer will also
  // be fired.
  return createSignal(dlInit, [], (prev, nxtSelf) => {
    const nxt = nxtSelf.getCurr()

    if (!nxt)
      // Any of these 2 will have the library take care of inner signal unsub:
      // return null;
      return {
        sockets: [],
        status: 'canceled',
        url: prev.url
      }

    // A consumer of this signal called emit() on it, emit() will always contain
    // a full (serialized) data representation, so the consumer must have called
    // emit({ ...dlSignal.getCurr(), status: 'paused' }) It's up to the
    // transducer to reconciliate the diff, and reject bad writes, an example of
    // a bad write in here would be having its reqs written from outside, an
    // underscore prefix to the property should be enough to mark it as
    // private/semi-private. An error can be thrown in development to catch
    // programmer errors. But it's preferable to use closure inside
    // createDownloadSignal() to hide encapsulate sockets away from consumers of
    // this signal.
    const { sockets: nxtSockets, status, url: nxtURL } = nxt

    if (process.env['NODE_ENV'] === 'development') {
      if (nxtURL !== prev.url)
        throw new TypeError('URL must not be overwritten')

      // This check isn't actually possible because of serialization
      // But let's check length for the example's sake:
      if (nxtSockets.length !== prev.sockets.length)
        throw new TypeError('Sockets must not be overwritten')
    }

    // Here's an example where we allow sockets to be directly written into to
    // showcase writing to the signals inside. But this is probably an
    // anti-pattern.
    nxtSockets.forEach((nxtSocket, i) => {
      // This will trigger this same transducer, n times, such writes can be
      // batched better if triggered by an event signal instead of emit(), and
      // handled differently.
      // setImmediate()?
      prev.sockets[i]?.emit(nxtSocket)
    })

    if (status === 'paused') {
      // One way to accomplish this
      // for (const req of sockets) req.getCurr().pause()

      // Or another, less coupled:
      for (const socket of sockets)
        socket.emit({ ...socket.getCurr(), status: 'paused' })

      return {
        ...prev,
        ...nxt
      }
    }
  })
}

/**
 * @type {Downloads}
 */
const downloadsInit = {}

const downloads = createSignal(
  downloadsInit,
  [isAuth, currVidPlaying, userCancelledDl],
  (prevDownloads, trigDep) => {
    /** @type {Downloads} */
    const newDls = { ...prevDownloads }

    if (trigDep === isAuth) {
      // Pausing all downloads based on auth status from one single location
      const didAuth = isAuth.getCurr()
      const unAuth = !didAuth

      if (unAuth)
        for (const dl of Object.values(newDls))
          dl.emit({
            ...dl.getCurr(),
            status: 'paused'
          })

      return newDls
    }
    if (trigDep === userCancelledDl) {
      const dlsToCancel = userCancelledDl.getCurr()

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      for (const id of dlsToCancel) delete newDls[id]

      return newDls
    }
    if (trigDep === currVidPlaying) {
      const maybeVidID = currVidPlaying.getCurr()
      const isPlayingVid = Boolean(maybeVidID)

      // User started watching video, pause downloads to prioritize streaming.
      if (isPlayingVid)
        for (const dl of Object.values(newDls))
          dl.emit({ ...dl.getCurr(), status: 'paused' })
    }
    if (trigDep === downloads) {
      const newDownloads = downloads.getCurr()

      const removedDls = Object.entries(prevDownloads).filter(
        ([id]) => !(id in newDownloads)
      )

      // This signals to each individual download to disconnect, and they are
      // each one in charge of their http sockets/states/etc.
      for (const [, removed] of removedDls) removed.emit(undefined)
    }

    return prevDownloads
  }
)

// This will correctly tear down all downloads and thus all http sockets
downloads.emit({})

currVidPlaying.emit(Math.random().toString())

// It shall be a contract that any

// HTML-Generating signal
/**
 * @type {Record<string, Function>}
 */
const globalHandlerRegistry = {}

/**
 * @typedef {object} HTMLSignal
 * @prop {string} html
 * @prop {() => void} clickHandler
 */
