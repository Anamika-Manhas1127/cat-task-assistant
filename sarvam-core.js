"use strict";

const SARVAM_SUPPORTED_LANGUAGES = Object.freeze({
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN"
});

function getAudioExtension(mimeType) {
  if (typeof mimeType !== "string") return "audio.webm";
  const lower = mimeType.toLowerCase();
  if (lower.includes("webm")) return "audio.webm";
  if (lower.includes("ogg")) return "audio.ogg";
  if (lower.includes("wav")) return "audio.wav";
  if (lower.includes("mp4") || lower.includes("m4a")) return "audio.mp4";
  if (lower.includes("mp3") || lower.includes("mpeg")) return "audio.mp3";
  if (lower.includes("flac")) return "audio.flac";
  return "audio.webm";
}

function redactSensitiveText(value, apiKey = "") {
  if (typeof value !== "string") return "";
  let text = value.slice(0, 1000);
  if (apiKey) text = text.split(apiKey).join("[redacted]");
  return text
    .replace(/(?:AIza|AQ\.)[A-Za-z0-9_.-]{20,}/g, "[redacted]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(?:api-subscription-key|x-goog-api-key)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/[a-f0-9]{32}/gi, "[redacted]");
}

function sarvamErrorMessage(status, providerError, apiKey = "") {
  const rawMessage = typeof providerError?.message === "string"
    ? providerError.message
    : typeof providerError?.error === "string"
      ? providerError.error
      : typeof providerError?.detail === "string"
        ? providerError.detail
        : "";
  const detail = redactSensitiveText(rawMessage, apiKey);
  if (status === 401 || status === 403) {
    return "Sarvam AI rejected the API key (HTTP 401). Check your SARVAM_API_KEY in .env.";
  }
  if (status === 429) {
    return "Sarvam AI rate limit or quota exceeded (HTTP 429). Please try again in a moment.";
  }
  if (status === 400) {
    return detail
      ? `Sarvam AI could not process the audio (HTTP 400): ${detail}`
      : "Sarvam AI could not process the audio (HTTP 400). Check the recording length and audio format.";
  }
  if (status >= 500) {
    return detail
      ? `Sarvam AI server error (HTTP ${status}): ${detail}`
      : `Sarvam AI server error (HTTP ${status}). Please try again later.`;
  }
  return detail
    ? `Sarvam AI request failed (HTTP ${status}): ${detail}`
    : `Sarvam AI request failed (HTTP ${status}).`;
}

function extractSarvamTranscript(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.transcript === "string") {
    return data.transcript.trim();
  }
  return "";
}

function buildSarvamFormData({ audioBuffer, mimeType, languageCode, model = "saaras:v4", mode = "transcribe" }) {
  if (!audioBuffer) {
    throw new Error("No audio buffer provided.");
  }
  const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
  if (buffer.length === 0) {
    throw new Error("Audio buffer is empty.");
  }
  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error("Audio buffer exceeds 25MB limit.");
  }
  const cleanMimeType = typeof mimeType === "string" && mimeType.trim() ? mimeType.split(";")[0].trim() : "audio/webm";
  const filename = getAudioExtension(cleanMimeType);
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: cleanMimeType }), filename);
  formData.append("model", model);
  formData.append("language_code", languageCode);
  formData.append("mode", mode);
  return formData;
}

async function transcribeWithSarvam({
  audioBuffer,
  mimeType,
  language = "en",
  apiKey = process.env.SARVAM_API_KEY,
  fetchFn = globalThis.fetch
} = {}) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return {
      ok: false,
      error: "Sarvam AI is not configured. Add SARVAM_API_KEY to your .env file and restart Mochi."
    };
  }

  const sarvamLang = SARVAM_SUPPORTED_LANGUAGES[language];
  if (!sarvamLang) {
    return {
      ok: false,
      error: `Sarvam speech recognition does not support '${language}'. Please select English, Hindi, or Kannada.`
    };
  }

  if (!audioBuffer) {
    return { ok: false, error: "No audio data was provided for transcription." };
  }

  let buffer;
  if (Buffer.isBuffer(audioBuffer)) {
    buffer = audioBuffer;
  } else if (audioBuffer instanceof ArrayBuffer) {
    buffer = Buffer.from(audioBuffer);
  } else if (ArrayBuffer.isView(audioBuffer)) {
    buffer = Buffer.from(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength);
  } else {
    try {
      buffer = Buffer.from(audioBuffer);
    } catch (_) {
      return { ok: false, error: "Invalid audio buffer format." };
    }
  }

  if (buffer.length < 50) {
    return { ok: false, error: "The recorded audio was empty or too short." };
  }
  if (buffer.length > 25 * 1024 * 1024) {
    return { ok: false, error: "The recorded audio exceeds the 25MB limit." };
  }

  try {
    const formData = buildSarvamFormData({
      audioBuffer: buffer,
      mimeType: mimeType || "audio/webm",
      languageCode: sarvamLang
    });

    const response = await fetchFn("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey
      },
      body: formData,
      signal: AbortSignal.timeout(20_000)
    });

    let data;
    try { data = await response.json(); }
    catch (_) {
      const error = `Sarvam AI returned malformed JSON (HTTP ${response.status}).`;
      console.error(`[Sarvam] ${error}`);
      return { ok: false, error };
    }

    if (!response.ok) {
      const error = sarvamErrorMessage(response.status, data, apiKey);
      console.error(`[Sarvam] ${redactSensitiveText(error, apiKey)}`);
      return { ok: false, error };
    }

    const transcript = extractSarvamTranscript(data);
    if (!transcript) {
      return {
        ok: false,
        error: "No speech could be recognized in the recording. Try speaking a little closer to the microphone."
      };
    }

    return {
      ok: true,
      text: transcript,
      languageCode: data.language_code || sarvamLang
    };
  } catch (error) {
    const detail = redactSensitiveText(error?.message || "Unknown network error.", apiKey);
    const networkError = error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "Sarvam AI transcription timed out after 20 seconds. Please try again."
      : `Sarvam AI network request failed: ${detail}`;
    console.error(`[Sarvam] ${networkError}`);
    return { ok: false, error: networkError };
  }
}

module.exports = {
  SARVAM_SUPPORTED_LANGUAGES,
  getAudioExtension,
  redactSensitiveText,
  sarvamErrorMessage,
  extractSarvamTranscript,
  buildSarvamFormData,
  transcribeWithSarvam
};
