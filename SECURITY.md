# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public issue.
Instead, contact me via:

- **Email**: lightjunction.me@gmail.com
- **GPG Key**: `EB21B83AB1E982DF66F08387A67178405F7736FD`

Please include as much detail as possible. I aim to respond within 48 hours.

Do not send private keys, seed phrases, passwords, access tokens, or other
credentials. If a report requires sensitive proof, describe the minimum context
needed first and we can agree on a safer handoff.

## `curl | bash` Install Scripts

Piping a script to Bash executes it immediately; it does not pause for review.
For a reviewable install, download the entrypoint, inspect it, and then run the
saved file:

```bash
curl -fsSLo bootstrap.sh https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh
less bootstrap.sh
bash bootstrap.sh
```

Bootstrap entrypoints pin and verify their downloaded helper libraries. Native
daed packages are accepted only when the direct official GitHub release API
provides a valid SHA256 digest, even if a mirror supplies the package bytes.
Non-interactive Linux runs install no optional features unless
`BOOTSTRAP_FEATURES` explicitly names them. Arch-family runs also refuse to add
third-party package repositories automatically; configure a supported official
repository yourself before requesting packages that require it.
