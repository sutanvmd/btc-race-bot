// A long-only trend bot for cbBTC against USDC on one-minute bars.
//
// Idea: the pool price moves in short drifts separated by long flat
// stretches, and a round trip costs roughly a quarter of a percent in
// fee, slippage and price impact. So the bot keeps a slow trend state
// instead of chasing every wiggle: it is invested while the close sits
// above its slow EMA and the trailing return over MOM_BARS bars is
// positive, and it steps aside only on a clear reversal. One position
// at a time, a minimum hold, and a cooling-off gap after every exit
// keep the fees from churning the account.
//
// Entry, decided on a bar's close and filled at the next open: the
// close is above the slow EMA and trailing momentum over MOM_BARS bars
// exceeds MOM_MIN. The buy spends SIZE_FRAC of equity.
//
// Exit, the whole position, on the first of: trailing momentum drops
// under MOM_EXIT, the close falls TRAIL_STOP below the highest close
// seen while holding, or the position is worth 5% less than it cost
// (the hard stop, which ignores the minimum hold). All arithmetic is
// float64 + - * / on the bars alone, so two runs over the same bars
// agree byte for byte.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

const SLOW_SPAN = 60;
const MOM_BARS = 120;
const MOM_MIN = 0.0005;
const MOM_EXIT = -0.005;
const SIZE_FRAC = 0.8;
const TRAIL_STOP = 0.018;
const HARD_STOP_PCT = 95;
const MIN_HOLD = 30;
const COOLDOWN = 60;
const MAX_SLIPPAGE_BPS = 100;

/** An exponential moving average seeded with the mean of its first span of closes. */
class Ema {
  readonly span: number;
  #seed: number[] = [];
  value: number | null = null;

  constructor(span: number) {
    this.span = span;
  }

  push(close: number): void {
    if (this.value !== null) {
      this.value += (2 / (this.span + 1)) * (close - this.value);
      return;
    }
    this.#seed.push(close);
    if (this.#seed.length === this.span) {
      this.value = this.#seed.reduce((a, x) => a + x, 0) / this.span;
      this.#seed = [];
    }
  }
}

const slow = new Ema(SLOW_SPAN);
const closes: number[] = [];
let heldSince = -1;
let peakClose = 0;
let lastExitBar = -COOLDOWN - 1;

/** Trailing return over the last MOM_BARS closes, or null until enough bars have closed. */
function momentum(): number | null {
  if (closes.length <= MOM_BARS) return null;
  const now = closes[closes.length - 1]!;
  const then = closes[closes.length - 1 - MOM_BARS]!;
  return now / then - 1;
}

await runBars({
  onBatch(state: BarsState, batch) {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);
    closes.push(close);
    slow.push(close);
    const barIndex = closes.length - 1;
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    const orders: OrderInput[] = [];

    if (held !== undefined) {
      if (heldSince < 0) {
        heldSince = barIndex;
        peakClose = close;
      }
      if (close > peakClose) peakClose = close;
      const value = state.value(SYMBOL, held.qty);
      // Worth at most HARD_STOP_PCT percent of its cost, compared in integers.
      const hardStop = value * 100n <= held.cost * BigInt(HARD_STOP_PCT);
      const heldLongEnough = barIndex - heldSince >= MIN_HOLD;
      const mom = momentum();
      const exit =
        hardStop ||
        (heldLongEnough &&
          ((mom !== null && mom < MOM_EXIT) ||
            close <= peakClose * (1 - TRAIL_STOP)));
      if (exit) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
      return orders;
    }

    if (heldSince >= 0) {
      // The position vanished since the last bar: the exit filled.
      heldSince = -1;
      lastExitBar = barIndex;
    }

    if (barIndex - lastExitBar < COOLDOWN) return orders;
    if (slow.value === null || close <= slow.value) return orders;
    const mom = momentum();
    if (mom === null || mom < MOM_MIN) return orders;

    const byFraction = BigInt(Math.floor(SIZE_FRAC * Number(state.equity)));
    const room = state.weightRoom(SYMBOL);
    let notional = byFraction < room ? byFraction : room;
    if (state.cash < notional) notional = state.cash;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return orders;
    orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
    return orders;
  },
});
