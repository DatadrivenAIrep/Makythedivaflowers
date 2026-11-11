/**
 * What a log line may say about an error: its class name and nothing else.
 * Messages (V8 quotes the text a parser choked on) can carry card text or names.
 */
export function errorClass(e: unknown): string {
  return e instanceof Error ? e.name : typeof e;
}
