# Technology Stack

## Build System

Yarn workspaces monorepo with three packages: frontend, backend, and infrastructure.

## Frontend Stack

- React 18 with TypeScript
- Vite for build tooling and dev server
- React Router for navigation
- ESLint for code quality
- Playwright for E2E testing

## Backend Stack

- Node.js 22.x runtime (AWS Lambda)å
- JavaScript (CommonJS modules)
- AWS SDK v3 for AWS service interactions
- Jest for testing

## Infrastructure

- AWS CDK v2 with TypeScript
- CloudFormation for deployment

## Key AWS Services

- API Gateway: REST API endpoints
- Lambda: Serverless compute
- DynamoDB: NoSQL database with GSIs
- Cognito: User authentication and identity management
- S3: Frontend static hosting
- CloudFront: CDN for frontend distribution

## Common Commands

### Development
```bash
# Start frontend dev server
yarn start:frontend

# Build frontend
yarn build:frontend

# Build backend (copies src to dist, removes .ts files)
yarn build:backend
```

### Deployment
```bash
# Deploy infrastructure only
yarn deploy:infra

# Deploy frontend only
yarn deploy:frontend

# Invalidate CloudFront cache
yarn invalidate:cdn

# Full deployment (backend + infra + frontend + CDN invalidation)
yarn deploy
```

### Testing
```bash
# Frontend E2E tests
yarn workspace frontend test:e2e
yarn workspace frontend test:e2e:ui
yarn workspace frontend test:e2e:headed
```

### Infrastructure
```bash
# CDK commands
yarn workspace infrastructure cdk diff
yarn workspace infrastructure deploy
```

## Environment Configuration

Frontend requires `.env` file with AWS resource IDs:
- VITE_API_URL
- VITE_USER_POOL_ID
- VITE_USER_POOL_CLIENT_ID
- VITE_IDENTITY_POOL_ID

These values are output by CDK deployment.
