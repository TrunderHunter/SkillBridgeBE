import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/error.middleware';
import routes from './routes/index';

const app = express();

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8000',
    credentials: true, // Allow cookies
  })
);

// Cookie parser
app.use(cookieParser());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Health check root route
app.get('/', (req, res) => {
  res.json({
    message: `${process.env.SMTP_PASS || 'SkillBridge'} API is running`,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(errorHandler);

export default app;
