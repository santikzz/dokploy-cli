export type EnvError = { line: number; message: string };

// validate dotenv-style content the way docker/dokploy consume it: KEY=VALUE per
// line, with # comments, blank lines, and an optional leading `export`. returns one
// error per offending line so the caller can point the user at it.
export function validateEnv(content: string): EnvError[] {
  const errors: EnvError[] = [];

  content.split("\n").forEach((raw, i) => {
    const lineNo = i + 1;
    let line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();

    const eq = line.indexOf("=");
    if (eq === -1) {
      errors.push({ line: lineNo, message: `missing "=", expected KEY=VALUE` });
      return;
    }

    const key = line.slice(0, eq).trim();
    if (!key) {
      errors.push({ line: lineNo, message: `empty key before "="` });
      return;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.push({
        line: lineNo,
        message: `invalid key "${key}" (letters, digits, underscore; no leading digit or spaces)`,
      });
      return;
    }

    if (hasUnbalancedQuote(line.slice(eq + 1).trim())) {
      errors.push({ line: lineNo, message: `unbalanced quote in value` });
    }
  });

  return errors;
}

function hasUnbalancedQuote(value: string): boolean {
  const q = value[0];
  if (q !== '"' && q !== "'") return false;
  return value.length < 2 || value[value.length - 1] !== q;
}
