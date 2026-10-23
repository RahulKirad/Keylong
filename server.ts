import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- DATABASE PERSISTENCE SETUP ---
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'trip-database.json');

const DEFAULT_TRAVELLER_NAMES = [
  'Rahul',
  'Sanket',
  'Allen',
  'Neeraj',
  'Aleena',
  'Piyu',
  'Gautami',
  'Vedant',
  'Milind',
  'Rutika',
];

interface TripDatabase {
  version: number;
  updatedAt: number;
  members: { id: string; name: string }[];
  expenses: any[];
  transfers: any[];
  pending: any[];
  assignments: any[];
  budget: {
    categories: any[];
    travelers: number;
    tripTarget: number;
  };
}

function createDefaultDatabase(): TripDatabase {
  const members = DEFAULT_TRAVELLER_NAMES.map((name, idx) => ({
    id: `mem-${idx + 1}-${name.toLowerCase()}`,
    name,
  }));
  return {
    version: 1,
    updatedAt: Date.now(),
    members,
    expenses: [],
    transfers: [],
    pending: [],
    assignments: [],
    budget: {
      categories: [],
      travelers: 10,
      tripTarget: 0,
    },
  };
}

let db: TripDatabase;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    db = JSON.parse(raw);
    if (!db.members || !Array.isArray(db.members) || db.members.length === 0) {
      db.members = createDefaultDatabase().members;
    }
    if (!db.expenses) db.expenses = [];
    if (!db.transfers) db.transfers = [];
    if (!db.pending) db.pending = [];
    if (!db.assignments) db.assignments = [];
    if (!db.budget) db.budget = createDefaultDatabase().budget;
    if (!db.version) db.version = 1;
    if (!db.updatedAt) db.updatedAt = Date.now();
  } catch (err) {
    console.error('Failed reading existing database file, resetting to defaults:', err);
    db = createDefaultDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  }
} else {
  db = createDefaultDatabase();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

let writeTimer: NodeJS.Timeout | null = null;
function persistDb() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      const tempPath = DB_PATH + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (e) {
      console.error('Error persisting database to disk:', e);
    }
  }, 100);
}

// --- API ROUTES ---

// Health & Sync Status Check
app.get('/api/sync/status', (req, res) => {
  res.json({
    status: 'ok',
    version: db.version,
    updatedAt: db.updatedAt,
    membersCount: db.members.length,
    expensesCount: db.expenses.length,
    assignmentsCount: db.assignments.length,
  });
});

// Full Database Fetch
app.get('/api/database', (req, res) => {
  res.json({
    success: true,
    version: db.version,
    updatedAt: db.updatedAt,
    data: db,
  });
});

// Universal Full / Incremental Sync
app.post('/api/sync', (req, res) => {
  const { expenses, transfers, members, pending, assignments, budget } = req.body || {};
  let changed = false;

  if (Array.isArray(members) && members.length > 0) {
    const existingIds = new Set(db.members.map((m) => m.id));
    const existingNames = new Set(db.members.map((m) => m.name.toLowerCase()));
    for (const m of members) {
      if (!m.id || !m.name) continue;
      if (!existingIds.has(m.id) && !existingNames.has(m.name.toLowerCase())) {
        db.members.push(m);
        existingIds.add(m.id);
        existingNames.add(m.name.toLowerCase());
        changed = true;
      }
    }
  }

  if (Array.isArray(expenses)) {
    const map = new Map(db.expenses.map((e) => [e.id, e]));
    for (const e of expenses) {
      if (!e.id) continue;
      const prev = map.get(e.id);
      if (!prev || (e.updatedAt || 0) >= (prev.updatedAt || 0)) {
        map.set(e.id, e);
        changed = true;
      }
    }
    db.expenses = Array.from(map.values()).sort((a, b) => (a.tripDate || '').localeCompare(b.tripDate || ''));
  }

  if (Array.isArray(transfers)) {
    const map = new Map(db.transfers.map((t) => [t.id, t]));
    for (const t of transfers) {
      if (!t.id) continue;
      if (!map.has(t.id)) {
        map.set(t.id, t);
        changed = true;
      }
    }
    db.transfers = Array.from(map.values()).sort((a, b) => (a.tripDate || '').localeCompare(b.tripDate || ''));
  }

  if (Array.isArray(assignments)) {
    const map = new Map(db.assignments.map((a) => [a.id, a]));
    for (const a of assignments) {
      if (!a.id) continue;
      const prev = map.get(a.id);
      if (!prev || (a.updatedAt || 0) >= (prev.updatedAt || 0)) {
        map.set(a.id, a);
        changed = true;
      }
    }
    db.assignments = Array.from(map.values());
  }

  if (budget && typeof budget === 'object' && budget.categories) {
    db.budget = budget;
    changed = true;
  }

  if (changed) {
    db.version++;
    db.updatedAt = Date.now();
    persistDb();
  }

  res.json({
    success: true,
    version: db.version,
    updatedAt: db.updatedAt,
    data: db,
  });
});

// Individual Expense CRUD
app.post('/api/expenses', (req, res) => {
  const expense = req.body;
  if (!expense || !expense.id) {
    return res.status(400).json({ error: 'Invalid expense payload' });
  }
  const idx = db.expenses.findIndex((e) => e.id === expense.id);
  if (idx >= 0) {
    db.expenses[idx] = { ...expense, updatedAt: Date.now() };
  } else {
    db.expenses.push({ ...expense, createdAt: expense.createdAt || Date.now(), updatedAt: Date.now() });
  }
  db.expenses.sort((a, b) => (a.tripDate || '').localeCompare(b.tripDate || ''));
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version, record: expense });
});

