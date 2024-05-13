export interface Signal<T> {
  readonly emit: (data?: T) => void
  readonly getCurr: () => T
  [signalSym: symbol]: boolean
  readonly sub: (subFn: () => void) => () => void
}

/**
 * - Must return a new value for the signal, depending on its inputs.
 * - It can return the existing value in the signal.
 * - Can accept and return non-serializable values.
 * - Must tear-down side-effects created by current value before returning the
 *   new value. Must also comply with this when processing values emitted by its
 *   containing signal.
 * - Must set-up any side-effects that the new value to be stored needs.
 */
export type Transducer<T, Deps extends readonly Signal<any>[]> = (
  prevData: T,
  trigDep: Deps[number] | Signal<T>
) => T
