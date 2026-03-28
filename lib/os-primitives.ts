/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mutex: To protect the Global_Score variable and the Pitch resource.
 * Only one thread can hold the lock at a time.
 */
export class Mutex {
  private locked: boolean = false;
  private queue: (() => void)[] = [];

  async lock(): Promise<void> {
    if (this.locked) {
      return new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.locked = true;
  }

  unlock(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Semaphore: The Crease has a capacity of 2.
 * If a third batsman thread tries to enter, it must stay in the WAIT state.
 */
export class Semaphore {
  private count: number;
  private queue: (() => void)[] = [];

  constructor(initialCount: number) {
    this.count = initialCount;
  }

  async wait(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  signal(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.count++;
    }
  }

  getCount(): number {
    return this.count;
  }
}

/**
 * Condition Variable: Use for Fielders.
 * They should only "wake up" if the Batsman thread sets the ball_in_air flag to true.
 */
export class ConditionVariable {
  private waiters: (() => void)[] = [];

  async wait(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  broadcast(): void {
    const currentWaiters = [...this.waiters];
    this.waiters = [];
    currentWaiters.forEach((resolve) => resolve());
  }

  signal(): void {
    const next = this.waiters.shift();
    next?.();
  }
}
