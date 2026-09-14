import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  pharmacyCreateSchema,
  pharmacyUpdateSchema,
  type PharmacyCreateInput,
  type PharmacyUpdateInput
} from '../schemas/pharmacy.js';

export const pharmaciesRouter = Router();

const pharmacySelect = {
  id: true,
  name: true,
  description: true,
  address: true,
  cp: true,
  lat: true,
  lng: true,
  phone: true,
  imageUrl: true
} as const;

pharmaciesRouter.get('/', async (req, res) => {
  try {
    const cp =
      typeof req.query.cp === 'string' ? req.query.cp.trim() : undefined;

    const pharmacies = await prisma.pharmacy.findMany({
      where: cp ? { cp } : undefined,
      select: pharmacySelect,
      orderBy: { name: 'asc' }
    });

    res.json(pharmacies);
  } catch (error) {
    console.error('listPharmacies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// * Para busquedas
pharmaciesRouter.get('/:id', async (req, res) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: req.params.id },
      select: pharmacySelect
    });

    if (!pharmacy) {
      res.status(404).json({ error: 'Pharmacy not found' });
      return;
    }

    res.json(pharmacy);
  } catch (error) {
    console.error('getPharmacy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

pharmaciesRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(pharmacyCreateSchema),
  async (req, res) => {
    const body = req.body as PharmacyCreateInput;

    try {
      const pharmacy = await prisma.pharmacy.create({
        data: body,
        select: pharmacySelect
      });
      res.status(201).json(pharmacy);
    } catch (error) {
      console.error('createPharmacy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

pharmaciesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'PHARMACY'),
  validateBody(pharmacyUpdateSchema),
  async (req, res) => {
    const body = req.body as PharmacyUpdateInput;
    const user = req.user!;

    try {
      const existing = await prisma.pharmacy.findUnique({
        where: { id: req.params.id },
        select: { id: true }
      });

      if (!existing) {
        res.status(404).json({ error: 'Pharmacy not found' });
        return;
      }

      if (user.role === 'PHARMACY' && user.pharmacyId !== existing.id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const pharmacy = await prisma.pharmacy.update({
        where: { id: existing.id },
        data: body,
        select: pharmacySelect
      });

      res.json(pharmacy);
    } catch (error) {
      console.error('updatePharmacy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

pharmaciesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const existing = await prisma.pharmacy.findUnique({
        where: { id: req.params.id },
        select: { id: true }
      });

      if (!existing) {
        res.status(404).json({ error: 'Pharmacy not found' });
        return;
      }

      await prisma.pharmacy.delete({
        where: { id: existing.id }
      });

      res.json({ deleted: true });
    } catch (error) {
      console.error('deletePharmacy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);