import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { queryLeads } from '../controllers/queryLeads';

export const leadsRouter = Router();

leadsRouter.post('/query', authMiddleware, queryLeads);

