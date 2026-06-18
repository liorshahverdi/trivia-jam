const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  pi: 'π',
  nbsp: ' ',
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#\d+|#x[\da-fA-F]+|[a-zA-Z][\w-]*);/g, (entity, body) => {
    if (body.startsWith('#x')) {
      const codePoint = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    if (body.startsWith('#')) {
      const codePoint = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return HTML_ENTITIES[body] ?? entity;
  });
}
