import path from 'path';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import methodOverride from 'method-override';
import expressLayouts from 'express-ejs-layouts';
import { fileURLToPath } from 'url';

import { initDatabase, getUserById, seedDemoData } from './src/db.js';
import authRouter from './src/routes/auth.js';
import servicesRouter from './src/routes/services.js';
import engagementsRouter from './src/routes/engagements.js';
import dashboardRouter from './src/routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Init DB (top-level await since ESM)
await initDatabase();
seedDemoData();

// View engine
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'very-secure-secret-change',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);
app.use(flash());

// Expose user and flashes to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId
    ? getUserById(req.session.userId)
    : null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/', authRouter);
app.use('/services', servicesRouter);
app.use('/engagements', engagementsRouter);
app.use('/dashboard', dashboardRouter);

// Home
app.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

// 404
app.use((req, res) => {
  res.status(404).render('not-found', { title: 'Not Found' });
});

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

function startServer(port, retries = 5) {
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && retries > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use, retrying on ${nextPort}...`);
      setTimeout(() => startServer(nextPort, retries - 1), 200);
    } else {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  });
}

startServer(DEFAULT_PORT);


