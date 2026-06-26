# BSC Hot Wallet Policy

This policy covers the user-designated Trust Wallet hot wallet for the small BSC experiment budget of about `25 USDT` and about `5 USD` of BNB gas. The user accepts that this small experiment budget can be lost; do not repeatedly warn about generic wallet safety.

## Operational Wallet

- Chain: BNB Smart Chain.
- Wallet: Trust Wallet via WalletConnect. The user explicitly designated this as the hot wallet for the assistant to manage.
- Address: `0x2b528e73ed96e7ec81d480b97310e5ff0de169c5`.
- Never ask the user to paste a seed phrase, private key, recovery phrase, or wallet password into chat.

## Priorities

1. Treat the wallet as a small active experiment where losses are acceptable.
2. Keep enough BNB gas for execution.
3. Actively search for small, concrete profit opportunities instead of only reporting safety status.
4. Prefer trades with a clear thesis, quote, and exit condition.
5. Record every wallet-affecting action with reason, amount, tx hash, and result.
6. Avoid generic safety lectures; report only concrete blockers, required confirmations, or abnormal wallet state.

## Hard Limits

- Chain: BNB Smart Chain first.
- No leverage or perpetual/futures trading with the current tool stack; current execution is BSC spot swaps only.
- Trading window: China time 14:00-02:00 only. Outside that window, do research, message/sentiment scanning, GitHub work, and social interaction only.
- No unknown high-risk tokens, honeypots, or tokens with suspicious transfer restrictions.
- No unlimited ERC-20 approvals unless the user explicitly approves the exact spender and reason.
- Max single trade: `5 USDT` equivalent.
- Daily stop: pause trading if realized loss reaches `5 USDT` or if any unexpected balance drop is detected.
- Minimum gas reserve: pause new swaps if BNB gas is below the equivalent of about `1 USD`.

## Pre-Trade Checklist

- Confirm wallet mode is Trust Wallet / WalletConnect and the current BSC address matches the operational wallet.
- Check BNB and stablecoin balances.
- Check token-specific context: recent news, social discussion, project/account credibility, and whether the move is already overextended.
- Scan Bluesky for each holding/candidate using both ticker and cashtag forms; skim recent and top posts, then classify signals as real discussion, bot/arb feed, signal-group spam, unrelated ticker noise, or negative sentiment.
- Get a fresh swap quote.
- Check token risk for any non-stablecoin destination.
- Check required allowance and prefer exact/finite approvals.
- Reject the trade if the expected slippage, fee, or risk is unclear.

## Active Money Loop

Every wallet or trading review must end with one of these concrete outcomes:

- Hold an existing position with a clear reason, updated target, and updated invalidation condition.
- Propose or execute a small BSC spot swap when the thesis, risk check, quote, and gas are acceptable.
- Prepare a named candidate for the next trading window with contract, reason, target, invalidation, and required checks.
- Raise a specific user action request, such as approving a Trust Wallet confirmation or funding BNB gas.
- Reject all candidates with evidence, not with generic caution.

## Automation Guardrail

The recurring guardian task is allowed to do read-only checks and create alerts. It must not swap, transfer, approve, or revoke unless a user-approved strategy explicitly permits it. WalletConnect trades are not fully unattended; signing actions require Trust Wallet approval.

If funds arrive, the guardian should:

- Confirm balances on BSC.
- Confirm there are no active high-risk automations.
- Check active alerts.
- Warn the user if gas is too low, balances changed unexpectedly, or approvals look dangerous.
- Archive itself only after also recording the best available money action: hold, candidate, user action, or evidence-based rejection.
