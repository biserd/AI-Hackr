import { AIHackr } from "./sdk.js";
const [command, argument] = process.argv.slice(2),
  key = process.env.AIHACKR_API_KEY;
if (!key)
  throw new Error(
    "Set AIHACKR_API_KEY in your local environment, never in chat.",
  );
const api = new AIHackr(key, process.env.AIHACKR_BASE_URL);
let result;
switch (command) {
  case "usage":
    result = await api.usage();
    break;
  case "job":
    result = await api.job(argument);
    break;
  case "result":
    result = await api.result(argument);
    break;
  case "scrape":
    result = await api.run("scrape", {
      url: argument,
      render: "http",
      maxCredits: Number(process.env.AIHACKR_MAX_CREDITS ?? 1),
    });
    break;
  default:
    throw new Error("Usage: cli usage | job ID | result ID | scrape URL");
}
console.info(JSON.stringify(result, null, 2));
