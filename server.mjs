import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const HTTPSockServer = require('./server');
export default HTTPSockServer;
