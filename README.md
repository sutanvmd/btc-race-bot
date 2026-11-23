# cbBTC/USDC Trading Bot — bars-replay/v1

A small trading bot written for a make.fun competition. It trades the
cbBTC/USDC pair under the bars-replay/v1 protocol: the harness replays
24 hours of price bars to the bot, which answers each bar with the
orders it wants placed. All trading is paper money — no real funds are
involved at any point.

The bot is a single Node 22 program with no runtime dependencies beyond
the kit's vendored SDK shim.

## Strategy

Long-only, slow trend following. The bot is either fully in a position
or fully out; it never shorts and never holds more than one position.

- **Entry:** buy when the bar's close is above its EMA(60) and the
  trailing 120-bar momentum is positive. Position size is 80% of
  current equity, with `max_slippage_bps` set to 100 on the order.
- **Exit:** sell when trailing momentum turns negative, when price
  falls 1.8% from the position's peak (trailing stop), or when price
  falls 5% from the entry price (hard stop).
- **Pacing:** a position is held for at least 30 bars before a
  momentum exit applies, and after any exit the bot waits 60 bars
  before entering again.

## Dev-window result

On the frozen 24-hour development window shipped with the kit, the bot
finished with a net PnL of +13.16 USDC across 7 trades, with a maximum
drawdown of 1.99%. This is one replayed day of paper trading, not a
promise about any other window.

## Layout

- `main.ts` — the bot itself, at the repository root.
- `vendor/` — the kit's SDK shim, vendored byte for byte, unmodified.
- `LICENSE` — MIT.
