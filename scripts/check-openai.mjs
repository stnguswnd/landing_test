import { readFile } from "node:fs/promises";

function parseEnvValue(envText, name) {
  const match = envText.match(new RegExp(`^${name}=(["']?)(.+?)\\1\\s*$`, "m"));
  return match?.[2];
}

const envFiles = await Promise.allSettled([
  readFile(new URL("../.env", import.meta.url), "utf8"),
  readFile(new URL("../.env.local", import.meta.url), "utf8"),
]);

const envText = envFiles
  .filter((result) => result.status === "fulfilled")
  .map((result) => result.value)
  .join("\n");

const apiKey = process.env.OPENAI_API_KEY || parseEnvValue(envText, "OPENAI_API_KEY");
const model = process.env.OPENAI_WRITING_MODEL || parseEnvValue(envText, "OPENAI_WRITING_MODEL") || "gpt-4.1-mini";

if (!apiKey) {
  console.error("OPENAI_API_KEY missing");
  process.exit(1);
}

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    response_format: { type: "json_object" },
    max_tokens: 20,
    messages: [{ role: "user", content: 'Return JSON {"ok":true}.' }],
  }),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`OPENAI_TEST_FAILED ${response.status} ${body.slice(0, 240)}`);
  process.exit(1);
}

console.log(`OPENAI_TEST_OK model=${model}`);
