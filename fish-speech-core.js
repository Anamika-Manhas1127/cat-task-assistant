"use strict";

const { EMOTION_DELIVERY, cleanSpokenText } = require("./speech-emotion");

const FISH_AUDIO_API_URL = "https://api.fish.audio/v1/tts";
const DEFAULT_MODEL = "s2.1-pro-free";
// Hello Kitty Sanrio - verified high-pitched cute cartoon cat voice speaking clear English
const DEFAULT_CARTOON_CAT_VOICE_ID = "978e95d6f81c41c48338676a515cc617";

function redactSensitiveText(value, apiKey = "") {
  if (typeof value !== "string") return "";
  let text = value.slice(0, 1000);
  if (apiKey) text = text.split(apiKey).join("[redacted]");
  return text
    .replace(/(?:Bearer\s+)[A-Za-z0-9_.-]{16,}/gi, "Bearer [redacted]")
    .replace(/(?:AIza|AQ\.)[A-Za-z0-9_.-]{20,}/g, "[redacted]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[a-f0-9]{32}/gi, "[redacted]");
}

function fishErrorMessage(status, providerError, apiKey = "") {
  const rawMessage = typeof providerError?.message === "string"
    ? providerError.message
    : typeof providerError?.error === "string"
      ? providerError.error
      : typeof providerError?.detail === "string"
        ? providerError.detail
        : "";
  const detail = redactSensitiveText(rawMessage, apiKey);

  if (status === 401 || status === 403) {
    return "Fish Audio rejected the API key (HTTP 401). Check your FISH_AUDIO_API_KEY in .env.";
  }
  if (status === 429) {
    return "Fish Audio rate limit or credit quota exceeded (HTTP 429). Please try again in a moment.";
  }
  if (status === 400) {
    return detail
      ? `Fish Audio request was invalid (HTTP 400): ${detail}`
      : "Fish Audio request was invalid (HTTP 400). Check the text and parameters.";
  }
  if (status >= 500) {
    return detail
      ? `Fish Audio server error (HTTP ${status}): ${detail}`
      : `Fish Audio server error (HTTP ${status}). Please try again later.`;
  }
  return detail
    ? `Fish Audio request failed (HTTP ${status}): ${detail}`
    : `Fish Audio request failed (HTTP ${status}).`;
}

function buildFishTtsRequest({
  text,
  emotion = "neutral",
  speed,
  voiceId = DEFAULT_CARTOON_CAT_VOICE_ID,
  model = DEFAULT_MODEL,
  format = "mp3",
  latency = "balanced",
  apiKey = ""
}) {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string.");
  }
  const delivery = EMOTION_DELIVERY[emotion] || EMOTION_DELIVERY.neutral;
  let formattedText = cleanSpokenText(text);

  // Prepend expressive Fish Audio emotion tag if configured and not already present
  if (delivery.fishTag && !formattedText.startsWith("[")) {
    formattedText = `${delivery.fishTag} ${formattedText}`;
  }

  const payload = {
    text: formattedText,
    format: format || "mp3",
    latency: latency || "balanced"
  };

  const selectedVoice = (voiceId && typeof voiceId === "string" && voiceId.trim())
    ? voiceId.trim()
    : DEFAULT_CARTOON_CAT_VOICE_ID;
  if (selectedVoice) {
    payload.reference_id = selectedVoice;
  }

  const speedVal = typeof speed === "number" ? speed : delivery.speed;
  if (typeof speedVal === "number" && speedVal > 0) {
    payload.prosody = { speed: Number(speedVal.toFixed(2)) };
  }

  return {
    url: FISH_AUDIO_API_URL,
    options: {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "model": model || DEFAULT_MODEL
      },
      body: JSON.stringify(payload)
    }
  };
}

async function synthesizeWithFishAudio({
  text,
  emotion,
  speed,
  pitch,
  apiKey = process.env.FISH_AUDIO_API_KEY,
  voiceId = process.env.FISH_AUDIO_VOICE_ID || DEFAULT_CARTOON_CAT_VOICE_ID,
  model = process.env.FISH_AUDIO_MODEL || DEFAULT_MODEL,
  format = "mp3",
  latency = "balanced",
  fetchFn = globalThis.fetch
} = {}) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim() || apiKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE")) {
    return {
      ok: false,
      error: "Fish Audio API key is not configured. Add FISH_AUDIO_API_KEY to .env.",
      fallback: true
    };
  }

  const spokenText = cleanSpokenText(text);
  if (!spokenText) {
    return {
      ok: false,
      error: "No spoken text provided for speech synthesis.",
      fallback: true
    };
  }

  try {
    const request = buildFishTtsRequest({
      text: spokenText,
      emotion,
      speed,
      voiceId,
      model,
      format,
      latency,
      apiKey: apiKey.trim()
    });

    const response = await fetchFn(request.url, {
      ...request.options,
      signal: AbortSignal.timeout(15_000)
    });

    if (response.status === 200) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        return {
          ok: false,
          error: "Fish Audio returned empty audio data.",
          fallback: true
        };
      }
      return {
        ok: true,
        audioBuffer: buffer,
        format: format || "mp3",
        mimeType: format === "wav" ? "audio/wav" : "audio/mpeg"
      };
    }

    let errorData = null;
    try {
      errorData = await response.json();
    } catch (_) {
      try { errorData = { message: await response.text() }; } catch (_) {}
    }

    const message = fishErrorMessage(response.status, errorData, apiKey);
    return {
      ok: false,
      status: response.status,
      error: message,
      fallback: true
    };
  } catch (error) {
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const detail = redactSensitiveText(error?.message || "Network error", apiKey);
    const message = isTimeout
      ? "Fish Audio request timed out after 15 seconds."
      : `Fish Audio network request failed: ${detail}`;
    return {
      ok: false,
      error: message,
      fallback: true
    };
  }
}

