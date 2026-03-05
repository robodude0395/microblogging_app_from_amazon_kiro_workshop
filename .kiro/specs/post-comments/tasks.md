# Implementation Plan: Post Comments Feature

## Overview

This plan implements comment functionality for posts in the micro-blogging application. The implementation follows the existing serverless architecture with three Lambda functions (createComment, getComments, deleteComment), React components for UI (CommentSection, CommentItem), and DynamoDB for persistence. The CommentsTable already exists in the infrastructure. Tasks are organized to build incrementally, with property-based tests integrated throughout to validate correctness properties early.

## Tasks

- [x] 1. Set up backend comment functions structure and shared utilities
  - Create directory structure: `backend/src/functions/comments/`
  - Create placeholder files: `createComment.js`, `getComments.js`, `deleteComment.js`
  - Set up test directory: `backend/src/functions/comments/__tests__/`
  - Install fast-check for property-based testing: `yarn workspace backend add -D fast-check`
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 2. Implement createComment Lambda function
  - [x] 2.1 Write createComment handler with validation and database operations
    - Implement withAuth-wrapped handler that validates comment text (non-empty, ≤500 chars)
    - Generate UUID for comment ID
    - Create comment record in CommentsTable with all required fields (id, postId, userId, username, text, createdAt)
    - Increment commentsCount in PostsTable
    - Return 201 response with complete comment object
    - Handle errors: 400 for validation, 401 for auth, 500 for database failures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1, 6.4, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 2.2 Write property test for comment creation completeness
    - **Property 1: Comment Creation Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6, 7.2, 7.3, 7.4**
    - Generate random valid comment text (1-500 chars), user IDs, post IDs
    - Verify created comment contains all required fields with correct values

  - [ ]* 2.3 Write property test for whitespace rejection
    - **Property 2: Whitespace Rejection**
    - **Validates: Requirements 1.5**
    - Generate random whitespace-only strings
    - Verify all are rejected with 400 status

  - [ ]* 2.4 Write unit tests for createComment edge cases
    - Test empty text returns 400
    - Test exactly 500 characters succeeds
    - Test 501 characters returns 400
    - Test missing Authorization header returns 401
    - Test commentsCount increment on PostsTable
    - _Requirements: 1.4, 1.5, 6.4, 6.6_

- [ ] 3. Implement getComments Lambda function
  - [x] 3.1 Write getComments handler with query and sorting
    - Implement handler (no auth required) that queries CommentsTable using postId-index GSI
    - Sort results by createdAt ascending
    - Return 200 response with comments array
    - Handle errors: 500 for database failures
    - Include CORS headers in response
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2, 6.5, 6.6, 6.7_

  - [ ]* 3.2 Write property test for comment retrieval completeness
    - **Property 3: Comment Retrieval Completeness**
    - **Validates: Requirements 2.1, 2.3, 2.5**
    - Generate random posts with random numbers of comments (0-20)
    - Verify all comments retrieved and contain all required fields

  - [ ]* 3.3 Write property test for chronological ordering
    - **Property 4: Chronological Ordering**
    - **Validates: Requirements 2.2, 4.4**
    - Generate random sets of comments with random timestamps
    - Verify retrieved comments are sorted by createdAt ascending

  - [ ]* 3.4 Write unit tests for getComments edge cases
    - Test retrieving comments for post with no comments returns empty array
    - Test comments include all required fields (id, postId, userId, username, text, createdAt)
    - _Requirements: 2.4, 2.5_

- [ ] 4. Implement deleteComment Lambda function
  - [x] 4.1 Write deleteComment handler with authorization and database operations
    - Implement withAuth-wrapped handler that retrieves comment by commentId
    - Verify authenticated user ID matches comment userId (403 if not)
    - Delete comment from CommentsTable
    - Decrement commentsCount in PostsTable
    - Return 200 response with success message
    - Handle errors: 401 for auth, 403 for authorization, 404 for not found, 500 for database failures
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.3, 6.4, 6.6, 6.7_

  - [ ]* 4.2 Write property test for deletion authorization
    - **Property 5: Deletion Authorization**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Generate random comments and random user IDs (matching and non-matching)
    - Verify deletion succeeds only when user ID matches comment author

  - [ ]* 4.3 Write unit tests for deleteComment edge cases
    - Test deleting another user's comment returns 403
    - Test deleting non-existent comment returns 404
    - Test missing Authorization header returns 401
    - Test commentsCount decrement on PostsTable
    - _Requirements: 3.3, 3.5, 6.4, 6.6_

