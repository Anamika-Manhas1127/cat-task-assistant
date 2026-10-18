"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MODEL,
  DEFAULT_CARTOON_CAT_VOICE_ID,
  redactSensitiveText,
  fishErrorMessage,
  buildFishTtsRequest,
  synthesizeWithFishAudio,
  streamFishAudio
} = require("../fish-speech-core");

test("redacts sensitive keys and authorization tokens", () => {
  const secretKey = "sk_test_1234567890abcdef1234567890abcdef";
  const masked = redactSensitiveText(`Error with Bearer ${secretKey} on request`, secretKey);
  assert.equal(masked.includes(secretKey), false);
  assert.ok(masked.includes("[redacted]"));
});

test("formats user-friendly error messages for HTTP statuses", () => {
  assert.match(fishErrorMessage(401, { message: "Unauthorized" }), /Check your FISH_AUDIO_API_KEY in \.env/);
  assert.match(fishErrorMessage(429, { message: "Quota exceeded" }), /rate limit or credit quota exceeded/);
  assert.match(fishErrorMessage(400, { message: "Bad voice ID" }), /request was invalid/);
  assert.match(fishErrorMessage(500, { message: "Internal server error" }), /server error/);
});

test("buildFishTtsRequest sets correct url, headers, model, and body", () => {
  const req = buildFishTtsRequest({
    text: "Meow! Hello there!",
    emotion: "excited",
    apiKey: "dummy-key",
    voiceId: DEFAULT_CARTOON_CAT_VOICE_ID,
    model: "s2.1-pro-free"
  });

  assert.equal(req.url, "https://api.fish.audio/v1/tts");
  assert.equal(req.options.method, "POST");
  assert.equal(req.options.headers.Authorization, "Bearer dummy-key");
  assert.equal(req.options.headers.model, "s2.1-pro-free");

  const body = JSON.parse(req.options.body);
  assert.equal(body.reference_id, DEFAULT_CARTOON_CAT_VOICE_ID);
  assert.equal(body.format, "mp3");
  assert.ok(body.text.includes("Hello there!"));
});

test("synthesizeWithFishAudio handles successful synthesis with mock fetch", async () => {
  const mockFetch = async () => ({
    status: 200,
    arrayBuffer: async () => Buffer.from("RIFF1234WAVE")
  });

  const res = await synthesizeWithFishAudio({
    text: "Hello!",
    apiKey: "valid-key",
    fetchFn: mockFetch
  });

  assert.equal(res.ok, true);
  assert.ok(res.audioBuffer);
  assert.equal(res.audioBuffer.length, 12);
  assert.equal(res.format, "mp3");
});

test("synthesizeWithFishAudio handles API errors and flags fallback", async () => {
  const mockFetch = async () => ({
    status: 401,
    json: async () => ({ detail: "Invalid API key" })
  });

  const res = await synthesizeWithFishAudio({
    text: "Hello!",
    apiKey: "bad-key",
    fetchFn: mockFetch
  });

  assert.equal(res.ok, false);
  assert.equal(res.fallback, true);
  assert.match(res.error, /HTTP 401/);
});

test("streamFishAudio streams audio chunks and parses WAV header", async () => {
  // Build a dummy 44-byte WAV header + 10 bytes PCM
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(100, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // subchunk1size
  wavHeader.writeUInt16LE(1, 20); // audio format (PCM)
  wavHeader.writeUInt16LE(1, 22); // num channels (1)
  wavHeader.writeUInt32LE(44100, 24); // sample rate
  wavHeader.writeUInt32LE(88200, 28); // byte rate
  wavHeader.writeUInt16LE(2, 32); // block align
  wavHeader.writeUInt16LE(16, 34); // bits per sample
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(10, 40);

  const pcm1 = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const chunk1 = Buffer.concat([wavHeader, pcm1]);
  const chunk2 = Buffer.from([11, 12, 13, 14, 15, 16]);

  const receivedChunks = [];
  const mockFetch = async () => ({
    status: 200,
    body: (async function* () {
      yield chunk1;
      yield chunk2;
    })()
  });

  const res = await streamFishAudio({
    text: "Stream test meow",
    apiKey: "test-api-key",
    format: "wav",
    fetchFn: mockFetch,
    onChunk: (chunkData) => {
      receivedChunks.push(chunkData);
    }
  });

  assert.equal(res.ok, true);
  assert.equal(res.sampleRate, 44100);
  assert.equal(receivedChunks.length, 3); // 2 data chunks + 1 isDone

  // Chunk 1 should have had 44-byte WAV header stripped:
  assert.equal(receivedChunks[0].isFirst, true);
  assert.equal(receivedChunks[0].sampleRate, 44100);
  assert.equal(receivedChunks[0].chunk.length, 10);
  assert.deepEqual(Array.from(receivedChunks[0].chunk), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Chunk 2:
  assert.equal(receivedChunks[1].isFirst, false);
  assert.equal(receivedChunks[1].chunk.length, 6);

  // Completion chunk:
  assert.equal(receivedChunks[2].isDone, true);
  assert.equal(receivedChunks[2].totalBytes, 16);
});

test("streamFishAudio handles API errors with fallback flag", async () => {
  const mockFetch = async () => ({
    status: 429,
    json: async () => ({ detail: "Too Many Requests" })
  });

  const res = await streamFishAudio({
    text: "Hello error",
    apiKey: "test-api-key",
    fetchFn: mockFetch
  });

  assert.equal(res.ok, false);
  assert.equal(res.fallback, true);
  assert.match(res.error, /HTTP 429/);
});

test("streamFishAudio handles AbortSignal cancellation", async () => {
  const controller = new AbortController();
  controller.abort();

  const mockFetch = async (url, opts) => {
    if (opts.signal?.aborted) {
      const err = new Error("This operation was aborted");
      err.name = "AbortError";
      throw err;
    }
    return { status: 200, body: (async function* () {})() };
  };

  const res = await streamFishAudio({
    text: "Aborted request",
    apiKey: "test-api-key",
    signal: controller.signal,
    fetchFn: mockFetch
  });

  assert.equal(res.ok, false);
  assert.equal(res.aborted, true);
});

