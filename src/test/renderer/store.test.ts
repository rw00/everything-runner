import { ObservableStore } from "../../renderer/store";

describe("ObservableStore", () => {
  test("should initialize with given state and notify listeners on state change", () => {
    const store = new ObservableStore({ count: 0, text: "initial" });
    expect(store.getState()).toEqual({ count: 0, text: "initial" });

    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ count: 1 });
    expect(store.getState()).toEqual({ count: 1, text: "initial" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      { count: 1, text: "initial" },
      { count: 0, text: "initial" }
    );

    store.setState((prev) => ({ text: prev.text + " updated" }));
    expect(store.getState()).toEqual({ count: 1, text: "initial updated" });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
