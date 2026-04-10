require("dotenv").config();

const event = process.argv[2] || "match_live";
const matchId = process.argv[3];
const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:4001";
const webhookKey = process.env.CS2_WEBHOOK_KEY || "";

if (!matchId) {
  console.error("Usage: node scripts/test-cs2-webhook.js <event> <matchId>");
  console.error("Example: node scripts/test-cs2-webhook.js match_live b864630c-2f7a-4253-8549-76dee0e9bdba");
  process.exit(1);
}

const payload = {
  event,
  matchId,
  timestamp: new Date().toISOString(),
  team1: { name: "Test", score: 1, seriesScore: 0 },
  team2: { name: "Fake Opponent", score: 0, seriesScore: 0 },
};

async function run() {
  const res = await fetch(`${baseUrl}/api/webhooks/cs2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${webhookKey}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(body);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
