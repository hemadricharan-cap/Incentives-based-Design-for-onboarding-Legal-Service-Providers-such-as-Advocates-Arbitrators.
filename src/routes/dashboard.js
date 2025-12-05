import express from 'express';
import { providerEarnings, providerPayouts, listServicesByProvider, listEngagementsForClient } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

router.get('/', requireAuth, (req, res) => {
  const user = res.locals.currentUser;
  if (user.role === 'provider') {
    const earnings = providerEarnings(user.id);
    const payouts = providerPayouts(user.id);
    const services = listServicesByProvider(user.id);
    res.render('dashboard', { user, earnings, payouts, services, clientEngagements: [] });
  } else {
    const clientEngagements = listEngagementsForClient(user.id);
    res.render('dashboard', { user, earnings: 0, payouts: [], services: [], clientEngagements });
  }
});

export default router;


