"""Regression tests for the real-backend gate's GnuPG diagnostic compatibility."""

import unittest

from check_crypto import check_gpg_listing

RECIPIENT = b":pubkey enc packet: version 3, algo 18, keyid E78F1DC59509F8E9\n"
MDC = b":encrypted data packet:\n\tlength: unknown\n\tmdc_method: 2\n"
AEAD = b":aead encrypted packet: cipher=9 aead=2 cb=21\n\tlength: unknown\n"


class GpgListingTests(unittest.TestCase):
    def test_accepts_integrity_protected_encryption(self) -> None:
        check_gpg_listing(0, RECIPIENT + MDC, b"")

    def test_accepts_gnupg_draft_aead_encryption(self) -> None:
        check_gpg_listing(0, RECIPIENT + AEAD, b"")

    def test_accepts_native_windows_line_endings(self) -> None:
        check_gpg_listing(0, (RECIPIENT + AEAD).replace(b"\n", b"\r\n"), b"")

    def test_rejects_plaintext_and_incomplete_payload_headers(self) -> None:
        for payload in (
            b"",
            b":literal data packet:\n\tmode b (62), created 0, name=\"\"\n",
            b"plaintext containing :encrypted data packet:\n",
            b":aead encrypted packet:\n",
            b":aead encrypted packet: cipher=9 aead=2 cb=\n",
        ):
            with self.subTest(payload=payload), self.assertRaisesRegex(RuntimeError, "payload"):
                check_gpg_listing(0, RECIPIENT + payload, b"")

    def test_rejects_multiple_encrypted_payloads(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "exactly one"):
            check_gpg_listing(0, RECIPIENT + MDC + AEAD, b"")

    def test_rejects_wrong_missing_and_extra_recipients(self) -> None:
        for recipients in (
            b"",
            RECIPIENT.replace(b"E78F1DC59509F8E9", b"0000000000000000"),
            RECIPIENT + RECIPIENT,
        ):
            with self.subTest(recipients=recipients), self.assertRaisesRegex(RuntimeError, "recipient"):
                check_gpg_listing(0, recipients + AEAD, b"")

    def test_rejects_added_symmetric_recipient(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "symmetric recipient"):
            check_gpg_listing(0, RECIPIENT + b":symkey enc packet: version 4\n" + AEAD, b"")

    def test_rejects_failed_inspection_even_with_recognized_packets(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "truncated packet"):
            check_gpg_listing(2, RECIPIENT + AEAD, b"gpg: truncated packet")

    def test_failure_diagnostics_include_bounded_stdout_and_stderr(self) -> None:
        with self.assertRaises(RuntimeError) as failure:
            check_gpg_listing(2, b"packet-details " + b"x" * 10000, b"parse-error " + b"y" * 10000)
        message = str(failure.exception)
        self.assertIn("GPG stdout: packet-details", message)
        self.assertIn("GPG stderr: parse-error", message)
        self.assertLess(len(message), 3200)


if __name__ == "__main__":
    unittest.main()
