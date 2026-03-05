# Design Document: Post Comments Feature

## Overview

This design document specifies the technical implementation for adding comment functionality to posts in the micro-blogging social media application. The feature enables authenticated users to create, view, and delete comments on posts, fostering richer conversations and engagement within the platform.

The comment system integrates seamlessly with the existing serverless architecture, leveraging AWS Lambda for business logic, DynamoDB for data persistence, and API Gateway for RESTful endpoints. The frontend React application will display comments inline within the feed, providing an intuitive user experience without requiring navigation away from the main content stream.

### Key Design Goals

- Maintain consistency with existing architectural patterns (Lambda per operation, withAuth middleware, DynamoDB queries)
- Ensure data integrity between posts and comments through proper referential relationships
- Provide real-time feedback in the UI for comment operations
- Support chronological ordering of comments (oldest first) for natural conversation flow
- Implement proper authorization to ensure users can only delete their own comments

## Architecture

### System Components

The comment system consists of three primary layers:

1. **Backend Layer**: Three Lambda functions handling comment operations (create, retrieve, delete)
2. **Data Layer**: DynamoDB CommentsTable with GSI for efficient post-based queries
3. **Frontend Layer**: React components for comment display and interaction within the Feed

### Data Flow

**Comment Creation Flow**:
1. User submits comment text via frontend input field
2. Frontend calls POST /posts/{postId}/comments with authentication token
3. API Gateway routes request to createComment Lambda
4. withAuth middleware validates token and extracts user identity
5. Lambda validates comment text (length, non-empty)
6. Lambda creates comment record in CommentsTable with generated UUID
7. Lambda increments post's commentsCount in PostsTable
8. Lambda returns complete comment object to frontend
9. Frontend updates UI to display new comment and clears input field

**Comment Retrieval Flow**:
1. Frontend requests comments when post is expanded or feed loads
2. Frontend calls GET /posts/{postId}/comments (no auth required for read)
3. API Gateway routes request to getComments Lambda
4. Lambda queries CommentsTable using postId-index GSI
5. Lambda sorts results by createdAt ascending (oldest first)
6. Lambda enriches comment data with username from UsersTable
7. Lambda returns comment array to frontend
8. Frontend renders comments in chronological order

**Comment Deletion Flow**:
1. User clicks delete button on their own comment
2. Frontend calls DELETE /comments/{commentId} with authentication token
3. API Gateway routes request to deleteComment Lambda
4. withAuth middleware validates token and extracts user identity
5. Lambda retrieves comment from CommentsTable to verify ownership
6. Lambda checks if authenticated user matches comment userId
7. If authorized, Lambda deletes comment from CommentsTable
8. Lambda decrements post's commentsCount in PostsTable
9. Lambda returns success response
10. Frontend removes comment from UI

### Integration Points

- **PostsTable**: Comments increment/decrement the commentsCount field on posts
- **UsersTable**: Comment author usernames are fetched for display
- **AuthContext**: Frontend uses existing authentication state for API calls
- **Feed Component**: Comments are displayed inline within post cards
- **API Service**: New commentsApi namespace added to services/api.ts

## Components and Interfaces

### Backend Lambda Functions

#### 1. createComment Lambda

**Location**: `backend/src/functions/comments/createComment.js`

**Purpose**: Create a new comment on a post

**Handler Signature**:
```javascript
const handler = async (event) => {
  // event.user.id and event.user.username provided by withAuth middleware
  // event.pathParameters.postId from API Gateway
  // event.body contains { text }
  // Returns: { statusCode: 201, body: { comment } }
}
exports.handler = withAuth(handler);
```

**Input Validation**:
- Comment text must not be empty or whitespace-only
- Comment text must not exceed 500 characters
- postId must be provided in path parameters

