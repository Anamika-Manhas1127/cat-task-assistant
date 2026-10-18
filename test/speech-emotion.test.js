"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ALLOWED_EMOTIONS,
  ALLOWED_INTENSITIES,
  EMOTION_DELIVERY,
  classifyEmotion,
  extractEmotionMetadata,
  cleanSpokenText,
  getDeliverySettings,
  enhanceSentence
} = require("../speech-emotion");

test("classifies emotion from text content and keywords", () => {
  assert.equal(classifyEmotion("Hooray! You completed your task!"), "excited");
  assert.equal(classifyEmotion("Yawn... time for a little break."), "sleepy");
  assert.equal(classifyEmotion("You haven't moved in a while, are you okay?"), "concerned");
  assert.equal(classifyEmotion("Take a sip of water and hydrate!"), "gentle");
  assert.equal(classifyEmotion("Hehe, caught you looking away!"), "playful");
  assert.equal(classifyEmotion("You got this, let's finish this together!"), "encouraging");
  assert.equal(classifyEmotion("Here is your reminder for 3 PM."), "neutral");
});

test("extracts explicit emotion tags and preserves allowlist", () => {
  const result = extractEmotionMetadata("[emotion:excited] Hello there!");
  assert.equal(result.emotion, "excited");
  assert.equal(classifyEmotion("[excited] Great job!"), "excited");
  assert.equal(classifyEmotion("[unknown_emotion] Normal text"), "neutral");
});

test("cleanSpokenText strips emojis, markdown, and internal tags", () => {
  const raw = "🐱 **Great job!** [emotion:excited] *wiggles tail* You did it! 🎉";
  const cleaned = cleanSpokenText(raw);
  assert.equal(cleaned, "Great job! You did it!");
  assert.equal(cleanSpokenText(""), "");
});

test("getDeliverySettings returns appropriate pitch and speed profile", () => {
  const excited = getDeliverySettings("Hooray! Great job!");
  assert.equal(excited.emotion, "excited");
  assert.equal(excited.fishTag, "[excited]");
  assert.ok(excited.pitch > 1.3);
  assert.ok(excited.speed > 1.0);

  const sleepy = getDeliverySettings("Yawn... bedtime");
  assert.equal(sleepy.emotion, "sleepy");
  assert.ok(sleepy.speed < 0.9);
});
