import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const HTTPSockBroadcast = require('./broadcast');
export default HTTPSockBroadcast;
