# ssignal

Short for sane-signal or simple-signal. For more complex examples refer to the test file. Install the pre-release ESLint vscode extension for it to correctly work.

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
// Equivalent to a boolean property on some random slice.
const isAuth = createSignal(false, [])
// These types of signals are akin to action creators in redux.
const reqUsersData = createSignal()
const resUsersData = createSignal(
  // Example initial value
  {
    john: {
      name: 'John',
      latestMsg: 'Hello'
    }
  }
)
const resUserMsg = createSignal(
  // Example initial value
  {
    id: 'amy',
    txt: 'hyd'
  }
)

// Here's one way to set up a an external reactive data source.
let ws = new WebSocket('wss://www.example.com')

isAuth.sub(() => {
  if (isAuth.getCurr()) {
    ws.onmessage = function onWsMsg({ data, type }) {
      if (type === 'resUsersData') resUsersData.emit(data)
      if (type === 'resUserMsg') resUserMsg.emit(data)
    }
  }
})

reqUsersData.sub(() => ws.send('reqUsersData'))

// A signal that holds a table of users
const users = createSignal(
  {
    [Math.random().toString()]: {
      name: 'amy',
      latestMsg: 'Hey'
    }
  },
  [resUserMsg, resUsersData],
  (currUsers, trigDep) => {
    if (trigDep === resUserMsg) {
      const { id, txt } = resUserMsg.getCurr()

      return {
        ...currUsers,
        [id]: {
          ...currUsers[id],
          latestMsg: txt
        }
      }
    }
    if (trigDep === resUsersData) {
      const users = resUsersData.getCurr()

      return {
        ...currUsers,
        ...users
      }
    }
    // No mandatory return needed
  }
)

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
        if (type === 'resUsersData') {
          resUsersData.emit(data)
        }
        if (type === 'resUserMsg') {
          resUserMsg.emit(data)
        }

        // This setTimeout ensures this runs after the return statement below.
        // Some libraries that accept event handlers can and will call the event
        // handler with an initial value without an event having actually
        // occurred as part of their API.
        setTimeout(() => {
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
  }
)

// Another version of the users signal, but with a take() approach.
const usersB = createSignal(
  {
    [Math.random().toString()]: {
      name: 'amy',
      latestMsg: 'Hey'
    }
  },
  [socketSignal],
  (currUsers) => {
    const {
      lastMsg: { data, type }
    } = socketSignal.getCurr()

    if (type === 'resUserMsg') {
      const { id, txt } = data

      return {
        ...currUsers,
        [id]: {
          ...currUsers[id],
          latestMsg: txt
        }
      }
    }
    if (type === 'resUsersData') {
      const users = socketSignal.getCurr()

      return {
        ...currUsers,
        ...users
      }
    }
  }
)

// Use case for take approach:

const onKeyPressSignal = createSignal('up', [])

const api = {
  /**
   * @param {(key: string) => void} cb
   */
  subToKeyPress(cb) {
    setInterval(() => cb('up'), 100)
  },
  /**
   * @param {string} html
   */
  render(html) {
    console.log(html)
  }
}

api.subToKeyPress((key) => onKeyPressSignal.emit(key))

const chessPiece = createSignal(
  {
    x: 0,
    y: 0
  },
  [onKeyPressSignal],
  (curr, trigDep) => {
    if (trigDep === onKeyPressSignal) {
      const { x, y } = curr
      const key = onKeyPressSignal.getCurr()

      if (key === 'up') return { x, y: y + 1 }
      if (key === 'down') return { x, y: y - 1 }
      if (key === 'left') return { x: x - 1, y }
      if (key === 'right') return { x: x + 1, y }
    }
  }
)

chessPiece.sub(() => {
  const { x, y } = chessPiece.getCurr()

  api.render('...')
})
```