async function streamFishAudio({
  text,
  emotion,
  speed,
  pitch,
  apiKey = process.env.FISH_AUDIO_API_KEY,
  voiceId = process.env.FISH_AUDIO_VOICE_ID || DEFAULT_CARTOON_CAT_VOICE_ID,
  model = process.env.FISH_AUDIO_MODEL || DEFAULT_MODEL,
  format = "wav",
  latency = "balanced",
  fetchFn = globalThis.fetch,
  signal,
  onChunk
} = {}) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim() || apiKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE")) {
    return {
      ok: false,
      error: "Fish Audio API key is not configured. Add FISH_AUDIO_API_KEY to .env.",
      fallback: true
    };
  }

  const spokenText = cleanSpokenText(text);
  if (!spokenText) {
    return {
      ok: false,
      error: "No spoken text provided for speech synthesis.",
      fallback: true
    };
  }

  const startTime = Date.now();
  console.info(`[Voice] [Timing] Fish Audio API request started for "${spokenText.slice(0, 30)}..." at t=0ms`);

  try {
    const request = buildFishTtsRequest({
      text: spokenText,
      emotion,
      speed,
      voiceId,
      model,
      format,
      latency,
      apiKey: apiKey.trim()
    });

    const timeoutSignal = AbortSignal.timeout(12_000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    const response = await fetchFn(request.url, {
      ...request.options,
      signal: combinedSignal
    });

    if (response.status !== 200) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (_) {
        try { errorData = { message: await response.text() }; } catch (_) {}
      }
      const message = fishErrorMessage(response.status, errorData, apiKey);
      return {
        ok: false,
        status: response.status,
        error: message,
        fallback: true
      };
    }

    const contentType = response?.headers && typeof response.headers.get === "function" ? response.headers.get("content-type") : "audio/wav";
    console.info(`[Voice] [Diagnostics] Fish Audio HTTP ${response.status} (${contentType}); format: ${format}, model: ${model}, voice: ${voiceId || "default"}`);

    let isFirst = true;
    let headerBuffer = Buffer.alloc(0);
    let headerParsed = false;
    let sampleRate = 44100;
    let totalBytes = 0;
    let pendingByte = null;

    const processRawChunk = (rawChunk) => {
      let uint8 = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk.buffer, rawChunk.byteOffset, rawChunk.byteLength);

      if (format === "wav" && !headerParsed) {
        headerBuffer = Buffer.concat([headerBuffer, uint8]);
        if (headerBuffer.length < 44) return;
        if (headerBuffer.subarray(0, 4).toString() === "RIFF") {
          sampleRate = headerBuffer.readUInt32LE(24) || 44100;
        }
        uint8 = headerBuffer.subarray(44);
        headerParsed = true;
      }

      if (pendingByte !== null) {
        uint8 = Buffer.concat([Buffer.from([pendingByte]), uint8]);
        pendingByte = null;
      }

      if (format === "wav" && uint8.length % 2 !== 0) {
        pendingByte = uint8[uint8.length - 1];
        uint8 = uint8.subarray(0, uint8.length - 1);
      }

      if (uint8.length === 0) return;

      if (isFirst) {
        const elapsed = Date.now() - startTime;
        console.info(`[Voice] [Timing] First audio chunk received (+${elapsed}ms, ${uint8.length} bytes, format: ${format})`);
      }

      totalBytes += uint8.length;
      if (typeof onChunk === "function") {
        onChunk({
          chunk: uint8,
          isFirst,
          sampleRate,
          mimeType: format === "wav" ? "audio/wav" : "audio/mpeg"
        });
      }
      isFirst = false;
    };

    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) processRawChunk(value);
      }
    } else if (response.body && typeof response.body[Symbol.asyncIterator] === "function") {
      for await (const value of response.body) {
        if (value && value.length > 0) processRawChunk(value);
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
      if (buffer.length > 0) processRawChunk(buffer);
    }

    if (pendingByte !== null) {
      const finalChunk = Buffer.from([pendingByte, 0]);
      pendingByte = null;
      totalBytes += 2;
      if (typeof onChunk === "function") {
        onChunk({
          chunk: finalChunk,
          isFirst: false,
          sampleRate,
          mimeType: format === "wav" ? "audio/wav" : "audio/mpeg"
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.info(`[Voice] [Timing] Synthesis stream completed (+${totalTime}ms, total ${totalBytes} bytes)`);
    if (typeof onChunk === "function") {
      onChunk({ isDone: true, totalBytes, totalTime, sampleRate });
    }

    return { ok: true, totalBytes, totalTime, sampleRate };
  } catch (error) {
    const isTimeout = error?.name === "TimeoutError";
    const isAbort = error?.name === "AbortError";
    if (isAbort) {
      return { ok: false, aborted: true };
    }
    const detail = redactSensitiveText(error?.message || "Network error", apiKey);
    const message = isTimeout
      ? "Fish Audio request timed out after 12 seconds."
      : `Fish Audio network request failed: ${detail}`;
    return {
      ok: false,
      error: message,
      fallback: true
    };
  }
}

module.exports = {
  FISH_AUDIO_API_URL,
  DEFAULT_MODEL,
  DEFAULT_CARTOON_CAT_VOICE_ID,
  redactSensitiveText,
  fishErrorMessage,
  buildFishTtsRequest,
  synthesizeWithFishAudio,
  streamFishAudio
};
