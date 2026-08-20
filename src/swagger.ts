import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

// Resolve the openapi.yaml relative to this file's location at runtime.
// __dirname is src/ (dev) or dist/ (after build), so we go up one level to
// the project root where openapi.yaml lives.
const specPath = path.resolve(__dirname, '..', 'openapi.yaml');
const specContent = fs.readFileSync(specPath, 'utf8');

export const swaggerDocument = yaml.load(specContent) as object;
