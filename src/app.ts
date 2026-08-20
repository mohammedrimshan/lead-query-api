import express from 'express';
import { leadsRouter } from './routes/leads';
import { errorHandler } from './middleware/error-handler';
import { HttpStatus } from './constants/http';
import { ErrorMessage } from './constants/messages';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'lead-query-api' });
});

app.use('/api/v1/leads', leadsRouter);

app.use((_req, res) => {
  res.status(HttpStatus.NOT_FOUND).json({
    message: ErrorMessage.ROUTE_NOT_FOUND,
    statusCode: HttpStatus.NOT_FOUND,
  });
});

app.use(errorHandler);

export default app;