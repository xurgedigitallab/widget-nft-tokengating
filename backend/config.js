// backend/config.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Loaded MongoDB URI:', process.env.MONGODB_URI);

const config = {
  mongoURI: process.env.MONGODB_URI,
  homeserverUrl: process.env.HOMESERVER_URL,
  xrplServerUrl: process.env.XRPL_SERVER_URL,
  port: process.env.PORT || 3000
};

// Validate required config
const requiredConfig = ['mongoURI', 'homeserverUrl', 'xrplServerUrl'];
for (const key of requiredConfig) {
  if (!config[key]) {
    console.error(`Missing required config: ${key}`);
    console.error('Current config:', config);
    throw new Error(`Missing required config: ${key}`);
  }
}

export default config;