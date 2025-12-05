import express from 'express';
import {
  createEngagement,
  listEngagementsForClient,
  listEngagementsForProvider,
  getEngagementWithMilestones,
  completeMilestone,
  getServiceById
} from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

router.get('/', requireAuth, (req, res) => {
  const role = res.locals.currentUser?.role;
  if (role === 'provider') {
    const engagements = listEngagementsForProvider(req.session.userId);
    return res.render('engagements/index', { engagements, role });
  } else {
    const engagements = listEngagementsForClient(req.session.userId);
    return res.render('engagements/index', { engagements, role });
  }
});

router.get('/new/:serviceId', requireAuth, (req, res) => {
  const service = getServiceById(req.params.serviceId);
  if (!service) return res.status(404).render('not-found');
  res.render('engagements/new', { service });
});

router.get('/:id', requireAuth, (req, res) => {
  const data = getEngagementWithMilestones(parseInt(req.params.id, 10));
  if (!data) return res.status(404).render('not-found');
  const { engagement, milestones } = data;
  res.render('engagements/show', { engagement, milestones });
});

router.post('/', requireAuth, (req, res) => {
  const { serviceId } = req.body;
  const milestones = [];
  for (let i = 1; i <= 5; i++) {
    const title = req.body[`milestoneTitle${i}`];
    const amount = parseFloat(req.body[`milestoneAmount${i}`]);
    if (title && !isNaN(amount)) {
      milestones.push({ title, amount });
    }
  }
  if (milestones.length === 0) {
    req.flash('error', 'Please add at least one milestone');
    return res.redirect(`/engagements/new/${serviceId}`);
  }
  const id = createEngagement({ clientId: req.session.userId, serviceId: parseInt(serviceId, 10), milestones });
  req.flash('success', 'Engagement created');
  res.redirect(`/engagements/${id}`);
});

router.post('/milestones/:milestoneId/complete', requireAuth, (req, res) => {
  try {
    completeMilestone({ milestoneId: parseInt(req.params.milestoneId, 10) });
    req.flash('success', 'Milestone marked as completed and payout recorded');
  } catch (e) {
    req.flash('error', e.message);
  }
  res.redirect('back');
});

export default router;


