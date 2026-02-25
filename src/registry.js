const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/registry.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) return { skills: [], agents: {} };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function registerSkill({ agentId, skill, description, stakeAmount }) {
  const data = load();
  const existing = data.skills.find(s => s.agentId === agentId && s.skill === skill);
  if (existing) return { success: false, message: 'Skill already registered' };
  const entry = { id: `${agentId}-${skill}`, agentId, skill, description, stakeAmount, status: 'CLAIMED', registeredAt: Date.now() };
  data.skills.push(entry);
  if (!data.agents[agentId]) data.agents[agentId] = { agentId, tnkBalance: 1000 };
  save(data);
  return { success: true, entry };
}

function getAllSkills() {
  return load().skills;
}

function getSkillsByAgent(agentId) {
  return load().skills.filter(s => s.agentId === agentId);
}

function getAgentCount() {
  return Object.keys(load().agents).length;
}

function updateSkillStatus(agentId, skill, status) {
  const data = load();
  const entry = data.skills.find(s => s.agentId === agentId && s.skill === skill);
  if (entry) { entry.status = status; save(data); }
}

module.exports = { registerSkill, getAllSkills, getSkillsByAgent, getAgentCount, updateSkillStatus };