**Database Operations**:
1. Generate unique comment ID using uuid v4
2. Create comment record in CommentsTable with fields:
   - id (string): Unique identifier
   - postId (string): Reference to parent post
   - userId (string): Comment author ID
   - username (string): Comment author username
   - text (string): Comment content
   - createdAt (string): ISO 8601 timestamp
3. Update PostsTable to increment commentsCount for the post

**Response Format**:
```json
{
  "statusCode": 201,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": {
    "message": "Comment created successfully",
    "comment": {
      "id": "uuid",
      "postId": "post-uuid",
      "userId": "user-uuid",
      "username": "username",
      "text": "comment text",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses**:
- 400: Missing or invalid comment text
- 401: Missing or invalid authentication token
- 500: Database operation failure

#### 2. getComments Lambda

**Location**: `backend/src/functions/comments/getComments.js`

**Purpose**: Retrieve all comments for a specific post

**Handler Signature**:
```javascript
const handler = async (event) => {
  // event.pathParameters.postId from API Gateway
  // No authentication required (public read)
  // Returns: { statusCode: 200, body: { comments: [] } }
}
exports.handler = handler; // No withAuth wrapper
```

**Database Operations**:
1. Query CommentsTable using postId-index GSI
2. Sort results by createdAt in ascending order (DynamoDB sort key)
3. Return all matching comments (no pagination for MVP)

**Response Format**:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": {
    "comments": [
      {
        "id": "uuid",
        "postId": "post-uuid",
        "userId": "user-uuid",
        "username": "username",
        "text": "comment text",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**:
- 500: Database operation failure

#### 3. deleteComment Lambda

**Location**: `backend/src/functions/comments/deleteComment.js`

**Purpose**: Delete a comment (author only)

**Handler Signature**:
```javascript
const handler = async (event) => {
  // event.user.id provided by withAuth middleware
  // event.pathParameters.commentId from API Gateway
  // Returns: { statusCode: 200, body: { message } }
}
exports.handler = withAuth(handler);
```

**Authorization Logic**:
1. Retrieve comment from CommentsTable by commentId
2. Compare comment.userId with event.user.id
3. If mismatch, return 403 Forbidden
4. If match, proceed with deletion

**Database Operations**:
1. Get comment from CommentsTable to verify ownership and get postId
2. Delete comment from CommentsTable
3. Update PostsTable to decrement commentsCount for the post

**Response Format**:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": {
    "message": "Comment deleted successfully"
  }
}
```

**Error Responses**:
- 401: Missing or invalid authentication token
- 403: User is not the comment author
- 404: Comment not found
- 500: Database operation failure

### Frontend Components

#### 1. CommentSection Component

**Location**: `frontend/src/components/CommentSection.tsx`

**Purpose**: Display comments and comment input for a post

**Props**:
```typescript
interface CommentSectionProps {
  postId: string;
  initialCommentsCount: number;
  isAuthenticated: boolean;
  currentUserId?: string;
}
```

**State Management**:
- `comments`: Array of Comment objects
- `commentText`: Current input field value
- `isLoading`: Loading state for API operations
- `isExpanded`: Whether comments are visible
- `error`: Error message for display

**Behavior**:
- Lazy load comments when user expands the section
- Display comment count badge
- Show/hide comments on toggle
- Handle comment submission with loading state
- Clear input field after successful submission
- Display error messages for failed operations
- Show delete button only for user's own comments

#### 2. CommentItem Component

**Location**: `frontend/src/components/CommentItem.tsx`

**Purpose**: Render individual comment with metadata

**Props**:
```typescript
interface CommentItemProps {
  comment: Comment;
  canDelete: boolean;
  onDelete: (commentId: string) => Promise<void>;
}
```

**Display Elements**:
- Username (clickable link to profile)
- Comment text
- Relative timestamp (e.g., "2 hours ago")
- Delete button (conditional on canDelete prop)

### Frontend API Service

**Location**: `frontend/src/services/api.ts`

**New Export**: `commentsApi` namespace

