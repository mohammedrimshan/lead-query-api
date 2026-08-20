import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';


const specPath = path.resolve(__dirname, '..', 'openapi.yaml');
const specContent = fs.readFileSync(specPath, 'utf8');

export const swaggerDocument = yaml.load(specContent) as object;
