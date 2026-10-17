"use strict";

const path = require("path");
const dotenv = require("dotenv");
const {
  buildGemmaHttpRequest,
  gemmaEmptyResponseMessage,
  gemmaErrorMessage,
  inspectGemmaResponse,
  redactSensitiveText
} = require("./chat-core");

const envPath = path.join(__dirname, ".env");
const envResult = dotenv.config({ path: envPath });
const apiKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const modelId = process.env.GEMMA_MODEL_ID || "gemma-4-26b-a4b-it";
const messageIndex = process.argv.indexOf("--message");
const diagnosticMessage = messageIndex >= 0
  ? process.argv.slice(messageIndex + 1).join(" ").trim()
  : "Reply with a brief greeting.";

console.log(JSON.stringify({
  envFile: envResult.error ? "not loaded" : "loaded",
  GEMMA_API_KEY_present: Boolean(process.env.GEMMA_API_KEY),
  usableGoogleKeyPresent: Boolean(apiKey),
  model: modelId
}));

if (process.argv.includes("--config-only")) {
  process.exitCode = envResult.error || !apiKey ? 2 : 0;
} else if (!apiKey) {
  console.error("No Google AI key is configured. Set GEMMA_API_KEY in the project .env file.");
  process.exitCode = 2;
} else {
  const request = buildGemmaHttpRequest(apiKey, modelId, diagnosticMessage || "Reply with a brief greeting.");
  fetch(request.url, { ...request.options, signal: AbortSignal.timeout(20_000) }).then(async response => {
    let data;
    try { data = await response.json(); }
    catch (_) {
      console.log(JSON.stringify({ httpStatus: response.status, ok: false, error: `Malformed JSON response (HTTP ${response.status}).` }));
      process.exitCode = 1;
      return;
    }
    if (!response.ok) {
      const error = gemmaErrorMessage(response.status, data?.error, apiKey);
      console.log(JSON.stringify({ httpStatus: response.status, ok: false, error }));
      process.exitCode = 1;
      return;
    }
    const inspection = inspectGemmaResponse(data);
    console.log(JSON.stringify({
      httpStatus: response.status,
      ok: response.ok,
      candidateCount: inspection.candidateCount,
      candidates: inspection.candidates,
      finishReasons: inspection.finishReasons,
      promptFeedbackBlockReason: inspection.blockReason || null,
      generatedTextReceived: Boolean(inspection.text)
    }));
    if (!inspection.text) {
      console.log(gemmaEmptyResponseMessage(inspection, response.status));
      process.exitCode = 1;
    }
  }).catch(error => {
    const detail = redactSensitiveText(error?.message || "Unknown network error.", apiKey);
    console.log(JSON.stringify({ networkError: detail }));
    process.exitCode = 1;
  });
}