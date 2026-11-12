# Public key snapshots

These public keys were checked on **2026-11-11** and are embedded in the CLI. Update them from their public sources when the owner rotates a key.

| File | Public source |
| --- | --- |
| `age-recipients.txt` | [Repository age recipient](https://github.com/LIghtJUNction/lightjunction/blob/18376fd2c29e604173e395b7408ecde8a319b2f4/public/age-recipients.txt) |
| `pubkey.asc` | [Repository OpenPGP public key](https://github.com/LIghtJUNction/lightjunction/blob/18376fd2c29e604173e395b7408ecde8a319b2f4/pubkey.asc) |
| `ssh-public-keys.txt` | [GitHub's public SSH key endpoint](https://github.com/LIghtJUNction.keys) |

## age

The recipient is a YubiKey plugin recipient:

```text
age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n
```

Its Bech32 checksum and compressed P-256 public point were validated. Encryption requires an age client and [`age-plugin-yubikey`](https://github.com/str4d/age-plugin-yubikey) on `PATH`. Encrypting to this public recipient does not require the owner's YubiKey; decryption requires the corresponding identity and hardware.

## OpenPGP / GPG

Primary fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

Encryption subkey fingerprint:

```text
2135EC6E1EC54E54B96CF64DE78F1DC59509F8E9
```

The primary key uses Ed25519; the encryption subkey uses Curve25519. Neither has an expiration field in this snapshot. GnuPG 2.4.7 successfully encrypted a fixed test message using this public key in an isolated keyring; the resulting packet targeted encryption subkey `E78F1DC59509F8E9`. This checks encryption, not possession of the private key or a decryption round trip.

## SSH

The GitHub endpoint returned one `sk-ssh-ed25519@openssh.com` public key. `ssh-keygen` parsed it successfully and reported:

```text
SHA256:NrM5Ls5zD7WOL4q9nreHCr73cf2S1MTchNwi3OBuHCU
```

The CLI outputs this key for inspection or copying. It does not install it into `authorized_keys` or change SSH access.

## Snapshot checksums

SHA-256 of the exact source bytes, including line endings:

```text
ef3dda13332dfa92f3d07171fbd87512dce2a4594835c2e9aa1038a9a2e834c5  age-recipients.txt
139eee87cf79d013d32802d971af660017540381000ec2267444933cf209d494  pubkey.asc
b8ad58a854abeff3809b79a617567a4042ac68da7fbe453772523f058abc2e78  ssh-public-keys.txt
```
