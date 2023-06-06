type Unsubscriber = () => void

const identity = <T>(val: T): T => val

export type Subber<T> = (val: T) => void

export interface Signal<T> {
  readonly current: T
  readonly set: (newVal: T) => void
  readonly sub: (subber: Subber<T>) => Unsubscriber
}

export interface Event {
  id: number
  name: string
}

export type FiringHandler<T = null, Deps = unknown[]> = (
  current: T,
  deps: Deps,
  event?: Event
) => T

const isEventSignal = (signal: unknown): signal is Signal<Event> => {
  type _EventSignal = { __IS__EVENT: boolean }
  return Boolean((signal as unknown as _EventSignal).__IS__EVENT)
}

export const createSignal = <T = null>(
  initialValue: T,
  deps: Signal<unknown>[] = [],
  onFire: FiringHandler<T> = identity
): Signal<T> => {
  let current = initialValue
  const depCurrents = deps.map((dep) => dep.current)

  let subs: readonly Unsubscriber[] = []
  const subbers: Subber<T>[] = []

  const notify = () => {
    subbers.forEach((subber) => {
      subber(current)
    })
  }

  const sub = () => {
    subs = deps.map((dep, i) =>
      dep.sub(() => {
        if (isEventSignal(dep)) {
          current = onFire(current, deps, dep.current)
        } else {
          depCurrents[i] = dep.current
          current = onFire(current, deps)
        }
        notify()
      })
    )
  }

  const unsub = () => {
    subs.forEach((unsubber) => {
      unsubber()
    })
    subs = []
  }

  let hasSubbed = false

  return {
    current: initialValue,
    sub: (subber) => {
      if (!hasSubbed) {
        sub()
      }
      subbers.push(subber)

      return () => {
        subbers.splice(subbers.indexOf(subber), 1)
        if (subbers.length === 0) {
          unsub()
        }
      }
    },
    set: (newVal) => {
      current = onFire(newVal, deps)

      notify()
    },
  }
}

export const createEventSignal = (eventName: string): Signal<Event | null> => {
  const signal = createSignal<Event | null>({
    id: Math.random(),
    name: eventName,
  })

  // @ts-expect-error
  signal.__IS__EVENT

  return signal
}
