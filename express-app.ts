import express from 'express';
import cors from 'cors';
import { apiRouter, ensureAdminExists } from './api.js'; // Note .js for ESM
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

// SMS Routes
app.post('/api/sms/send', async (req, res) => {
  // ... copy from server.ts
});