```typescript
export const commentsApi = {
  createComment: async (
    postId: string,
    text: string,
    token: string
  ): Promise<{ comment: Comment }> => {
    const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });
    return handleResponse(response);
  },

  getComments: async (postId: string): Promise<{ comments: Comment[] }> => {
    const response = await fetch(`${API_URL}/posts/${postId}/comments`);
    return handleResponse(response);
  },

  deleteComment: async (
    commentId: string,
    token: string
  ): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};
```

### TypeScript Type Definitions

**Location**: `frontend/src/types/comment.ts`

```typescript
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}
```

## Data Models

### CommentsTable Schema

**Table Name**: CommentsTable (already exists in infrastructure)

**Primary Key**:
- Partition Key: `id` (string) - Unique comment identifier

**Global Secondary Index**: postId-index
- Partition Key: `postId` (string) - Post identifier
- Sort Key: `createdAt` (string) - ISO 8601 timestamp

**Attributes**:
- `id` (string, required): UUID v4 generated identifier
- `postId` (string, required): Reference to parent post
- `userId` (string, required): Comment author's user ID
- `username` (string, required): Comment author's username (denormalized for performance)
- `text` (string, required): Comment content (max 500 characters)
- `createdAt` (string, required): ISO 8601 timestamp of creation

**Access Patterns**:
1. Get comment by ID: Query by primary key `id`
2. Get all comments for a post: Query postId-index with `postId`, sorted by `createdAt` ascending
3. Delete comment by ID: Delete by primary key `id`

**Denormalization Strategy**:
The `username` field is denormalized from UsersTable to avoid additional queries when displaying comments. This is acceptable because:
- Usernames change infrequently
- Comment display performance is critical for user experience
- The tradeoff favors read performance over write complexity

### PostsTable Updates

**Modified Attribute**:
- `commentsCount` (number): Count of comments on the post

**Update Operations**:
- Increment by 1 when comment is created
- Decrement by 1 when comment is deleted

**Consistency Considerations**:
The commentsCount is eventually consistent. In rare cases of Lambda failures, the count may be inaccurate. This is acceptable for the MVP as:
- The impact is minimal (display-only metric)
- Comments are still retrievable via query
- A background reconciliation job could be added later if needed

## API Endpoints

### POST /posts/{postId}/comments

**Purpose**: Create a new comment on a post

**Authentication**: Required (withAuth middleware)

**Path Parameters**:
- `postId` (string): The post to comment on

**Request Body**:
```json
{
  "text": "Comment content"
}
```

