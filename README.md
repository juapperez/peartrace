# PearTrace

I am developing PearTrace to make small replication experiments easier to inspect. The current prototype uses Hypercore 11.40.3 to replicate three synthetic fixtures into a separate read-only core and compare the received bytes with an expected manifest.

## Run

```sh
npm ci
npm test
npm run demo
```

The prototype uses Node.js. The original implementation was tested on Node.js 20.20.2 on macOS arm64; `runtime.json` and `test-results.txt` record the environment and results for this published copy. Dependencies retain their own licenses and are installed separately. The package is marked private to prevent accidental npm publication.

## What works

Three deterministic, synthetic integer-list fixtures are appended to a real Hypercore. A separate reader obtains them through connected in-process streams. PearTrace checks their schema, identifier, byte length and SHA-256 digest against a supplied manifest. Temporary experiment data is removed when the cores close.

Seven tests cover exact replication, deterministic encoding, unexpected contents from a valid writer, rejected schema inputs, a read-only replica, disconnection and reconnection, and persistence after reopening local storage.

## Interpreting results

A successful transport does not establish that the received record was the intended one. The mismatch test deliberately replicates a changed fixture and then compares it with the expected bytes. This is an application-layer diagnostic example, not a flaw in Hypercore.

The expected manifest needs an independently trusted source. A matching hash alone does not prove provenance, factual correctness, privacy or author identity. Replacing both the fixture and expected manifest defeats this comparison.

## Current limits

This is an early local prototype. I have not yet tested remote peers, Hyperswarm, a DHT, the Pear runtime, Bare, mobile devices or NAT traversal. The examples use in-process streams, not a deployed peer-to-peer service. There is no security audit, measured performance advantage or established adoption.

Inputs are restricted to deliberately public synthetic fixtures: at most 32 records, each with at most 64 safe integers. Schema validation is not a personal-data detector. Do not put private records, credentials or secrets into fixtures. The code does not execute fixture contents. The tests cover specific examples and do not certify the security of the underlying stack.

## Next steps

I plan to expand the documented failure cases, add a controlled two-process local demonstration and publish English/Spanish walkthroughs. These are proposed improvements, not completed features. A later Pear/Bare integration and independent review would require additional work.

## License and references

The code and documentation in this repository are MIT licensed; see LICENSE. Copyright 2026 Juan Pablo Pérez Vélez. Third-party dependencies retain their existing licenses.

Hypercore: https://github.com/holepunchto/hypercore

Pears storage and replication documentation: https://docs.pears.com/p2p/how-to/store-and-replicate/replicate-and-persist-with-hypercore/
