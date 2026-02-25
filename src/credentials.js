const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/credentials.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function issueCredential({ agentId, skill, challengeId, issuedAt, expiresAt }) {
  const creds = load();
  creds.push({ id: `cred-${Date.now()}`, agentId, skill, challengeId, issuedAt, expiresAt, valid: true });
  save(creds);
}

function queryCredentials({ skill, agentId }) {
  let creds = load();
  const now = Date.now();
  creds = creds.filter(c => c.expiresAt > now); // filter expired
  if (skill) creds = creds.filter(c => c.skill === skill);
  if (agentId) creds = creds.filter(c => c.agentId === agentId);
  return creds;
}

function computeTrustScore(agentId) {
  const creds = queryCredentials({ agentId });
  if (!creds.length) return 0;
  // Score based on number of valid credentials and recency
  const score = creds.reduce((acc, c) => {
    const ageMs = Date.now() - c.issuedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 1 - ageDays / 30);
    return acc + (10 * (1 + recencyBonus));
  }, 0);
  return Math.min(100, Math.round(score));
}

module.exports = { issueCredential, queryCredentials, computeTrustScore };