- [ ] 5. Write backend cross-cutting property tests
  - [ ]* 5.1 Write property test for comment ID uniqueness
    - **Property 6: Comment ID Uniqueness**
    - **Validates: Requirements 7.1**
    - Generate random batches of comments (10-50 per batch)
    - Verify all generated IDs are unique within the batch

  - [ ]* 5.2 Write property test for round-trip persistence
    - **Property 7: Round-Trip Persistence**
    - **Validates: Requirements 7.5**
    - Generate random valid comment objects
    - Verify create then retrieve returns equivalent object

  - [ ]* 5.3 Write property test for authentication requirements
    - **Property 8: Authentication Requirements**
    - **Validates: Requirements 6.4, 6.5**
    - Generate random requests with and without auth tokens
    - Verify POST/DELETE require auth, GET does not

  - [ ]* 5.4 Write property test for HTTP status code correctness
    - **Property 9: HTTP Status Code Correctness**
    - **Validates: Requirements 6.6**
    - Generate random valid and invalid requests
    - Verify correct status codes returned for each scenario

  - [ ]* 5.5 Write property test for CORS headers presence
    - **Property 10: CORS Headers Presence**
    - **Validates: Requirements 6.7**
    - Generate random requests to all comment endpoints
    - Verify all responses include required CORS headers

- [x] 6. Checkpoint - Ensure backend tests pass
  - Ensure all backend tests pass, ask the user if questions arise.

- [ ] 7. Update CDK infrastructure for comment Lambda functions
  - [x] 7.1 Add Lambda function definitions to CDK stack
    - Create createCommentFunction with environment variables (COMMENTS_TABLE, POSTS_TABLE, USERS_TABLE)
    - Create getCommentsFunction with environment variables (COMMENTS_TABLE)
    - Create deleteCommentFunction with environment variables (COMMENTS_TABLE, POSTS_TABLE, USERS_TABLE)
    - Use lambda.Runtime.NODEJS_22_X and lambda.Code.fromAsset with getLambdaPackagePath helper
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.2 Grant IAM permissions to Lambda functions
    - Grant createCommentFunction: read/write on CommentsTable and PostsTable, read on UsersTable
    - Grant getCommentsFunction: read on CommentsTable
    - Grant deleteCommentFunction: read/write on CommentsTable and PostsTable, read on UsersTable
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.3 Add API Gateway routes for comment endpoints
    - Add POST /posts/{postId}/comments route integrated with createCommentFunction
    - Add GET /posts/{postId}/comments route integrated with getCommentsFunction
    - Add DELETE /comments/{commentId} route integrated with deleteCommentFunction
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Create frontend TypeScript types for comments
  - Create `frontend/src/types/comment.ts` with Comment interface
  - Define Comment interface with fields: id, postId, userId, username, text, createdAt (all strings)
  - Export Comment type for use in components and API service
  - _Requirements: 1.6, 2.5_

- [ ] 9. Implement frontend API service for comments
  - [x] 9.1 Add commentsApi namespace to services/api.ts
    - Implement createComment function (POST /posts/{postId}/comments with auth token)
    - Implement getComments function (GET /posts/{postId}/comments, no auth)
    - Implement deleteComment function (DELETE /comments/{commentId} with auth token)
    - Use existing handleResponse helper for error handling
    - Return typed responses using Comment interface
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. Implement CommentItem component
  - [x] 10.1 Create CommentItem component with display and delete functionality
    - Create `frontend/src/components/CommentItem.tsx`
    - Accept props: comment (Comment), canDelete (boolean), onDelete (async function)
    - Display username (clickable link to profile), comment text, relative timestamp
    - Conditionally render delete button based on canDelete prop
    - Handle delete button click by calling onDelete with commentId
    - _Requirements: 4.3, 4.5_

  - [ ]* 10.2 Write property test for comment display completeness
    - **Property 13: Comment Display Completeness**
    - **Validates: Requirements 4.3**
    - Generate random comments with various usernames and timestamps
    - Verify rendered output includes username and timestamp

  - [ ]* 10.3 Write property test for delete button visibility
    - **Property 14: Delete Button Visibility**
    - **Validates: Requirements 4.5**
    - Generate random comments and random current user IDs
    - Verify delete button visible only when IDs match

  - [ ]* 10.4 Write unit tests for CommentItem
    - Test comment renders with username and text
    - Test delete button only visible when canDelete is true
    - Test delete button click calls onDelete with correct commentId
    - _Requirements: 4.3, 4.5_

