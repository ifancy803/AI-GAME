export type Listener<TState> = (state: TState) => void;
export type StateUpdater<TState> = TState | ((current: TState) => TState);

export interface Store<TState> {
  getState: () => TState;
  setState: (updater: StateUpdater<TState>) => void;
  subscribe: (listener: Listener<TState>) => () => void;
}

export function createStore<TState>(initialState: TState): Store<TState> {
  let state = initialState;
  const listeners = new Set<Listener<TState>>();

  const getState = () => state;

  const setState = (updater: StateUpdater<TState>) => {
    state = typeof updater === 'function' ? (updater as (current: TState) => TState)(state) : updater;
    listeners.forEach((listener) => listener(state));
  };

  const subscribe = (listener: Listener<TState>) => {
    listeners.add(listener);
    listener(state);

    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState,
    setState,
    subscribe,
  };
}
