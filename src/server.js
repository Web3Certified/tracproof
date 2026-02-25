const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const registry = require('./registry');
const challenge = require('./challenge');
const credentials = require('./credentials');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── SKILL REGISTRY ───────────────────────────────────────────────

app.get('/api/skills', (req, res) => {
  res.json(registry.getAllSkills());
});

app.post('/api/skills/register', (req, res) => {
  const { agentId, skill, description, stakeAmount } = req.body;
  if (!agentId || !skill) return res.status(400).json({ error: 'agentId and skill required' });
  const result = registry.registerSkill({ agentId, skill, description, stakeAmount: stakeAmount || 50 });
  res.json(result);
});

// ─── CHALLENGE ENGINE ─────────────────────────────────────────────

app.get('/api/challenges', (req, res) => {
  res.json(challenge.getAllChallenges());
});

app.post('/api/challenges/issue', (req, res) => {
  const { challengerId, targetId, skill, stakeAmount, timeoutSeconds } = req.body;
  if (!challengerId || !targetId || !skill) {
    return res.status(400).json({ error: 'challengerId, targetId, and skill required' });
  }
  const result = challenge.issueChallenge({
    id: uuidv4(),
    challengerId,
    targetId,
    skill,
    stakeAmount: stakeAmount || 100,
    timeoutSeconds: timeoutSeconds || 300,
    createdAt: Date.now()
  });
  res.json(result);
});

app.post('/api/challenges/respond', (req, res) => {
  const { challengeId, agentId, response } = req.body;
  if (!challengeId || !agentId || !response) {
    return res.status(400).json({ error: 'challengeId, agentId, and response required' });
  }
  const result = challenge.respondToChallenge({ challengeId, agentId, response });
  res.json(result);
});

app.post('/api/challenges/verify', (req, res) => {
  const { challengeId, witnessId, vote, reason } = req.body;
  if (!challengeId || !witnessId || !vote) {
    return res.status(400).json({ error: 'challengeId, witnessId, and vote required' });
  }
  const result = challenge.castVote({ challengeId, witnessId, vote, reason });
  // Auto-issue credential if consensus reached
  if (result.consensus === 'PASS') {
    const ch = challenge.getChallengeById(challengeId);
    credentials.issueCredential({
      agentId: ch.targetId,
      skill: ch.skill,
      challengeId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }
  res.json(result);
});

// ─── CREDENTIALS ──────────────────────────────────────────────────

app.get('/api/credentials', (req, res) => {
  const { skill, agentId } = req.query;
  res.json(credentials.queryCredentials({ skill, agentId }));
});

app.get('/api/agents/:agentId/profile', (req, res) => {
  const { agentId } = req.params;
  const agentSkills = registry.getSkillsByAgent(agentId);
  const agentCredentials = credentials.queryCredentials({ agentId });
  const agentChallenges = challenge.getChallengesByAgent(agentId);
  res.json({
    agentId,
    skills: agentSkills,
    credentials: agentCredentials,
    challengeHistory: agentChallenges,
    score: credentials.computeTrustScore(agentId)
  });
});

// ─── AI EVALUATOR ─────────────────────────────────────────────────

app.post('/api/evaluate', async (req, res) => {
  const { skill, response, context } = req.body;
  // Calls Claude API to evaluate a skill response
  try {
    const result = await evaluateWithClaude(skill, response, context);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Evaluator unavailable', details: e.message });
  }
});

async function evaluateWithClaude(skill, response, context) {
  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are an objective evaluator in the TracProof P2P credential network on Trac Network.

Skill being tested: "${skill}"
Context: ${context || 'Standard competency evaluation'}
Agent response: "${response}"

Evaluate this response on a scale of 0-100 and return JSON only:
{
  "score": <number 0-100>,
  "verdict": "PASS" | "FAIL",
  "reasoning": "<brief explanation>",
  "strengths": ["<strength1>"],
  "weaknesses": ["<weakness1>"]
}

PASS threshold is 70. Return only valid JSON, no other text.`
      }]
    })
  });
  const data = await apiRes.json();
  const text = data.content[0].text;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ─── INTERCOM SIDECHAIN SIMULATION ───────────────────────────────

app.get('/api/network/broadcast', (req, res) => {
  // Simulate Intercom P2P broadcast of current state
  res.json({
    networkId: 'tracproof-mainnet',
    timestamp: Date.now(),
    peers: Math.floor(Math.random() * 50) + 10,
    activeChallenges: challenge.getAllChallenges().filter(c => c.status === 'PENDING').length,
    totalCredentials: credentials.queryCredentials({}).length,
    registeredAgents: registry.getAgentCount()
  });
});

// ─── START ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║         TracProof — Node Online           ║
║   P2P Agent Credential Network            ║
║   Built on Intercom / Trac Network        ║
╠═══════════════════════════════════════════╣
║  Dashboard: http://localhost:${PORT}          ║
║  API:       http://localhost:${PORT}/api      ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
