const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

export const getStats = (value: string) => ({
  words: tokenize(value).length,
  characters: value.length,
  lines: value ? value.split("\n").length : 0,
});

export const similarityScore = (a: string, b: string) => {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let intersection = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  });
  const union = tokensA.size + tokensB.size - intersection;
  return Math.round((intersection / union) * 100);
};
