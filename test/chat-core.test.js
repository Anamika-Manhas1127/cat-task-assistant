"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MOCHI_SYSTEM_INSTRUCTION,
  buildGemmaRequest,
  buildGemmaHttpRequest,
  parseChatReminder,
  extractGemmaText,
  inspectGemmaResponse,
  gemmaEmptyResponseMessage,
  containsPromptLeak,
  redactSensitiveText,
  gemmaErrorMessage,
  replyWithReminderState,
  reminderOnlyReply
} = require("../chat-core");

test("keeps Mochi instructions separate from the exact user message", () => {
  assert.match(MOCHI_SYSTEM_INSTRUCTION, /Never write stage directions/);
  assert.match(MOCHI_SYSTEM_INSTRUCTION, /express excitement through conversational words/i);
  const examples = [
    "Hi Mochi!",
    "Help me with my hackathon project.",
    "Remind me in 5 minutes to go for lunch.",
    "What should I work on next?"
  ];
  for (const message of examples) {
    const request = buildGemmaRequest(message);
    assert.equal(request.contents[0].role, "user");
    assert.equal(request.contents[0].parts[0].text, message);
    assert.equal(request.systemInstruction.parts[0].text, MOCHI_SYSTEM_INSTRUCTION);
    assert.equal(request.contents[0].parts[0].text.includes("Persona"), false);
    assert.equal(request.generationConfig.thinkingConfig.thinkingLevel, "MINIMAL");
  }
});

test("parses one-time reminders with digit or word delays and both phrasings", () => {
  const now = new Date("2026-10-17T12:00:00.000Z");
  const inFive = parseChatReminder("Help with my hackathon. Remind me in 5 minutes to go for lunch.", now);
  assert.equal(inFive.title, "go for lunch");
  assert.equal(inFive.dueAt, "2026-10-17T12:05:00.000Z");
  const later = parseChatReminder("Remind me five minutes later that I have to go for lunch.", now);
  assert.equal(later.title, "I have to go for lunch");
  assert.equal(later.dueAt, inFive.dueAt);
  assert.equal(parseChatReminder("Remind me in 1 minute to stretch", now).title, "stretch");
  assert.equal(parseChatReminder("Remind me in 0 minutes to stretch", now), null);
});

test("extracts only generated answer text and excludes Gemma thought parts", () => {
  const text = extractGemmaText({ candidates: [{ content: { parts: [
    { text: "internal thought", thought: true }, { text: "Nya! " }, { text: "Let's start." }
  ] } }] });
  assert.equal(text, "Nya! Let's start.");
  assert.equal(extractGemmaText({ candidates: [] }), "");
});

test("finds displayable text in later candidates and returns only safe metadata", () => {
  const inspection = inspectGemmaResponse({
    candidates: [
      { finishReason: "STOP", content: { parts: [{ text: "private reasoning", thought: true }] } },
      { finishReason: "STOP", content: { parts: [{ text: "Nya! Let's plan the demo." }] } }
    ],
    promptFeedback: {}
  });
  assert.equal(inspection.text, "Nya! Let's plan the demo.");
  assert.equal(inspection.candidateCount, 2);
  assert.deepEqual(inspection.finishReasons, ["STOP", "STOP"]);
  assert.equal(inspection.candidates[0].thoughtTextPartCount, 1);
  assert.equal(JSON.stringify(inspection.candidates).includes("private reasoning"), false);
});

test("explains prompt blocks, empty candidates, blocked finishes, and malformed response shapes", () => {
  const blocked = inspectGemmaResponse({ candidates: [], promptFeedback: { blockReason: "SAFETY" } });
  assert.match(gemmaEmptyResponseMessage(blocked, 200), /blocked this message \(SAFETY\)/);
  const empty = inspectGemmaResponse({ candidates: [], promptFeedback: {} });
  assert.match(gemmaEmptyResponseMessage(empty, 200), /no candidates/);
  const finish = inspectGemmaResponse({ candidates: [{ finishReason: "RECITATION", content: { parts: [] } }] });
  assert.match(gemmaEmptyResponseMessage(finish, 200), /RECITATION/);
  const maxTokens = inspectGemmaResponse({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] });
  assert.match(gemmaEmptyResponseMessage(maxTokens, 200), /response limit/);
  const malformed = inspectGemmaResponse({ candidates: "unexpected" });
  assert.match(gemmaEmptyResponseMessage(malformed, 200), /unexpected response structure/);
});

test("identifies leaked prompt scaffolding without stripping ordinary punctuation", () => {
  assert.equal(containsPromptLeak("* Persona: Mochi"), true);
  assert.equal(containsPromptLeak("Nya! 🐾 Let's plan your first task."), false);
});

test("only confirms reminder success when a persisted reminder record is supplied", () => {
  const answer = "Nya! 🐾 Let's get your hackathon project moving!";
  assert.equal(replyWithReminderState(answer, null, false), answer);
  assert.match(replyWithReminderState(answer, null, true), /couldn't schedule.*isn't set/);
  const saved = { title: "go for lunch", delayMs: 300_000 };
  assert.match(replyWithReminderState(answer, saved, true), /I'll remind you in 5 minutes: go for lunch/);
  assert.match(reminderOnlyReply(saved), /couldn't reach Gemma.*remind you in 5 minutes/);
});

test("classifies provider failures and redacts credentials from diagnostics", () => {
  const secret = "private-test-key-123456789";
  assert.equal(redactSensitiveText(`bad key ${secret}`, secret), "bad key [redacted]");
  assert.match(gemmaErrorMessage(401, { message: "API key not valid" }, secret), /rejected the API key \(HTTP 401\)/);
  assert.match(gemmaErrorMessage(404, { message: "model was not found" }, secret), /model unavailable \(HTTP 404\)/);
  assert.match(gemmaErrorMessage(429, { message: "RESOURCE_EXHAUSTED: quota exceeded" }, secret), /quota or rate limit \(HTTP 429\)/);
  assert.match(gemmaErrorMessage(503, { message: `backend unavailable ${secret}` }, secret), /HTTP 503.*backend unavailable \[redacted\]/);
});

test("diagnostic and chat can share the exact Gemma endpoint, headers, and body builder", () => {
  const request = buildGemmaHttpRequest("test-only-secret", "gemma-4-26b-a4b-it", "Hi Mochi!");
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["x-goog-api-key"], "test-only-secret");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), buildGemmaRequest("Hi Mochi!"));
});
