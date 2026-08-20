import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { leadsRouter } from './routes/leads';
import { errorHandler } from './middleware/error-handler';
import { HttpStatus } from './constants/http';
import { ErrorMessage } from './constants/messages';
import { swaggerDocument } from './swagger';

export const app = express();

app.use(express.json());

// Root route
app.get('/', (_req, res) => {
  res.json({
    status: 'success',
    message: 'Lead Query API is running',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'lead-query-api' });
});

app.use('/api/v1/leads', leadsRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((_req, res) => {
  res.status(HttpStatus.NOT_FOUND).json({
    message: ErrorMessage.ROUTE_NOT_FOUND,
    statusCode: HttpStatus.NOT_FOUND,
  });
});

app.use(errorHandler);

export default app;