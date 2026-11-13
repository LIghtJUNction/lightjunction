# Official age format vectors

These ten files are unmodified vectors from
[C2SP/CCTV](https://github.com/C2SP/CCTV/tree/b88c4b206254ac543df240097e0f1fcc6a664821/age/testdata),
revision `b88c4b206254ac543df240097e0f1fcc6a664821`.
They are used under the upstream CC0-1.0 license option; see the
[upstream license declaration](https://github.com/C2SP/CCTV/blob/b88c4b206254ac543df240097e0f1fcc6a664821/age/README.md#license).

The embedded identities and file keys are public test constants. The vectors
check the maintained age format implementation against empty, full-size and
multi-chunk payloads, malformed header authentication, missing nonces, missing
final chunks, and invalid empty final chunks. Separate software-PIV tests
decrypt this project's browser output with the reference age CLI and Node/OpenSSL
key unwrapping; they do not require a hardware token.
