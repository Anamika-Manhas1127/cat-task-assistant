"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SARVAM_SUPPORTED_LANGUAGES,
  getAudioExtension,
  redactSensitiveText,
  sarvamErrorMessage,
  extractSarvamTranscript,
  buildSarvamFormData,
  transcribeWithSarvam
} = require("../sarvam-core");

test("maps supported languages and identifies extensions correctly", () => {
  assert.equal(SARVAM_SUPPORTED_LANGUAGES.en, "en-IN");
  assert.equal(SARVAM_SUPPORTED_LANGUAGES.hi, "hi-IN");
  assert.equal(SARVAM_SUPPORTED_LANGUAGES.kn, "kn-IN");
  assert.equal(SARVAM_SUPPORTED_LANGUAGES.ja, undefined);

  assert.equal(getAudioExtension("audio/webm;codecs=opus"), "audio.webm");
  assert.equal(getAudioExtension("audio/ogg;codecs=opus"), "audio.ogg");
  assert.equal(getAudioExtension("audio/wav"), "audio.wav");
  assert.equal(getAudioExtension("audio/mp4"), "audio.mp4");
  assert.equal(getAudioExtension(""), "audio.webm");
});

test("redacts sensitive API keys and tokens", () => {
  const secretKey = "sarvam_sec_1234567890abcdef1234567890abcdef";
  const text = `Failed with key ${secretKey} on api-subscription-key: ${secretKey}`;
  const redacted = redactSensitiveText(text, secretKey);
  assert.equal(redacted.includes(secretKey), false);
  assert.match(redacted, /\[redacted\]/);
});

test("builds multipart form data with correct model, language_code, and mode", () => {
  const buffer = Buffer.from("RIFF....WAVEfmt ....data....");
  const formData = buildSarvamFormData({
    audioBuffer: buffer,
    mimeType: "audio/webm",
    languageCode: "en-IN"
  });

  assert.equal(formData.get("model"), "saaras:v4");
  assert.equal(formData.get("mode"), "transcribe");
  assert.equal(formData.get("language_code"), "en-IN");
  const file = formData.get("file");
  assert.ok(file instanceof Blob);
  assert.equal(file.size, buffer.length);
});

test("rejects empty or oversized audio buffers", () => {
  assert.throws(() => buildSarvamFormData({ audioBuffer: Buffer.alloc(0), languageCode: "en-IN" }), /empty/);
  assert.throws(() => buildSarvamFormData({ audioBuffer: null, languageCode: "en-IN" }), /No audio buffer/);
});

test("extracts transcripts and handles missing data", () => {
  assert.equal(extractSarvamTranscript({ transcript: "  I need to drink water  " }), "I need to drink water");
  assert.equal(extractSarvamTranscript({}), "");
  assert.equal(extractSarvamTranscript(null), "");
  assert.equal(extractSarvamTranscript({ transcript: 123 }), "");
});

test("formats user-friendly error messages for HTTP statuses", () => {
  assert.match(sarvamErrorMessage(401, {}), /rejected the API key/);
  assert.match(sarvamErrorMessage(429, {}), /rate limit or quota/);
  assert.match(sarvamErrorMessage(400, { message: "Audio length is 0s" }), /could not process the audio/);
  assert.match(sarvamErrorMessage(500, {}), /server error/);
});

test("transcribeWithSarvam handles success and error cases with mocked fetch", async () => {
  const validBuffer = Buffer.from(new Uint8Array(100)); // 100 bytes

  // 1. Success case
  const mockFetchSuccess = async (url, options) => {
    assert.equal(url, "https://api.sarvam.ai/speech-to-text");
    assert.equal(options.headers["api-subscription-key"], "mock-key");
    return {
      ok: true,
      status: 200,
      json: async () => ({ transcript: "I need to drink water", language_code: "en-IN" })
    };
  };

  const successResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    mimeType: "audio/webm",
    language: "en",
    apiKey: "mock-key",
    fetchFn: mockFetchSuccess
  });
  assert.equal(successResult.ok, true);
  assert.equal(successResult.text, "I need to drink water");
  assert.equal(successResult.languageCode, "en-IN");

  // 2. Missing API key
  const noKeyResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "en",
    apiKey: ""
  });
  assert.equal(noKeyResult.ok, false);
  assert.match(noKeyResult.error, /Sarvam AI is not configured/);

  // 3. Unsupported language
  const unsupportedLang = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "ja",
    apiKey: "mock-key"
  });
  assert.equal(unsupportedLang.ok, false);
  assert.match(unsupportedLang.error, /does not support 'ja'/);

  // 4. Empty transcript returned by API
  const mockFetchEmpty = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ transcript: "   " })
  });
  const emptyResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "en",
    apiKey: "mock-key",
    fetchFn: mockFetchEmpty
  });
  assert.equal(emptyResult.ok, false);
  assert.match(emptyResult.error, /No speech could be recognized/);

  // 5. Invalid API key (401)
  const mockFetch401 = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: "Unauthorized" })
  });
  const invalidKeyResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "en",
    apiKey: "bad-key",
    fetchFn: mockFetch401
  });
  assert.equal(invalidKeyResult.ok, false);
  assert.match(invalidKeyResult.error, /rejected the API key/);

  // 6. Rate limit (429)
  const mockFetch429 = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: "Too Many Requests" })
  });
  const rateLimitResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "en",
    apiKey: "mock-key",
    fetchFn: mockFetch429
  });
  assert.equal(rateLimitResult.ok, false);
  assert.match(rateLimitResult.error, /rate limit or quota/);

  // 7. Timeout
  const mockFetchTimeout = async () => {
    const err = new Error("The operation was aborted due to timeout");
    err.name = "TimeoutError";
    throw err;
  };
  const timeoutResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "en",
    apiKey: "mock-key",
    fetchFn: mockFetchTimeout
  });
  assert.equal(timeoutResult.ok, false);
  assert.match(timeoutResult.error, /timed out/);

  // 8. Network failure
  const mockFetchNetwork = async () => {
    const err = new TypeError("fetch failed");
    throw err;
  };
  const networkResult = await transcribeWithSarvam({
    audioBuffer: validBuffer,
    language: "en",
    apiKey: "mock-key",
    fetchFn: mockFetchNetwork
  });
  assert.equal(networkResult.ok, false);
  assert.match(networkResult.error, /network request failed/);
});