app.put('/api/expenses/:id', (req, res) => {
  const id = req.params.id;
  const idx = db.expenses.findIndex((e) => e.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  db.expenses[idx] = { ...db.expenses[idx], ...req.body, updatedAt: Date.now() };
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version, record: db.expenses[idx] });
});

app.delete('/api/expenses/:id', (req, res) => {
  const id = req.params.id;
  db.expenses = db.expenses.filter((e) => e.id !== id);
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version });
});

// Transfers CRUD
app.post('/api/transfers', (req, res) => {
  const transfer = req.body;
  if (!transfer || !transfer.id) {
    return res.status(400).json({ error: 'Invalid transfer payload' });
  }
  db.transfers.push(transfer);
  db.transfers.sort((a, b) => (a.tripDate || '').localeCompare(b.tripDate || ''));
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version, record: transfer });
});

app.delete('/api/transfers/:id', (req, res) => {
  const id = req.params.id;
  db.transfers = db.transfers.filter((t) => t.id !== id);
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version });
});

// Assignments CRUD
app.post('/api/assignments', (req, res) => {
  const assignment = req.body;
  if (!assignment || !assignment.id) {
    return res.status(400).json({ error: 'Invalid assignment payload' });
  }
  const idx = db.assignments.findIndex((a) => a.id === assignment.id);
  if (idx >= 0) {
    db.assignments[idx] = { ...assignment, updatedAt: Date.now() };
  } else {
    db.assignments.push({ ...assignment, createdAt: assignment.createdAt || Date.now(), updatedAt: Date.now() });
  }
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version, record: assignment });
});

app.put('/api/assignments/:id', (req, res) => {
  const id = req.params.id;
  const idx = db.assignments.findIndex((a) => a.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  db.assignments[idx] = { ...db.assignments[idx], ...req.body, updatedAt: Date.now() };
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version, record: db.assignments[idx] });
});

app.delete('/api/assignments/:id', (req, res) => {
  const id = req.params.id;
  db.assignments = db.assignments.filter((a) => a.id !== id);
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version });
});

// Members CRUD
app.post('/api/members', (req, res) => {
  const { name, id } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  const trimmed = name.trim();
  const existing = db.members.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    return res.json({ success: true, member: existing, version: db.version });
  }
  const member = {
    id: id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
  };
  db.members.push(member);
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, member, version: db.version });
});

app.delete('/api/members/:id', (req, res) => {
  const id = req.params.id;
  db.members = db.members.filter((m) => m.id !== id);
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, version: db.version });
});

// Budget CRUD
app.put('/api/budget', (req, res) => {
  db.budget = req.body;
  db.version++;
  db.updatedAt = Date.now();
  persistDb();
  res.json({ success: true, budget: db.budget, version: db.version });
});

// One Gemini key for this site. Saved once, then used by every browser.
const GEMINI_CONFIG_PATH = path.join(DATA_DIR, 'gemini-config.json');
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

type SharedGeminiConfig = { apiKey: string; model: string };

function readSharedGemini(): SharedGeminiConfig {
  let stored: SharedGeminiConfig = { apiKey: '', model: DEFAULT_GEMINI_MODEL };
  if (fs.existsSync(GEMINI_CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(GEMINI_CONFIG_PATH, 'utf-8'));
      if (typeof parsed?.apiKey === 'string') stored.apiKey = parsed.apiKey.trim();
      if (typeof parsed?.model === 'string' && parsed.model.trim()) stored.model = parsed.model.trim();
    } catch (e) {
      console.error('Could not read shared Gemini config:', e);
    }
  }
  if (!stored.apiKey) stored.apiKey = (process.env.GEMINI_API_KEY || '').trim();
  return stored;
}

function writeSharedGemini(config: SharedGeminiConfig) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = GEMINI_CONFIG_PATH + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf-8');
  fs.renameSync(tempPath, GEMINI_CONFIG_PATH);
}

app.get('/api/gemini/config', (_req, res) => {
  const config = readSharedGemini();
  res.json({ apiKey: config.apiKey, model: config.model, shared: Boolean(config.apiKey) });
});

app.put('/api/gemini/config', (req, res) => {
  const current = readSharedGemini();
  const apiKey = String(req.body?.apiKey ?? '').trim();
  const model = String(req.body?.model ?? current.model).trim() || DEFAULT_GEMINI_MODEL;
  writeSharedGemini({ apiKey, model });
  res.json({ success: true, apiKey, model, shared: Boolean(apiKey) });
});

// Gemini Assistant Server-side Proxy
app.post('/api/gemini/chat', async (req, res) => {
  const shared = readSharedGemini();
  const apiKey = (shared.apiKey || (req.headers['x-gemini-key'] as string) || '').trim();
  if (!apiKey) {
    return res.status(400).json({ error: 'No Gemini API key available on server or client' });
  }

  const { history, userMessage, model = 'gemini-3.5-flash-lite', systemInstruction } = req.body;
  const contents = [
    ...(history || []).map((t: any) => ({
      role: t.role === 'user' ? 'user' : 'model',
      parts: [{ text: t.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  try {
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(googleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini error' });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';
    res.json({ success: true, text, modelUsed: model });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error calling Gemini' });
  }
});

// --- VITE DEV / PRODUCTION MIDDLEWARE ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Spiti Tour 2026 Universal Cloud Server running at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