- [ ] 11. Implement CommentSection component
  - [x] 11.1 Create CommentSection component with state management and API integration
    - Create `frontend/src/components/CommentSection.tsx`
    - Accept props: postId, initialCommentsCount, isAuthenticated, currentUserId
    - Manage state: comments array, commentText, isLoading, isExpanded, error
    - Implement lazy loading: fetch comments when user expands section
    - Implement comment submission: validate text, call createComment API, update UI
    - Implement comment deletion: call deleteComment API, remove from UI
    - Display comment count badge, expand/collapse toggle, comment list, input field (if authenticated)
    - Handle loading states and error messages
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 11.2 Write property test for comment count display
    - **Property 11: Comment Count Display**
    - **Validates: Requirements 4.1**
    - Generate random posts with random comment counts
    - Verify displayed count matches actual count

  - [ ]* 11.3 Write property test for authenticated input field visibility
    - **Property 15: Authenticated Input Field Visibility**
    - **Validates: Requirements 5.1, 5.2**
    - Generate random authentication states (authenticated/unauthenticated)
    - Verify input fields visible only when authenticated

  - [ ]* 11.4 Write unit tests for CommentSection
    - Test comment count badge displays correct number
    - Test comments fetch on expand
    - Test comment input only visible when authenticated
    - Test successful comment submission clears input and displays new comment
    - Test failed comment submission displays error message
    - Test submit button disabled during submission
    - Test successful deletion removes comment from UI
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 12. Integrate CommentSection into Feed page
  - [x] 12.1 Add CommentSection to post cards in Feed component
    - Import CommentSection component in `frontend/src/pages/Feed.tsx`
    - Add CommentSection below each post content with props: postId, initialCommentsCount (from post.commentsCount), isAuthenticated (from AuthContext), currentUserId (from AuthContext)
    - Ensure post data includes commentsCount field (may need to update getPosts API response)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2_

- [ ] 13. Update PostsTable schema to include commentsCount
  - [x] 13.1 Add commentsCount field to post creation
    - Update createPost Lambda to initialize commentsCount to 0 when creating new posts
    - Update getPosts Lambda to include commentsCount in response
    - _Requirements: 4.1_

- [x] 14. Checkpoint - Ensure all tests pass and feature is integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Build and deploy comment feature
  - [x] 15.1 Build backend Lambda packages
    - Run `yarn build:backend` to package Lambda functions
    - Verify createComment, getComments, deleteComment packages exist in `backend/dist/lambda-packages/`

  - [x] 15.2 Deploy infrastructure and backend
    - Run `yarn deploy:infra` to deploy CDK stack with new Lambda functions and API routes
    - Verify API Gateway routes are created: POST /posts/{postId}/comments, GET /posts/{postId}/comments, DELETE /comments/{commentId}

  - [x] 15.3 Build and deploy frontend
    - Run `yarn build:frontend` to build React application
    - Run `yarn deploy:frontend` to sync to S3
    - Run `yarn invalidate:cdn` to clear CloudFront cache

  - [x] 15.4 Verify deployment
    - Test creating a comment via frontend
    - Test viewing comments on a post
    - Test deleting own comment
    - Verify comment count updates correctly

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The CommentsTable already exists in DynamoDB infrastructure, no table creation needed
- Backend uses JavaScript (CommonJS) with Node.js 22.x Lambda runtime
- Frontend uses TypeScript with React 18 and Vite
- Property-based tests use fast-check library (100 iterations minimum)
- Each property test is tagged with property number and validates specific requirements
- Checkpoints ensure incremental validation before proceeding to next phase
- Integration tasks wire frontend and backend together for end-to-end functionality
