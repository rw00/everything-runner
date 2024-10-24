import { debounce } from "../../renderer/debounce";

describe("debounce utility", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should delay execution by the specified wait time", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 120);

    debounced("first");
    debounced("second");
    debounced("third");

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(119);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });

  test("should allow cancelling pending debounced call", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 120);

    debounced("call");
    debounced.cancel();

    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  test("should allow flushing pending debounced call immediately", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 120);

    debounced("immediate");
    debounced.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("immediate");

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
