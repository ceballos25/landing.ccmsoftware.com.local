export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void}
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrap = (payload) => {
      this.off(event, wrap);
      handler(payload);
    };
    return this.on(event, wrap);
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * @param {string} event
   * @param {unknown} [payload]
   */
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler error on ${event}`, err);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}
