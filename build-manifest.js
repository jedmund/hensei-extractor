const fs = require("fs");

const template = fs.readFileSync("manifest.template.json", "utf8");
const apiKey = process.env.UNIQUE_KEY;

if (!apiKey) {
  console.error("Error: UNIQUE_KEY environment variable is not set.");
  process.exit(1);
}

const buildNumber = process.env.BUILD_NUMBER || "0";
const manifestContent = template
  .replace("{{UNIQUE_KEY}}", apiKey)
  .replace("{{VERSION}}", buildNumber);
fs.writeFileSync("manifest.json", manifestContent);
console.log("manifest.json generated successfully.");
