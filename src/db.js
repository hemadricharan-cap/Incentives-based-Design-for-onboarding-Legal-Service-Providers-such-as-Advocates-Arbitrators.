import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'app.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let SQL = null;
let db = null;

export async function initDatabase() {
  if (!SQL) {
    // Load wasm from local node_modules for offline use
    const distPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist');
    SQL = await initSqlJs({ locateFile: file => path.join(distPath, file) });
  }
  if (fs.existsSync(dbFile)) {
    const fileBuffer = fs.readFileSync(dbFile);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('provider','client')),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by INTEGER,
      points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(referred_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      base_rate REAL NOT NULL,
      incentive_type TEXT NOT NULL CHECK(incentive_type IN ('milestone','referral','performance')),
      incentive_details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(provider_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS engagements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(client_id) REFERENCES users(id),
      FOREIGN KEY(service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engagement_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      FOREIGN KEY(engagement_id) REFERENCES engagements(id)
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      engagement_id INTEGER,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('milestone','bonus','referral')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(provider_id) REFERENCES users(id),
      FOREIGN KEY(engagement_id) REFERENCES engagements(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engagement_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(engagement_id) REFERENCES engagements(id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referee_id INTEGER NOT NULL,
      reward_points INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(referrer_id) REFERENCES users(id),
      FOREIGN KEY(referee_id) REFERENCES users(id)
    );
  `);
  persist();
}

export function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex');
}

export function createUser({ role, name, email, password, referredByCode }) {
  const existing = selectOne('SELECT id FROM users WHERE email = ?',[email]);
  if (existing) {
    throw new Error('Email already in use');
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const referralCode = generateReferralCode();

  let referredById = null;
  if (referredByCode) {
    const ref = selectOne('SELECT id FROM users WHERE referral_code = ?',[referredByCode]);
    if (ref) referredById = ref.id;
  }
  run('INSERT INTO users(role, name, email, password_hash, referral_code, referred_by) VALUES(?,?,?,?,?,?)',
      [role, name, email, passwordHash, referralCode, referredById]);
  const user = selectOne('SELECT id FROM users WHERE email = ?',[email]);
  if (referredById) {
    const rewardPoints = 50;
    run('INSERT INTO referrals(referrer_id, referee_id, reward_points) VALUES(?,?,?)', [referredById, user.id, rewardPoints]);
    run('UPDATE users SET points = points + ? WHERE id = ?', [rewardPoints, referredById]);
    run('UPDATE users SET points = points + ? WHERE id = ?', [10, user.id]);
  }
  persist();
  return user.id;
}

export function authenticateUser(email, password) {
  const user = selectOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  return ok ? user : null;
}

export function getUserById(id) {
  return selectOne('SELECT * FROM users WHERE id = ?', [id]);
}

export function getUserByEmail(email) {
  return selectOne('SELECT * FROM users WHERE email = ?', [email]);
}

export function createService({ providerId, title, description, baseRate, incentiveType, incentiveDetails }) {
  run('INSERT INTO services(provider_id, title, description, base_rate, incentive_type, incentive_details) VALUES(?,?,?,?,?,?)',
    [providerId, title, description, baseRate, incentiveType, incentiveDetails]);
  const row = selectOne('SELECT last_insert_rowid() AS id');
  persist();
  return row.id;
}

export function listServices() {
  return selectAll(`
    SELECT s.*, u.name AS provider_name FROM services s
    JOIN users u ON u.id = s.provider_id
    ORDER BY s.created_at DESC
  `);
}

export function getServiceById(id) {
  return selectOne(`
    SELECT s.*, u.name AS provider_name FROM services s
    JOIN users u ON u.id = s.provider_id
    WHERE s.id = ?
  `, [id]);
}

export function listServicesByProvider(providerId) {
  return selectAll('SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC', [providerId]);
}

export function createEngagement({ clientId, serviceId, milestones }) {
  run('INSERT INTO engagements(client_id, service_id) VALUES(?,?)', [clientId, serviceId]);
  const eid = selectOne('SELECT last_insert_rowid() AS id').id;
  for (const m of milestones) {
    run('INSERT INTO milestones(engagement_id, title, amount) VALUES(?,?,?)', [eid, m.title, m.amount]);
  }
  persist();
  return eid;
}

export function getEngagementWithMilestones(engagementId) {
  const engagement = selectOne(`
    SELECT e.*, s.title AS service_title, s.provider_id, c.name AS client_name, p.name AS provider_name
    FROM engagements e
    JOIN services s ON s.id = e.service_id
    JOIN users c ON c.id = e.client_id
    JOIN users p ON p.id = s.provider_id
    WHERE e.id = ?
  `, [engagementId]);
  if (!engagement) return null;
  const milestones = selectAll('SELECT * FROM milestones WHERE engagement_id = ? ORDER BY id', [engagementId]);
  return { engagement, milestones };
}

export function listEngagementsForClient(clientId) {
  return selectAll(`
    SELECT e.*, s.title AS service_title, u.name AS provider_name
    FROM engagements e
    JOIN services s ON s.id = e.service_id
    JOIN users u ON u.id = s.provider_id
    WHERE e.client_id = ?
    ORDER BY e.created_at DESC
  `, [clientId]);
}

export function listEngagementsForProvider(providerId) {
  return selectAll(`
    SELECT e.*, s.title AS service_title, u.name AS client_name
    FROM engagements e
    JOIN services s ON s.id = e.service_id
    JOIN users u ON u.id = e.client_id
    WHERE s.provider_id = ?
    ORDER BY e.created_at DESC
  `, [providerId]);
}

export function listMilestones(engagementId) {
  return selectAll('SELECT * FROM milestones WHERE engagement_id = ? ORDER BY id', [engagementId]);
}

export function completeMilestone({ milestoneId }) {
  const m = selectOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
    if (!m) throw new Error('Milestone not found');
    if (m.is_completed) return;
  run("UPDATE milestones SET is_completed = 1, completed_at = datetime('now') WHERE id = ?", [milestoneId]);
  const e = selectOne('SELECT * FROM engagements WHERE id = ?', [m.engagement_id]);
  const s = selectOne('SELECT * FROM services WHERE id = ?', [e.service_id]);
  run("INSERT INTO payouts(provider_id, engagement_id, amount, type) VALUES(?,?,?, 'milestone')", [s.provider_id, e.id, m.amount]);
  persist();
}

export function providerEarnings(providerId) {
  const row = selectOne('SELECT COALESCE(SUM(amount),0) AS total FROM payouts WHERE provider_id = ?', [providerId]);
  return row.total || 0;
}

export function providerPayouts(providerId) {
  return selectAll('SELECT * FROM payouts WHERE provider_id = ? ORDER BY created_at DESC', [providerId]);
}

export function createReview({ engagementId, rating, comment }) {
  run('INSERT INTO reviews(engagement_id, rating, comment) VALUES(?,?,?)', [engagementId, rating, comment]);
  persist();
}

export function seedDemoData() {
  const serviceCountRow = selectOne('SELECT COUNT(*) AS c FROM services');
  if (serviceCountRow && serviceCountRow.c > 0) return;

  // Ensure demo provider
  let provider = selectOne('SELECT * FROM users WHERE email = ?',[ 'provider@example.com' ]);
  if (!provider) {
    const providerId = createUser({ role: 'provider', name: 'Demo Provider LLP', email: 'provider@example.com', password: 'password123', referredByCode: null });
    provider = getUserById(providerId);
  }

  // Ensure demo client
  let client = selectOne('SELECT * FROM users WHERE email = ?',[ 'client@example.com' ]);
  if (!client) {
    const clientId = createUser({ role: 'client', name: 'Demo Client', email: 'client@example.com', password: 'password123', referredByCode: null });
    client = getUserById(clientId);
  }

  // Sample services
  createService({
    providerId: provider.id,
    title: 'Contract Drafting & Review',
    description: 'Comprehensive drafting and review of commercial contracts with negotiated terms and compliance checks.',
    baseRate: 500,
    incentiveType: 'milestone',
    incentiveDetails: 'Milestone payouts for draft, revisions, and final sign-off'
  });
  createService({
    providerId: provider.id,
    title: 'IP Trademark Filing',
    description: 'End-to-end trademark search, filing, and office action responses.',
    baseRate: 700,
    incentiveType: 'performance',
    incentiveDetails: '10% bonus on first-pass acceptance'
  });
  const svcId = createService({
    providerId: provider.id,
    title: 'Startup Compliance Package',
    description: 'Entity setup, founders agreements, ESOP policy, and ROC filings for early-stage startups.',
    baseRate: 1200,
    incentiveType: 'referral',
    incentiveDetails: 'Earn 50 points for each successful referral'
  });

  // One demo engagement to showcase milestones
  createEngagement({
    clientId: client.id,
    serviceId: svcId,
    milestones: [
      { title: 'Entity Incorporation', amount: 400 },
      { title: 'Founders Agreement', amount: 400 },
      { title: 'ESOP Policy + Filings', amount: 400 }
    ]
  });
}

function selectAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function selectOne(sql, params = []) {
  const rows = selectAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

function persist() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFile, buffer);
}


