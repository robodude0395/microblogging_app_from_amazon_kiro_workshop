# Project Structure

## Monorepo Organization

```
/
├── frontend/          # React SPA
├── backend/           # Lambda functions
├── infrastructure/    # AWS CDK stack
└── package.json       # Workspace root
```

## Frontend Structure

```
frontend/
├── src/
│   ├── components/    # Reusable UI components
│   ├── contexts/      # React contexts (AuthContext)
│   ├── pages/         # Route-level page components
│   ├── services/      # API client (api.ts)
│   ├── types/         # TypeScript type definitions
│   ├── App.tsx        # Main app component with routing
│   └── main.tsx       # Entry point
├── .env               # Environment variables (not in git)
├── .env.example       # Environment template
└── vite.config.ts     # Vite configuration
```

### Frontend Conventions

- Pages: One component per route (Login, Register, Feed, Profile, CreatePost)
- Layout: Shared Layout component wraps authenticated pages
- Protected Routes: ProtectedRoute wrapper checks authentication
- API calls: Centralized in `services/api.ts`
- Auth state: Managed via AuthContext provider

## Backend Structure

```
backend/
├── src/
│   ├── common/
│   │   └── middleware.js    # withAuth middleware
│   └── functions/
│       ├── auth/            # login.js, register.js
│       ├── posts/           # createPost, getPosts, likePost
│       ├── users/           # profile, follow/unfollow
│       └── monitoring/      # metrics
├── scripts/                 # Deployment scripts
└── dist/                    # Build output (gitignored)
```

### Backend Conventions

- One Lambda function per file
- CommonJS modules (require/module.exports)
- Middleware pattern: `withAuth()` wrapper for authenticated endpoints
- Response format: Always include CORS headers
- Error handling: Try-catch with 500 status codes
- Environment variables: Table names, Cognito IDs from CDK

### Lambda Function Pattern

```javascript
const { withAuth } = require('../../common/middleware');

const handler = async (event) => {
  // Access authenticated user via event.user.id
  // Return { statusCode, headers, body }
};

module.exports.handler = withAuth(handler);
```

## Infrastructure Structure

```
infrastructure/
├── lib/
│   └── app-stack.ts    # Main CDK stack definition
├── bin/                # CDK app entry point
└── cdk.json            # CDK configuration
```

### Infrastructure Conventions

- Single stack architecture (AppStack)
- Lambda packages: Expects zipped functions in `backend/dist/lambda-packages/`
- Outputs: CDK outputs match frontend .env variable names
- Removal policy: DESTROY for development (change for production)
- IAM: Least privilege - grant specific permissions per Lambda

## Database Schema

### DynamoDB Tables

- **UsersTable**: PK: id, GSI: username-index
- **PostsTable**: PK: id, GSI: userId-index (SK: createdAt)
- **LikesTable**: PK: userId, SK: postId, GSI: postId-index
- **CommentsTable**: PK: id, GSI: postId-index (SK: createdAt)
- **FollowsTable**: PK: followerId, SK: followeeId, GSI: followee-index

## API Structure

```
/auth
  POST /register
  POST /login
/users
  GET /{userId}              # Get profile
  PUT /{userId}              # Update profile
  POST /{userId}/follow
  POST /{userId}/unfollow
  GET /{userId}/following
  GET /{userId}/posts        # User's posts
/posts
  GET /                      # Feed
  POST /                     # Create post
  POST /{postId}/like
```

## Deployment Artifacts

- Frontend: Built to `frontend/dist/`, synced to S3
- Backend: Functions zipped individually in `backend/dist/lambda-packages/`
- Infrastructure: Synthesized CloudFormation in `infrastructure/cdk.out/`

## Key Files

- `DESIGN_LANGUAGE.md`: Complete design system and styling guide
- `.env.example`: Template for required environment variables
- `package.json`: Workspace scripts for common operations
