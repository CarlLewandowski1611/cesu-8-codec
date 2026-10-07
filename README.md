# CESU-8 Codec

Encodes and decodes CESU-8, the modified UTF-8 variant used by Java and Oracle for supplementary characters.

```javascript
import { encode, decode } from './src/index.js';

const bytes = encode('Hello \u{1F600}');
console.log(bytes); // Uint8Array with CESU-8 bytes

const text = decode(bytes);
console.log(text); // 'Hello 😀'
```

## Why this library exists

Standard UTF-8 encodes a supplementary character like U+1F600 as a four-byte sequence. CESU-8 instead encodes the character's UTF-16 surrogate pair as two separate three-byte sequences. This produces output that is compatible with Java's `DataOutputStream.writeUTF` and Oracle's database character set conversion, both of which use the same surrogate-pair encoding. The trade-off is that CESU-8 is not valid UTF-8: the surrogate code points are not legal Unicode scalar values. This library exists to bridge code that must talk to those systems without pulling in a larger encoding package.

## Edge cases

Malformed input is replaced with U+FFFD rather than throwing. Unpaired surrogates in JavaScript strings are encoded as standalone three-byte sequences, matching Java's behavior for lone surrogates. When decoding, a high surrogate followed by a valid CESU-8 low surrogate is recombined into a supplementary character; otherwise each surrogate is emitted separately.

## API

The module exports four functions:

- `encode(input: string): Uint8Array` — encode a string to CESU-8 bytes.
- `decode(input: Uint8Array): string` — decode CESU-8 bytes to a string.
- `encodeString(input: string): string` — encode and return a space-separated uppercase hex string.
- `decodeString(input: Uint8Array): string` — alias for `decode`.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

