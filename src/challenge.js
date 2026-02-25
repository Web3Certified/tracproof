const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/challenges.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function issueChallenge(challenge) {
  const challenges = load();
  const ch = { ...challenge, status: 'PENDING', response: null, votes: [], consensus: null };
  challenges.push(ch);
  save(challenges);
  return { success: true, challenge: ch };
}

function respondToChallenge({ challengeId, agentId, response }) {
  const challenges = load();
  const ch = challenges.find(c => c.id === challengeId);
  if (!ch) return { success: false, message: 'Challenge not found' };
  if (ch.targetId !== agentId) return { success: false, message: 'Not your challenge' };
  ch.response = response;
  ch.respondedAt = Date.now();
  ch.status = 'AWAITING_VERIFICATION';
  save(challenges);
  return { success: true, challenge: ch };
}

function castVote({ challengeId, witnessId, vote, reason }) {
  const challenges = load();
  const ch = challenges.find(c => c.id === challengeId);
  if (!ch) return { success: false, message: 'Challenge not found' };
  if (ch.votes.find(v => v.witnessId === witnessId)) return { success: false, message: 'Already voted' };
  ch.votes.push({ witnessId, vote, reason, timestamp: Date.now() });
  // Determine consensus after 3+ votes
  if (ch.votes.length >= 3) {
    const passes = ch.votes.filter(v => v.vote === 'PASS').length;
    const fails = ch.votes.filter(v => v.vote === 'FAIL').length;
    if (passes > fails) { ch.consensus = 'PASS'; ch.status = 'VERIFIED'; }
    else { ch.consensus = 'FAIL'; ch.status = 'FAILED'; }
  }
  save(challenges);
  return { success: true, votes: ch.votes, consensus: ch.consensus };
}

function getAllChallenges() { return load(); }
function getChallengeById(id) { return load().find(c => c.id === id); }
function getChallengesByAgent(agentId) {
  return load().filter(c => c.challengerId === agentId || c.targetId === agentId);
}

module.exports = { issueChallenge, respondToChallenge, castVote, getAllChallenges, getChallengeById, getChallengesByAgent };
