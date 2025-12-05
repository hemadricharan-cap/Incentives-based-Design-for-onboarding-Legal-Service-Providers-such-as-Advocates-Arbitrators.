import express from 'express';
import { createService, listServices, listServicesByProvider, getServiceById } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

router.get('/', (req, res) => {
  const services = listServices();
  res.render('services/index', { services });
});

router.get('/new', requireAuth, (req, res) => {
  res.render('services/new');
});

router.post('/', requireAuth, (req, res) => {
  const { title, description, baseRate, incentiveType, incentiveDetails } = req.body;
  if (!title || !description || !baseRate || !incentiveType) {
    req.flash('error', 'All fields are required');
    return res.redirect('/services/new');
  }
  createService({
    providerId: req.session.userId,
    title,
    description,
    baseRate: parseFloat(baseRate),
    incentiveType,
    incentiveDetails
  });
  req.flash('success', 'Service created');
  res.redirect('/services');
});

router.get('/mine', requireAuth, (req, res) => {
  const services = listServicesByProvider(req.session.userId);
  res.render('services/mine', { services });
});

router.get('/:id', (req, res) => {
  const service = getServiceById(req.params.id);
  if (!service) return res.status(404).render('not-found');
  res.render('services/show', { service });
});

export default router;


