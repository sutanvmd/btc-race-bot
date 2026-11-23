# cbBTC/USDC Trading Bot (bars-replay/v1)

This repository holds a small automated trader built for a make.fun
competition. It operates on the cbBTC/USDC pair through the
bars-replay/v1 protocol: the harness feeds the bot a 24-hour sequence
of price bars, and after each bar the bot replies with the orders it
wants placed. Everything runs on paper money — no real funds move at
any point.

![make.fun bounty](https://make.fun/badge/btc-race-24h-20261123-0511.svg)
![rank](https://make.fun/badge/btc-race-24h-20261123-0511/sutanvmd/btc-race-bot/rank.svg)
![reward](https://make.fun/badge/btc-race-24h-20261123-0511/sutanvmd/btc-race-bot/reward.svg)

Bounty: [Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261123-0511)

The bot is one Node 22 program. It has no runtime dependencies apart
from the kit's SDK shim, which is vendored into the repo unchanged.

## How it trades

The strategy is long-only and follows slow trends. At any moment the
bot is either holding a single position or sitting out entirely; it
never shorts and never stacks positions.

- **Getting in:** a buy triggers when the bar closes above its
  EMA(60) while momentum over the trailing 120 bars is positive. The
  order is sized at 80% of current equity and carries a
  `max_slippage_bps` of 100.
- **Getting out:** the position is sold if trailing momentum flips
  negative, if price retraces 1.8% from its highest point since entry
  (a trailing stop), or if price drops 5% below the entry price (a
  hard stop).
- **Pacing:** momentum-based exits only apply after a position has
  been held for at least 30 bars, and once any exit happens the bot
  stays out for a 60-bar cooldown before it may enter again.

## Result on the development window

Replayed over the frozen 24-hour development window that ships with
the kit, the bot closed with a net PnL of +13.16 USDC over 7 trades
and a maximum drawdown of 1.99%. That is a single replayed day of
paper trading, not a forecast for other windows.

## Repository layout

- `main.ts` — the bot itself, at the repository root.
- `vendor/` — the kit SDK shim, vendored byte for byte, unmodified.
- `LICENSE` — MIT.
