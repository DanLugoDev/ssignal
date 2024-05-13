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
import * as ss from 'ssignal'
```
