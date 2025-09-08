# SkillBridge Backend API

A modern backend API built with Node.js, TypeScript, Express, and MongoDB.

## Features

- ✅ TypeScript support
- ✅ Express.js framework
- ✅ MongoDB with Mongoose
- ✅ JWT Authentication
- ✅ Input validation with Joi
- ✅ Error handling middleware
- ✅ Logging with Winston
- ✅ Security with Helmet
- ✅ CORS support
- ✅ Rate limiting
- ✅ File upload support
- ✅ Testing with Jest
- ✅ Code linting with ESLint
- ✅ Code formatting with Prettier

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middlewares/     # Custom middlewares
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
├── validators/      # Input validation schemas
├── repositories/    # Data access layer
└── interfaces/      # TypeScript interfaces
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration

5. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start the production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint the code
- `npm run lint:fix` - Fix linting errors
- `npm run format` - Format code with Prettier

## API Endpoints

### Health Check
- `GET /` - API status
- `GET /api/v1/health` - Health check

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if necessary
5. Run tests and linting
6. Submit a pull request

## License

This project is licensed under the MIT License.
