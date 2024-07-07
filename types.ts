// export type Nullable<T> = T | never | null | undefined | void

/**
 * @param signal The signal that emitted.
 * @param _path For internal use of the library, will not be provided to normal
 * subbers.
 */
export type SignalSubber<T> = (signal: Signal<T>, _path?: string) => void

export interface Signal<T> {
  /**
   * `s.emit({ ...s.getCurr(), foo: null })` can be used to emit a new object
   * state without overwriting it all. It is however preferable to keep state
   * derivation (new state that depends on old state) contained inside the
   * transducer and use emit() more for event type signals (those created as
   * such: `createSignal()`) and then let those signals trigger the data
   * representation signal. One (not terribly) bad example of state derivation
   * would be:
   * ```js
   * counter = createSignal(0)
   * // ...
   * handleClick = () => counter.emit(counter.getCurr() => + 1)
   * // ...
   * ```
   * And a good example of derived state:
   * ```js
   * addOne = createSignal()
   * counter = createSignal(0, [addOne], (p) => p + 1)
   * // ...
   * handleClick = () => addOne.emit()
   * // ...
   * ```
   */
  emit(data?: T): void
  /**
   * Returns the current state of the data inside this signal, with inner
   * signals serialized away (each inner signal gets .getCurr() called on it,
   * which recursively calls it on its children). The value returned by this
   * method shall not be mutated.
   */
  getCurr(): T
  /**
   * Subs a function to this signal, the function will be provided this signal
   * as its only argument. If this signal is fired but the transducer doesn't
   * change the current value, subscribers will not be invoked.
   */
  sub(subFn: SignalSubber<T>): void
  unsub(subFn: SignalSubber<T>): void
}

interface BasicTransducer<T, Deps extends readonly Signal<unknown>[]> {
  (
    /**
     * Previous data as it existed inside the signal until it just updated.
     */
    prevData: T,
    /**
     * If emit() was called on the signal, this parameter is the data provided
     * to it. If a dependency triggered this update, then that dependency is
     * provided.
     */
    trigDepOrNxt: Deps[number] | T | null | undefined
  ): T
}

// interface EmitterTransducer<T, Deps extends readonly Signal<unknown>[]>
//   extends BasicTransducer<T, Deps> {
//   (
//     /**
//      * Previous data as it existed inside the signal until it just updated.
//      */
//     prevData: T,
//     /**
//      * If emit() was called on the signal, this parameter is the data provided
//      * to it. If a dependency triggered this update, then that dependency is
//      * provided.
//      */
//     trigDepOrNxt: Deps[number] | T | null,
//     /**
//      * Returns the same data as passed, can be used to trigger an update if the
//      * signal is handling mutable data. Also allows the transducer to catch any
//      * error that might result when writing into inner signals (those signals
//      * might have exceptions occur inside their transducers or deliberately
//      * throw as an API enforcement (discouraged as it incurs runtime overhead)).
//      */
//     emit: (data: T) => void
//   ): void
// }

export type Transducer<
  T,
  Deps extends readonly Signal<unknown>[]
> = BasicTransducer<T, Deps>
// | EmitterTransducer<T, Deps>

// export type SignalData<T> = T extends Signal<infer U>
//   ? SignalData<U>
//   : T extends ReadonlyArray<infer U>
//   ? ReadonlyArray<SignalData<U>>
//   : T extends Array<infer UU>
//   ? Array<SignalData<UU>>
//   : T extends Function
//   ? T
//   : T extends { readonly [K in keyof T]: unknown }
//   ? { readonly [K in keyof T]: SignalData<T[K]> }
//   : T extends { [K in keyof T]: unknown }
//   ? { [K in keyof T]: SignalData<T[K]> }
//   : T
