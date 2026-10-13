// SSE parser tests. No test framework in the Client on purpose: run with Node's built-in runner:
//   node --test src/features/medassist/api/sse.test.js
import assert from "node:assert/strict";
import test from "node:test";
import { createSseParser } from "./sse.js";

function parse(chunks, { end = true } = {}) {
  const events = [];
  const parser = createSseParser((e) => events.push(e));
  for (const c of chunks) parser.push(c);
  if (end) parser.end();
  return events;
}

const STREAM =
  'event: token\ndata: {"text":"Para"}\n\n' +
  'event: token\ndata: {"text":"cetamol"}\n\n' +
  'event: citations\ndata: [{"n":1,"drug":"paracetamol","section":"Warnings","url":"https://x.test"}]\n\n' +
  'event: meta\ndata: {"messageId":"m1","sessionId":"s1","route":"knowledge","escalated":false,"latencyMs":5}\n\n' +
  "event: done\ndata: {}\n\n";

test("many events in one chunk, in order", () => {
  const events = parse([STREAM]);
  assert.deepEqual(
    events.map((e) => e.event),
    ["token", "token", "citations", "meta", "done"],
  );
  assert.equal(JSON.parse(events[1].data).text, "cetamol");
  assert.equal(JSON.parse(events[3].data).sessionId, "s1");
});

test("same result whatever the chunk size (events split across chunks)", () => {
  const whole = parse([STREAM]);
  for (const size of [1, 2, 3, 7, 13]) {
    const chunks = [];
    for (let i = 0; i < STREAM.length; i += size) chunks.push(STREAM.slice(i, i + size));
    assert.deepEqual(parse(chunks), whole, `chunk size ${size}`);
  }
});

test("CRLF line endings, also when \\r and \\n land in different chunks", () => {
  const crlf = STREAM.replace(/\n/g, "\r\n");
  assert.deepEqual(parse([crlf]), parse([STREAM]));
  const chunks = [];
  for (let i = 0; i < crlf.length; i += 1) chunks.push(crlf[i]);
  assert.deepEqual(parse(chunks), parse([STREAM]));
});

test("an event is not dispatched before its blank line", () => {
  const events = [];
  const parser = createSseParser((e) => events.push(e));
  parser.push('event: token\ndata: {"text":"a"}\n');
  assert.equal(events.length, 0);
  parser.push("\n");
  assert.equal(events.length, 1);
});

test("multi-line data is joined with \\n; comments and unknown fields are ignored", () => {
  const events = parse([": keep-alive\n", "id: 7\nretry: 100\nevent: error\ndata: line1\ndata: line2\n\n"]);
  assert.deepEqual(events, [{ event: "error", data: "line1\nline2" }]);
});

test("missing space after the colon and default event name", () => {
  assert.deepEqual(parse(['data:{"x":1}\n\n']), [{ event: "message", data: '{"x":1}' }]);
});

test("end() flushes a last event without a trailing blank line", () => {
  assert.deepEqual(parse(["event: done\ndata: {}"]), [{ event: "done", data: "{}" }]);
  assert.deepEqual(parse(["event: done\ndata: {}"], { end: false }), []);
});

test("blank lines alone dispatch nothing", () => {
  assert.deepEqual(parse(["\n\n\r\n"]), []);
});