**Success Response** (201 Created):
```json
{
  "message": "Comment created successfully",
  "comment": {
    "id": "comment-uuid",
    "postId": "post-uuid",
    "userId": "user-uuid",
    "username": "username",
    "text": "Comment content",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses**:
- 400 Bad Request: Invalid or missing text
- 401 Unauthorized: Missing or invalid token
- 500 Internal Server Error: Database failure

### GET /posts/{postId}/comments

**Purpose**: Retrieve all comments for a post

**Authentication**: Not required (public read)

**Path Parameters**:
- `postId` (string): The post to get comments for

**Success Response** (200 OK):
```json
{
  "comments": [
    {
      "id": "comment-uuid",
      "postId": "post-uuid",
      "userId": "user-uuid",
      "username": "username",
      "text": "Comment content",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses**:
- 500 Internal Server Error: Database failure

### DELETE /comments/{commentId}

**Purpose**: Delete a comment (author only)

**Authentication**: Required (withAuth middleware)

**Path Parameters**:
- `commentId` (string): The comment to delete

**Success Response** (200 OK):
```json
{
  "message": "Comment deleted successfully"
}
```

**Error Responses**:
- 401 Unauthorized: Missing or invalid token
- 403 Forbidden: User is not the comment author
- 404 Not Found: Comment does not exist
- 500 Internal Server Error: Database failure

## Infrastructure Changes

### CDK Stack Modifications

**File**: `infrastructure/lib/app-stack.ts`

**Changes Required**:

1. **Create Lambda Functions**:
```typescript
// Lambda function for creating comments
const createCommentFunction = new lambda.Function(this, 'CreateCommentFunction', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'createComment.handler',
  code: lambda.Code.fromAsset(getLambdaPackagePath('createComment')),
  environment: {
    COMMENTS_TABLE: this.commentsTable.tableName,
    POSTS_TABLE: this.postsTable.tableName,
    USERS_TABLE: this.usersTable.tableName
  }
});

// Lambda function for getting comments
const getCommentsFunction = new lambda.Function(this, 'GetCommentsFunction', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'getComments.handler',
  code: lambda.Code.fromAsset(getLambdaPackagePath('getComments')),
  environment: {
    COMMENTS_TABLE: this.commentsTable.tableName
  }
});

// Lambda function for deleting comments
const deleteCommentFunction = new lambda.Function(this, 'DeleteCommentFunction', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'deleteComment.handler',
  code: lambda.Code.fromAsset(getLambdaPackagePath('deleteComment')),
  environment: {
    COMMENTS_TABLE: this.commentsTable.tableName,
    POSTS_TABLE: this.postsTable.tableName,
    USERS_TABLE: this.usersTable.tableName
  }
});
```

2. **Grant IAM Permissions**:
```typescript
// Grant permissions for comment operations
this.commentsTable.grantReadWriteData(createCommentFunction);
this.postsTable.grantReadWriteData(createCommentFunction);
this.usersTable.grantReadData(createCommentFunction);

this.commentsTable.grantReadData(getCommentsFunction);

this.commentsTable.grantReadWriteData(deleteCommentFunction);
this.postsTable.grantReadWriteData(deleteCommentFunction);
this.usersTable.grantReadData(deleteCommentFunction);
```

3. **Add API Gateway Routes**:
```typescript
// Comment endpoints
const postComments = postId.addResource('comments');
postComments.addMethod('POST', new apigateway.LambdaIntegration(createCommentFunction));
postComments.addMethod('GET', new apigateway.LambdaIntegration(getCommentsFunction));

const comments = this.api.root.addResource('comments');
const commentId = comments.addResource('{commentId}');
commentId.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCommentFunction));
```

**Note**: The CommentsTable already exists in the infrastructure, so no table creation is needed.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Comment Creation Completeness

*For any* authenticated user, valid post ID, and valid comment text (non-empty, ≤500 characters), creating a comment should produce a complete comment object containing all required fields: a unique id, the correct postId, the user's userId, the user's username, the submitted text, and a createdAt timestamp in ISO 8601 format.

**Validates: Requirements 1.1, 1.2, 1.3, 1.6, 7.2, 7.3, 7.4**

### Property 2: Whitespace Rejection

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), attempting to create a comment with that text should be rejected with a validation error, and no comment record should be created.

**Validates: Requirements 1.5**

### Property 3: Comment Retrieval Completeness

*For any* post with comments, retrieving comments for that post should return all comments associated with the postId, and each comment should contain all required fields: id, postId, userId, username, text, and createdAt.

**Validates: Requirements 2.1, 2.3, 2.5**

### Property 4: Chronological Ordering

*For any* post with multiple comments, retrieving comments should return them sorted by createdAt in ascending order (oldest first), such that for any two adjacent comments in the result, the first comment's createdAt is less than or equal to the second comment's createdAt.

**Validates: Requirements 2.2, 4.4**

### Property 5: Deletion Authorization

*For any* comment, attempting to delete it should succeed if and only if the authenticated user's ID matches the comment's userId. When the user is the author, the comment should be removed from the database. When the user is not the author, the system should return a 403 Forbidden error.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Comment ID Uniqueness

*For any* set of comments created in the system, each comment should have a unique id value, such that no two comments share the same identifier.

**Validates: Requirements 7.1**

### Property 7: Round-Trip Persistence

*For any* valid comment object, creating the comment and then immediately retrieving it should produce an equivalent object with the same id, postId, userId, username, text, and createdAt values.

**Validates: Requirements 7.5**

### Property 8: Authentication Requirements

*For any* POST or DELETE request to comment endpoints without a valid authentication token, the system should return a 401 Unauthorized error. For any GET request to retrieve comments, the system should succeed regardless of authentication status.

**Validates: Requirements 6.4, 6.5**

### Property 9: HTTP Status Code Correctness

*For any* API operation, the system should return the semantically correct HTTP status code: 200 for successful retrieval/deletion, 201 for successful creation, 400 for validation errors, 401 for authentication failures, 403 for authorization failures, 404 for non-existent resources, and 500 for server errors.

**Validates: Requirements 6.6**

### Property 10: CORS Headers Presence

*For any* API response from comment endpoints, the response should include the required CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Credentials, and Content-Type.

**Validates: Requirements 6.7**

### Property 11: Comment Count Display

*For any* post displayed in the feed, the UI should show the post's commentsCount value, and this value should match the actual number of comments associated with that post.

**Validates: Requirements 4.1**

### Property 12: Comment Expansion Behavior

*For any* post in the feed, when a user triggers the expand comments action, the system should fetch and display all comments for that post, and the displayed comments should match the comments returned by the API.

**Validates: Requirements 4.2**

### Property 13: Comment Display Completeness

*For any* comment displayed in the UI, the rendered output should include the comment author's username and the creation timestamp.

**Validates: Requirements 4.3**

### Property 14: Delete Button Visibility

*For any* comment displayed to an authenticated user, the delete button should be visible if and only if the comment's userId matches the current user's ID.

**Validates: Requirements 4.5**

### Property 15: Authenticated Input Field Visibility

*For any* post displayed in the feed, comment input fields should be visible if and only if the user is authenticated.

**Validates: Requirements 5.1, 5.2**

### Property 16: Submit Button Disabled During Submission

*For any* comment submission in progress, the submit button should be disabled, and it should be re-enabled once the submission completes (either successfully or with an error).

**Validates: Requirements 5.4**

### Property 17: Successful Submission UI Update

*For any* successful comment submission, the input field should be cleared to an empty string, and the new comment should appear in the displayed comment list.

**Validates: Requirements 5.5**

### Property 18: Failed Submission Error Display

*For any* failed comment submission, an error message should be displayed to the user indicating the failure.

**Validates: Requirements 5.6**

## Error Handling

### Backend Error Handling

All Lambda functions follow a consistent error handling pattern:

1. **Input Validation Errors** (400 Bad Request):
   - Missing required fields (text, postId, commentId)
   - Empty or whitespace-only comment text
   - Comment text exceeding 500 characters
   - Invalid path parameters

2. **Authentication Errors** (401 Unauthorized):
   - Missing Authorization header
   - Invalid or expired JWT token
   - Token validation failure with Cognito

3. **Authorization Errors** (403 Forbidden):
   - User attempting to delete another user's comment
   - Verified by comparing event.user.id with comment.userId

4. **Not Found Errors** (404 Not Found):
   - Comment ID does not exist in CommentsTable
   - Returned when attempting to delete non-existent comment

5. **Server Errors** (500 Internal Server Error):
   - DynamoDB operation failures
   - Unexpected exceptions during processing
   - Missing environment variables

**Error Response Format**:
All errors return a consistent JSON structure:
```json
{
  "message": "Human-readable error description",
  "error": "Technical error details (optional)"
}
```

**Logging Strategy**:
- All errors are logged to CloudWatch with `console.error()`
- Include error stack traces for debugging
- Log authentication attempts for security monitoring
- Log database operation failures with operation details

### Frontend Error Handling

**API Call Error Handling**:
- All API calls use the `handleResponse` helper which throws errors for non-2xx responses
- Errors are caught in component try-catch blocks
- Error messages are extracted from response JSON or use fallback messages

**User-Facing Error Messages**:
- "Failed to load comments" - Comment retrieval failure
- "Failed to post comment" - Comment creation failure
- "Failed to delete comment" - Comment deletion failure
- "Comment cannot be empty" - Client-side validation failure
- "Comment is too long (max 500 characters)" - Client-side validation failure

**Error State Management**:
- Components maintain `error` state variable for display
- Errors are cleared when user retries the operation
- Error messages are displayed inline near the relevant UI element

**Network Error Handling**:
- Fetch failures (network errors) are caught and displayed as "Network error. Please try again."
- Timeout handling relies on browser default fetch timeout
- No automatic retry logic (user must manually retry)

### Graceful Degradation

**Comment Loading Failures**:
- If comments fail to load, show error message but keep post visible
- User can retry loading comments via refresh button
- Feed remains functional even if individual comment sections fail

**Comment Creation Failures**:
- Input field retains user's text on failure
- User can edit and resubmit without losing their work
- Error message explains what went wrong

**Comment Deletion Failures**:
- Comment remains visible in UI if deletion fails
- User can retry deletion
- Error message indicates the failure

## Testing Strategy

### Dual Testing Approach

The comment feature will be validated using both unit tests and property-based tests, which are complementary and necessary for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

### Unit Testing

Unit tests focus on specific scenarios and integration points:

**Backend Unit Tests** (Jest):
- Specific example: Creating a comment with valid 100-character text
- Specific example: Retrieving comments for a post with 3 comments
- Specific example: Deleting a comment as the author
- Edge case: Empty comment text returns 400
- Edge case: Comment text with exactly 500 characters succeeds
- Edge case: Comment text with 501 characters returns 400
- Edge case: Retrieving comments for post with no comments returns empty array
- Edge case: Deleting non-existent comment returns 404
- Error condition: Missing Authorization header returns 401
- Error condition: Deleting another user's comment returns 403
- Integration: Comment creation increments post's commentsCount
- Integration: Comment deletion decrements post's commentsCount

**Frontend Unit Tests** (Vitest + React Testing Library):
- Specific example: Rendering a comment with username and timestamp
- Specific example: Submitting a comment updates the UI
- Edge case: Delete button only visible for user's own comments
- Edge case: Comment input only visible when authenticated
- Error condition: Failed comment creation displays error message
- Integration: CommentSection fetches comments on expand
- Integration: Successful deletion removes comment from UI

### Property-Based Testing

Property-based tests verify universal properties across randomized inputs. The implementation will use **fast-check** for JavaScript/TypeScript property-based testing.

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with comment referencing design property
- Tag format: `// Feature: post-comments, Property {number}: {property_text}`

**Backend Property Tests** (Jest + fast-check):

1. **Property 1: Comment Creation Completeness**
   - Generate: Random valid comment text (1-500 chars), random user IDs, random post IDs
   - Verify: Created comment contains all required fields with correct values
   - Tag: `// Feature: post-comments, Property 1: Comment creation produces complete object`

2. **Property 2: Whitespace Rejection**
   - Generate: Random strings of whitespace characters (spaces, tabs, newlines)
   - Verify: All are rejected with 400 status
   - Tag: `// Feature: post-comments, Property 2: Whitespace-only text rejected`

3. **Property 3: Comment Retrieval Completeness**
   - Generate: Random posts with random numbers of comments (0-20)
   - Verify: All comments retrieved and contain all required fields
   - Tag: `// Feature: post-comments, Property 3: Retrieval returns complete comments`

4. **Property 4: Chronological Ordering**
   - Generate: Random sets of comments with random timestamps
   - Verify: Retrieved comments are sorted by createdAt ascending
   - Tag: `// Feature: post-comments, Property 4: Comments sorted chronologically`

5. **Property 5: Deletion Authorization**
   - Generate: Random comments and random user IDs (matching and non-matching)
   - Verify: Deletion succeeds only when user ID matches comment author
   - Tag: `// Feature: post-comments, Property 5: Only authors can delete comments`

6. **Property 6: Comment ID Uniqueness**
   - Generate: Random batches of comments (10-50 per batch)
   - Verify: All generated IDs are unique within the batch
   - Tag: `// Feature: post-comments, Property 6: Comment IDs are unique`

7. **Property 7: Round-Trip Persistence**
   - Generate: Random valid comment objects
   - Verify: Create then retrieve returns equivalent object
   - Tag: `// Feature: post-comments, Property 7: Comment round-trip preserves data`

8. **Property 8: Authentication Requirements**
   - Generate: Random requests with and without auth tokens
   - Verify: POST/DELETE require auth, GET does not
   - Tag: `// Feature: post-comments, Property 8: Auth required for mutations`

9. **Property 9: HTTP Status Code Correctness**
   - Generate: Random valid and invalid requests
   - Verify: Correct status codes returned for each scenario
   - Tag: `// Feature: post-comments, Property 9: Correct HTTP status codes`

10. **Property 10: CORS Headers Presence**
    - Generate: Random requests to all comment endpoints
    - Verify: All responses include required CORS headers
    - Tag: `// Feature: post-comments, Property 10: CORS headers present`

**Frontend Property Tests** (Vitest + fast-check):

11. **Property 11: Comment Count Display**
    - Generate: Random posts with random comment counts
    - Verify: Displayed count matches actual count
    - Tag: `// Feature: post-comments, Property 11: Comment count displayed correctly`

12. **Property 13: Comment Display Completeness**
    - Generate: Random comments with various usernames and timestamps
    - Verify: Rendered output includes username and timestamp
    - Tag: `// Feature: post-comments, Property 13: Comments display username and time`

14. **Property 14: Delete Button Visibility**
    - Generate: Random comments and random current user IDs
    - Verify: Delete button visible only when IDs match
    - Tag: `// Feature: post-comments, Property 14: Delete button conditional visibility`

15. **Property 15: Authenticated Input Field Visibility**
    - Generate: Random authentication states (authenticated/unauthenticated)
    - Verify: Input fields visible only when authenticated
    - Tag: `// Feature: post-comments, Property 15: Input fields require authentication`

**Note on UI Properties**: Properties 12, 16, 17, and 18 involve complex UI interactions and async state management that are better suited for integration tests or E2E tests rather than pure property-based tests. These will be covered by unit tests with specific examples.

### Test Organization

**Backend Tests**:
- Location: `backend/src/functions/comments/__tests__/`
- Files: `createComment.test.js`, `getComments.test.js`, `deleteComment.test.js`
- Each file contains both unit tests and property-based tests

**Frontend Tests**:
- Location: `frontend/src/components/__tests__/`
- Files: `CommentSection.test.tsx`, `CommentItem.test.tsx`
- Each file contains both unit tests and property-based tests

### Test Data Generation

**fast-check Generators**:
```typescript
// Valid comment text (1-500 characters)
const validCommentText = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

// Whitespace-only strings
const whitespaceString = fc.string()
  .filter(s => s.length > 0 && s.trim().length === 0);

// UUID v4 format
const uuid = fc.uuid();

// ISO 8601 timestamp
const isoTimestamp = fc.date().map(d => d.toISOString());

// Comment object
const comment = fc.record({
  id: uuid,
  postId: uuid,
  userId: uuid,
  username: fc.string({ minLength: 3, maxLength: 20 }),
  text: validCommentText,
  createdAt: isoTimestamp
});
```

### Continuous Integration

- All tests run on every commit via CI pipeline
- Property-based tests run with 100 iterations in CI
- Test failures block deployment
- Coverage reports generated and tracked over time
- Target: >80% code coverage for comment-related code

