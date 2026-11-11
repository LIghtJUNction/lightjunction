# Changelog

## 0.2.2

- Fix automatic latest-release detection when GitHub returns compact JSON.

## 0.2.1

- Add release archives for Linux, macOS, and Windows on x86_64 and ARM64; Linux binaries target musl.
- Add shell and PowerShell installers with platform detection, SHA-256 verification, version selection, and custom install directories.
- Install binaries without Rust or administrator privileges, while leaving shell profiles and persistent `PATH` settings unchanged.
- Document manual downloads, checksum verification, signing status, and binary-only removal.

## 0.2.0

- Add `keys [age|gpg|ssh]` to inspect bundled public-key snapshots or export raw key material, with JSON support.
- Add `encrypt age|gpg` for streaming file or standard-input encryption through locally installed age or GnuPG tools.
- Support armored ciphertext, terminal I/O checks, and staged output files that never replace an existing destination.
- Isolate GPG from the default keyring and configuration, disable automatic key retrieval and agent startup, and preserve command timings on standard error.
- Document public-key provenance, encryption dependencies, file and pipeline examples, and the distinction between historical profile benchmarks and encryption timings.

## 0.1.1

- Keep every engineering question reachable on clocks with coarse timestamp precision.

## 0.1.0

- Introduce a Rust terminal profile built with `zclap 0.1.4`.
- Add an interactive menu, a guided tour, direct commands, project introductions, public links, and original engineering prompts.
- Support English and Chinese, locale detection, plain text, JSON, and scripted menu input.
- Report command timings by default and summarize interactive session work and input wait times separately.
- Add Linux, macOS, and Windows CI, crate packaging checks, and a crates.io release workflow using `CARGO_REGISTRY_TOKEN` with version bump controls.
