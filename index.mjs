/**
 * @template T
 * @typedef {import('./types.ts').Signal<T>} Signal
 */

/**
 * @template T
 * @template {readonly Signal<any>[]} Deps
 * @typedef {import('./types.ts').Transducer<T,Deps>} Transducer
 */

export const signalSym = Symbol('ssignal/signal')

/* eslint-disable @typescript-eslint/no-magic-numbers */
/**
 * @type {readonly any[]}
 */
export const emptyArr = Object.freeze([])

const zero = 0
const one = 1
const minusOne = -1

/**
 * @template T
 * @template {readonly Signal<any>[]} Deps
 * @param {T=} initialData
 * @param {Deps=} deps
 * @param {Transducer<T, Deps>=} transducer See types.ts
 * @return {Signal<T>}
 */
export function createSignal(initialData, deps, transducer) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  let currData = initialData

  if (arguments.length === zero)
    currData = /** @type {typeof currData} */ ('$$__SSIGNAL__EMPTY')

  const isEventSignal = currData === '$$__SSIGNAL__EMPTY'
  const isDataSignal = !isEventSignal

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
          if (transducer) {
            const prevData = /** @type {T}*/ (currData)
            currData = transducer(prevData, dep)
          }

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
    emit(...args) {
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

        const prevData = /** @type {T} */ (currData)

        if (transducer) currData = transducer(prevData, this)
        else currData = data
      }

      notify()
    },
    getCurr: () => {
      if (currData === '$$__SSIGNAL__EMPTY')
        throw new ReferenceError('Called getCurr() on a event signal')

      return /** @type {T} */ (currData)
    },
    // Helps identify the object as a signal for use inside other signals.
    [signalSym]: true,

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

/**
 * @typedef {object} User
 * @prop {string} latestMsg
 * @prop {string} name
 */

/**
 * @typedef {Readonly<Record<string,User>>} Users
 */

/**
 * @param {any} o
 * @return {o is Users}
 */
const isUsers = (o) => typeof o === 'object'

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
 * @param {any} o
 * @return {o is UserMsg}
 */
const isUserMsg = (o) => typeof o === 'object'

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
const wss = new WebSocket('wss://www.example.com')

isAuth.sub(() => {
  if (isAuth.getCurr())
    wss.onmessage = function onWsMsg({ data, type }) {
      if (type === 'resUsersData')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        resUsersData.emit(JSON.parse(data.toString()))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
 * @prop {any} data
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
  ws: new WebSocket('wss://www.example.com')
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const parsedData = JSON.parse(data.toString())

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
        }, 0)
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
  (currUsers) => {
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
const onKeyPressSignal = createSignal('up', [])

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
    setInterval(() => void cb('up'), 1000)
  }
}

api.subToKeyPress((key) => void onKeyPressSignal.emit(key))

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
 * @prop {() => void} pause
 * @prop {'connecting'|'failed'|'open'|'paused'|'transmitting'} status
 * @prop {string} url
 */

/**
 * @param {string} url
 * @return {Signal<HTTPSocket|null>}
 */
const createHTTPSocketSignal = (url) => {
  // This object would have an underlying state itself that is encapsulated.
  /** @type {HTTPSocket} */
  const httpSocket = {
    // Non-serializable methods for managing req internal update.
    abort() {
      // Close http connection etc here
    },
    lastErr: null,
    pause() {
      this.status = 'paused'
    },
    status: 'connecting',
    url
  }

  // No deps, if we did it this without signals inside signals, every req or
  // tear-up tear-down style would have to listen to maybe too many signals each
  // one, and then the transducer has to be written and provided for each of
  // these kind of signals. With this approach, a signal higher up in the tree
  // can signal to all descendants to cancel. It's up to the consumer to know
  // how much granularity is best.
  const theSignal = createSignal(
    /** @type {HTTPSocket|null} */ (httpSocket),
    [],
    (prevData, self) => {
      const newData = self.getCurr()

      // The transducer shall tear-down
      if (newData === null) {
        if (prevData === null) throw new Error(`Cancelling http socket twice?`)
        prevData.abort()
      }
      if (newData?.status === 'paused') {
        // Keep complex logic encapsulated
        // (This is pseudo-code)
        // const s = Http.modules.sockets.internal.getSocketDescriptor(
        //   newData[descSymbol]
        // )
        // Http.modules.sockets.internal.setState(s, Http.modules.sockets.internal.SocketState.PAUSED)
      }

      return newData
    }
  )

  return theSignal
}

/**
 * Hypothetical download object with an arbitrary number of concurrent
 * connections.
 * @typedef {object} Download
 * @prop {readonly Signal<HTTPSocket>[]} reqs
 * @prop {'ongoing'|'paused'} status
 * @prop {string} url
 */

/**
 * @typedef {Record<string, Signal<Download>>} Downloads
 */

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
          dl.emit({ ...dl.getCurr(), status: 'paused' })

      return newDls
    }
    if (trigDep === userCancelledDl) {
      const dlsToCancel = userCancelledDl.getCurr()

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      dlsToCancel.forEach((id) => delete newDls[id])

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
      removedDls.forEach(([, removed]) => void removed.emit(null))
    }

    return prevDownloads
  }
)

// This will correctly tear down all downloads and thus all reqs
downloads.emit({})

currVidPlaying.emit(Math.random().toString())

// It shall be a contract that any
