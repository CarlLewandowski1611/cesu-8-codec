/**
 * CESU-8 codec.
 *
 * CESU-8 is a compatibility encoding that preserves the UTF-8 byte
 * representation of characters in the Basic Multilingual Plane (BMP), but
 * encodes supplementary characters (U+10000..U+10FFFF) as two three-byte
 * sequences, each representing a UTF-16 surrogate half. This matches the
 * Modified UTF-8 used by Java's DataInput/DataOutput and Oracle's database
 * drivers.
 *
 * This implementation accepts and produces standard JavaScript strings
 * containing UTF-16 code units. When decoding, malformed surrogate pairs
 * are replaced with U+FFFD rather than throwing.
 */

const INVALID_BYTE = 0xfd;
const REPLACEMENT_CHARACTER = '\ufffd';

/**
 * Encode a JavaScript string to a Uint8Array using CESU-8.
 *
 * Supplementary characters outside the BMP are split into their UTF-16
 * surrogate halves before encoding, so the resulting bytes differ from
 * standard UTF-8 only for those code points.
 *
 * @param {string} input string to encode
 * @returns {Uint8Array} CESU-8 encoded bytes
 */
export function encode(input) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }

  const bytes = [];

  for (let i = 0; i < input.length; i++) {
    const codeUnit = input.charCodeAt(i);

    if (codeUnit < 0x80) {
      bytes.push(codeUnit);
    } else if (codeUnit < 0x800) {
      bytes.push(0xc0 | (codeUnit >> 6));
      bytes.push(0x80 | (codeUnit & 0x3f));
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      // High surrogate. If followed by a low surrogate, encode the pair as
      // two three-byte sequences. Otherwise encode the high surrogate alone,
      // which is technically invalid Unicode but is what Java's modified
      // UTF-8 does with unpaired surrogates.
      const next = i + 1 < input.length ? input.charCodeAt(i + 1) : -1;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        bytes.push(0xe0 | (codeUnit >> 12));
        bytes.push(0x80 | ((codeUnit >> 6) & 0x3f));
        bytes.push(0x80 | (codeUnit & 0x3f));
        bytes.push(0xe0 | (next >> 12));
        bytes.push(0x80 | ((next >> 6) & 0x3f));
        bytes.push(0x80 | (next & 0x3f));
      } else {
        bytes.push(0xe0 | (codeUnit >> 12));
        bytes.push(0x80 | ((codeUnit >> 6) & 0x3f));
        bytes.push(0x80 | (codeUnit & 0x3f));
      }
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      // Unpaired low surrogate; encode it alone.
      bytes.push(0xe0 | (codeUnit >> 12));
      bytes.push(0x80 | ((codeUnit >> 6) & 0x3f));
      bytes.push(0x80 | (codeUnit & 0x3f));
    } else {
      bytes.push(0xe0 | (codeUnit >> 12));
      bytes.push(0x80 | ((codeUnit >> 6) & 0x3f));
      bytes.push(0x80 | (codeUnit & 0x3f));
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Decode CESU-8 bytes into a JavaScript string.
 *
 * Malformed sequences are replaced with U+FFFD. Surrogate pairs encoded as
 * two three-byte sequences are recombined into a supplementary character
 * represented by a UTF-16 surrogate pair. Unpaired surrogates are returned
 * as individual code units.
 *
 * @param {Uint8Array} input CESU-8 encoded bytes
 * @returns {string} decoded string
 */
export function decode(input) {
  if (!(input instanceof Uint8Array)) {
    throw new TypeError('input must be a Uint8Array');
  }

  const result = [];
  let i = 0;

  while (i < input.length) {
    const byte0 = input[i];

    if (byte0 < 0x80) {
      result.push(String.fromCharCode(byte0));
      i++;
      continue;
    }

    if (byte0 >= 0xc0 && byte0 <= 0xdf) {
      if (i + 1 >= input.length) {
        result.push(REPLACEMENT_CHARACTER);
        i++;
        continue;
      }
      const byte1 = input[i + 1];
      if ((byte1 & 0xc0) !== 0x80) {
        result.push(REPLACEMENT_CHARACTER);
        i++;
        continue;
      }
      const codePoint = ((byte0 & 0x1f) << 6) | (byte1 & 0x3f);
      result.push(String.fromCharCode(codePoint));
      i += 2;
      continue;
    }

    if (byte0 >= 0xe0 && byte0 <= 0xef) {
      if (i + 2 >= input.length) {
        result.push(REPLACEMENT_CHARACTER);
        i++;
        continue;
      }
      const byte1 = input[i + 1];
      const byte2 = input[i + 2];
      if ((byte1 & 0xc0) !== 0x80 || (byte2 & 0xc0) !== 0x80) {
        result.push(REPLACEMENT_CHARACTER);
        i++;
        continue;
      }

      const codeUnit = ((byte0 & 0x0f) << 12) | ((byte1 & 0x3f) << 6) | (byte2 & 0x3f);

      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && i + 5 < input.length) {
        const byte3 = input[i + 3];
        const byte4 = input[i + 4];
        const byte5 = input[i + 5];
        if (
          byte3 >= 0xe0 &&
          byte3 <= 0xef &&
          (byte4 & 0xc0) === 0x80 &&
          (byte5 & 0xc0) === 0x80
        ) {
          const lowSurrogate = ((byte3 & 0x0f) << 12) | ((byte4 & 0x3f) << 6) | (byte5 & 0x3f);
          if (lowSurrogate >= 0xdc00 && lowSurrogate <= 0xdfff) {
            result.push(String.fromCharCode(codeUnit, lowSurrogate));
            i += 6;
            continue;
          }
        }
      }

      result.push(String.fromCharCode(codeUnit));
      i += 3;
      continue;
    }

    // Invalid leading byte or overlong encoding.
    result.push(REPLACEMENT_CHARACTER);
    i++;
  }

  return result.join('');
}

/**
 * Convenience wrapper that encodes a string and returns a hex string.
 *
 * @param {string} input string to encode
 * @returns {string} space-separated uppercase hex byte values
 */
export function encodeString(input) {
  const bytes = encode(input);
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

/**
 * Convenience wrapper that decodes a Uint8Array of CESU-8 bytes.
 *
 * @param {Uint8Array} input CESU-8 encoded bytes
 * @returns {string} decoded string
 */
export function decodeString(input) {
  return decode(input);
}
