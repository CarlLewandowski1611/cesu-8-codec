import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encode, decode, encodeString, decodeString } from '../src/core.js';

function bytesOf(hex) {
  return new Uint8Array(hex.split(' ').map((h) => parseInt(h, 16)));
}

function hexOf(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

test('encode ASCII', () => {
  assert.deepEqual(Array.from(encode('hello')), [0x68, 0x65, 0x6c, 0x6c, 0x6f]);
});

test('encode BMP character below U+0800', () => {
  assert.deepEqual(Array.from(encode('\u00e9')), [0xc3, 0xa9]);
});

test('encode BMP character above U+0800', () => {
  assert.deepEqual(Array.from(encode('\u20ac')), [0xe2, 0x82, 0xac]);
});

test('encode supplementary character as surrogate pair', () => {
  // U+1F600 GRINNING FACE -> UTF-16 D83D DE00
  assert.deepEqual(
    Array.from(encode('\u{1F600}')),
    [0xed, 0xa0, 0xbd, 0xed, 0xb8, 0x80]
  );
});

test('decode ASCII', () => {
  assert.equal(decode(bytesOf('68 65 6c 6c 6f')), 'hello');
});

test('decode two-byte sequence', () => {
  assert.equal(decode(bytesOf('c3 a9')), '\u00e9');
});

test('decode three-byte BMP sequence', () => {
  assert.equal(decode(bytesOf('e2 82 ac')), '\u20ac');
});

test('decode surrogate pair from CESU-8', () => {
  assert.equal(decode(bytesOf('ed a0 bd ed b8 80')), '\u{1F600}');
});

test('decode truncated sequence replaces with U+FFFD', () => {
  assert.equal(decode(bytesOf('e2 82')), '\ufffd\ufffd');
});

test('decode invalid continuation byte replaces with U+FFFD', () => {
  assert.equal(decode(bytesOf('e2 28 a1')), '\ufffd(\ufffd');
});

test('decode invalid leading byte replaces with U+FFFD', () => {
  assert.equal(decode(bytesOf('ff')), '\ufffd');
});

test('encodeString returns uppercase hex', () => {
  assert.equal(encodeString('A'), '41');
});

test('decodeString accepts Uint8Array', () => {
  assert.equal(decodeString(bytesOf('41')), 'A');
});

test('encode rejects non-string', () => {
  assert.throws(() => encode(null), TypeError);
});

test('decode rejects non-Uint8Array', () => {
  assert.throws(() => decode([0x41]), TypeError);
});
