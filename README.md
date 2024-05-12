# ssignal

Short for sane-signal or simple-signal.

```ts
import * as ss from 'ssignal'

const someSignal = ss.createSignal(0)

someSignal.sub(() => {
  console.log(someSignal.getCurr())
})

someSignal.emit(1) // console will log "1"
```

# Examples

```js
/**
 * @typedef {object} User
 * @prop {string} latestMsg
 * @prop {string} name
 */

/**
 * @typedef {Readonly<Record<string,User>>} Users
 */

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string
        resUsersData.emit(JSON.parse(data.toString()))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string
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
        if (type === 'resUsersData')
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          resUsersData.emit(data)

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (type === 'resUserMsg') resUserMsg.emit(data)

        // This setTimeout ensures this runs after the return statement below.
        // Some libraries that accept event handlers can and will call the event
        // handler with an initial value without an event having actually
        // occurred as part of their API.
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          socketSignal.emit({ lastMsg: { data, type }, ws })
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { id, text } = /** @type {UserMsg} */ (data)

      return {
        ...currUsers,
        [id]: {
          ...(currUsers[id] ?? { name: id }),
          latestMsg: text
        }
      }
    }
    if (type === 'resUsersData') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const usersData = /** @type {Users} */ (data)

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
```
