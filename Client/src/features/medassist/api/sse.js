/**
 * Minimal Server-Sent Events parser for fetch streams.
 *
 * Feed it decoded text in any chunk sizes; it calls onEvent({ event, data }) once per complete
 * event. An event is a block of `event:` / `data:` lines ended by a blank line. Several `data:`
 * lines are joined with "\n". Comment lines (starting with ":") and other fields are ignored.
 *
 * @param {(e: { event: string, data: string }) => void} onEvent
 */
export function createSseParser(onEvent) {
  let buffer = "";
  let eventName = "";
  let dataLines = [];
  let skipLf = false;

  function dispatch() {
    if (dataLines.length || eventName) {
      onEvent({ event: eventName || "message", data: dataLines.join("\n") });
    }
    eventName = "";
    dataLines = [];
  }

  function line(text) {
    if (text === "") return dispatch();
    if (text.startsWith(":")) return;
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") dataLines.push(value);
  }

  return {
    /** @param {string} chunk */
    push(chunk) {
      // A "\r\n" split across two chunks: the "\r" already ended the line, so drop the "\n".
      if (skipLf && chunk.startsWith("\n")) chunk = chunk.slice(1);
      skipLf = chunk.endsWith("\r");
      buffer += chunk;
      // Split on \r\n, \n or \r; keep the last (maybe unfinished) line in the buffer.
      const parts = buffer.split(/\r\n|\n|\r/);
      buffer = parts.pop() ?? "";
      for (const p of parts) line(p);
    },
    /** Call when the stream ends: flushes a last event that had no blank line after it. */
    end() {
      if (buffer) line(buffer);
      buffer = "";
      dispatch();
    },
  };
}
