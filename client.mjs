import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const HTTPSockClient = require('./client');
export default HTTPSockClient;
