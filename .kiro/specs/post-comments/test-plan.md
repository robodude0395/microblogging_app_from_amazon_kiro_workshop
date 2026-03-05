# Comprehensive Test Plan: Post Comments Feature

## Overview

This test plan provides comprehensive coverage for the commenting feature, including unit tests, integration tests, edge cases, and property-based tests. The plan is organized by testing layer and references the design document's correctness properties.

## Table of Contents

1. [Backend Unit Tests](#1-backend-unit-tests)
2. [Frontend Unit Tests](#2-frontend-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [Edge Cases](#4-edge-cases)
5. [Property-Based Tests](#5-property-based-tests)
6. [Test Infrastructure](#6-test-infrastructure)

---

## 1. Backend Unit Tests

### 1.1 createComment Lambda Tests

**File**: `backend/src/functions/comments/__tests__/createComment.test.js`

#### Test Suite: Comment Creation Success Cases


**Test 1.1.1: Create comment with valid text**
- **Description**: Verify comment creation with valid 100-character text
- **Setup**:
  - Mock DynamoDB PutCommand and UpdateCommand
  - Mock withAuth to provide user context
  - Set environment variables (COMMENTS_TABLE, POSTS_TABLE)
- **Test Steps**:
  1. Create event with valid comment text (100 characters)
  2. Call handler with authenticated user context
  3. Verify PutCommand called with correct comment object
  4. Verify UpdateCommand called to increment commentsCount
- **Expected Results**:
  - Status code: 201
  - Response contains complete comment object with all fields
  - Comment has unique UUID
  - createdAt is ISO 8601 timestamp
  - CORS headers present
- **Validates**: Property 1 (Comment Creation Completeness), Requirements 1.1, 1.2, 1.3, 1.6

**Test 1.1.2: Create comment with exactly 500 characters**
- **Description**: Verify maximum length comment is accepted
- **Setup**: Same as 1.1.1
- **Test Steps**:
  1. Create event with 500-character text
  2. Call handler
  3. Verify comment created successfully
- **Expected Results**:
  - Status code: 201
  - Comment created with full 500-character text
- **Validates**: Requirement 1.4 boundary


**Test 1.1.3: Comment includes username from auth context**
- **Description**: Verify username is correctly stored from withAuth middleware
- **Setup**: Mock withAuth to provide specific username
- **Test Steps**:
  1. Create event with user context containing username "testuser"
  2. Call handler
  3. Verify created comment includes username field
- **Expected Results**:
  - Comment.username matches event.user.username
- **Validates**: Requirement 1.2, 1.6

#### Test Suite: Comment Creation Validation Errors

**Test 1.1.4: Reject empty comment text**
- **Description**: Verify empty string is rejected
- **Setup**: Mock DynamoDB (should not be called)
- **Test Steps**:
  1. Create event with empty text: ""
  2. Call handler
  3. Verify no database operations performed
- **Expected Results**:
  - Status code: 400
  - Error message: "Comment text cannot be empty"
  - No PutCommand or UpdateCommand called
- **Validates**: Property 2 (Whitespace Rejection), Requirement 1.5

**Test 1.1.5: Reject whitespace-only comment**
- **Description**: Verify whitespace-only text is rejected
- **Setup**: Mock DynamoDB (should not be called)
- **Test Steps**:
  1. Create event with text: "   \n\t  "
  2. Call handler
  3. Verify no database operations performed
- **Expected Results**:
  - Status code: 400
  - Error message: "Comment text cannot be empty"
- **Validates**: Property 2, Requirement 1.5


**Test 1.1.6: Reject comment exceeding 500 characters**
- **Description**: Verify 501-character text is rejected
- **Setup**: Mock DynamoDB (should not be called)
- **Test Steps**:
  1. Create event with 501-character text
  2. Call handler
  3. Verify no database operations performed
- **Expected Results**:
  - Status code: 400
  - Error message: "Comment text cannot exceed 500 characters"
- **Validates**: Requirement 1.4

**Test 1.1.7: Reject missing postId**
- **Description**: Verify missing postId parameter returns error
- **Setup**: Mock DynamoDB (should not be called)
- **Test Steps**:
  1. Create event without pathParameters.postId
  2. Call handler
- **Expected Results**:
  - Status code: 400
  - Error message: "Missing postId parameter"
- **Validates**: Requirement 6.6

**Test 1.1.8: Reject missing request body**
- **Description**: Verify missing body returns error
- **Setup**: Mock DynamoDB (should not be called)
- **Test Steps**:
  1. Create event without body field
  2. Call handler
- **Expected Results**:
  - Status code: 400
  - Error message: "Missing request body"
- **Validates**: Requirement 6.6


#### Test Suite: Authentication and Authorization

**Test 1.1.9: Verify withAuth middleware integration**
- **Description**: Verify handler is wrapped with withAuth
- **Setup**: Test without Authorization header
- **Test Steps**:
  1. Create event without Authorization header
  2. Call exported handler
- **Expected Results**:
  - Status code: 401
  - Error message: "Missing authorization token"
- **Validates**: Property 8 (Authentication Requirements), Requirement 6.4

#### Test Suite: Database Error Handling

**Test 1.1.10: Handle DynamoDB PutCommand failure**
- **Description**: Verify graceful handling of database errors
- **Setup**: Mock PutCommand to throw error
- **Test Steps**:
  1. Create valid event
  2. Call handler
  3. Verify error response returned
- **Expected Results**:
  - Status code: 500
  - Error message: "Error creating comment"
  - Error logged to console
- **Validates**: Requirement 6.6

**Test 1.1.11: Handle missing environment variables**
- **Description**: Verify error when COMMENTS_TABLE not set
- **Setup**: Delete process.env.COMMENTS_TABLE
- **Test Steps**:
  1. Create valid event
  2. Call handler
- **Expected Results**:
  - Status code: 500
  - Error includes "environment variable"
- **Validates**: Error handling



### 1.2 getComments Lambda Tests

**File**: `backend/src/functions/comments/__tests__/getComments.test.js` (already exists)

#### Test Suite: Comment Retrieval Success Cases

**Test 1.2.1: Retrieve comments with proper structure** ✓ (Existing)
- **Description**: Verify comments retrieved with all required fields
- **Status**: Already implemented
- **Validates**: Property 3 (Comment Retrieval Completeness), Requirement 2.1, 2.3, 2.5

**Test 1.2.2: Return empty array when no comments exist** ✓ (Existing)
- **Description**: Verify empty array for post with no comments
- **Status**: Already implemented
- **Validates**: Requirement 2.4

**Test 1.2.3: Verify chronological ordering**
- **Description**: Verify comments sorted by createdAt ascending
- **Setup**: Mock QueryCommand with 3 comments in random order
- **Test Steps**:
  1. Create mock comments with timestamps: T1, T3, T2
  2. Mock DynamoDB to return sorted by createdAt ascending
  3. Call handler
  4. Verify ScanIndexForward: true in QueryCommand
- **Expected Results**:
  - Comments returned in order: T1, T2, T3
  - QueryCommand called with ScanIndexForward: true
- **Validates**: Property 4 (Chronological Ordering), Requirement 2.2, 4.4

**Test 1.2.4: Retrieve multiple comments (10+)**
- **Description**: Verify handling of posts with many comments
- **Setup**: Mock 15 comments
- **Test Steps**:
  1. Create event for post with 15 comments
  2. Call handler
  3. Verify all comments returned
- **Expected Results**:
  - Status code: 200
  - All 15 comments in response
- **Validates**: Requirement 2.1


#### Test Suite: Comment Retrieval Validation

**Test 1.2.5: Return 400 when postId is missing** ✓ (Existing)
- **Description**: Verify missing postId returns error
- **Status**: Already implemented
- **Validates**: Requirement 6.6

**Test 1.2.6: Verify no authentication required**
- **Description**: Verify GET endpoint works without auth
- **Setup**: Create event without Authorization header
- **Test Steps**:
  1. Create event without auth headers
  2. Call handler (not wrapped with withAuth)
  3. Verify successful response
- **Expected Results**:
  - Status code: 200
  - Comments returned successfully
- **Validates**: Property 8, Requirement 6.5

#### Test Suite: Database Error Handling

**Test 1.2.7: Handle DynamoDB QueryCommand failure**
- **Description**: Verify graceful handling of query errors
- **Setup**: Mock QueryCommand to throw error
- **Test Steps**:
  1. Create valid event
  2. Call handler
- **Expected Results**:
  - Status code: 500
  - Error message: "Error getting comments"
- **Validates**: Error handling

**Test 1.2.8: Verify CORS headers present**
- **Description**: Verify all responses include CORS headers
- **Setup**: Mock successful query
- **Test Steps**:
  1. Call handler
  2. Verify response headers
- **Expected Results**:
  - Headers include Access-Control-Allow-Origin: *
  - Headers include Access-Control-Allow-Credentials: true
  - Headers include Content-Type: application/json
- **Validates**: Property 10 (CORS Headers), Requirement 6.7



### 1.3 deleteComment Lambda Tests

**File**: `backend/src/functions/comments/__tests__/deleteComment.test.js`

#### Test Suite: Comment Deletion Success Cases

**Test 1.3.1: Delete own comment successfully**
- **Description**: Verify author can delete their own comment
- **Setup**:
  - Mock GetCommand to return comment with userId matching auth user
  - Mock DeleteCommand and UpdateCommand
  - Mock withAuth to provide user context
- **Test Steps**:
  1. Create event with commentId
  2. Set event.user.id to match comment.userId
  3. Call handler
  4. Verify GetCommand, DeleteCommand, and UpdateCommand called
- **Expected Results**:
  - Status code: 200
  - Message: "Comment deleted successfully"
  - DeleteCommand called with correct commentId
  - UpdateCommand decrements commentsCount
- **Validates**: Property 5 (Deletion Authorization), Requirement 3.1, 3.2, 3.4

**Test 1.3.2: Verify commentsCount decremented**
- **Description**: Verify post's commentsCount is decremented
- **Setup**: Mock all DynamoDB operations
- **Test Steps**:
  1. Create valid deletion event
  2. Call handler
  3. Verify UpdateCommand parameters
- **Expected Results**:
  - UpdateCommand called with postId from comment
  - UpdateExpression decrements commentsCount by 1
- **Validates**: Data integrity


#### Test Suite: Authorization Failures

**Test 1.3.3: Reject deletion by non-author**
- **Description**: Verify 403 when user is not comment author
- **Setup**:
  - Mock GetCommand to return comment with different userId
  - Mock withAuth with different user
- **Test Steps**:
  1. Create event with commentId
  2. Set event.user.id to "user-1"
  3. Mock comment.userId as "user-2"
  4. Call handler
  5. Verify DeleteCommand NOT called
- **Expected Results**:
  - Status code: 403
  - Error message: "You are not authorized to delete this comment"
  - No DeleteCommand or UpdateCommand executed
- **Validates**: Property 5, Requirement 3.3

**Test 1.3.4: Return 404 for non-existent comment**
- **Description**: Verify 404 when comment doesn't exist
- **Setup**: Mock GetCommand to return empty result
- **Test Steps**:
  1. Create event with non-existent commentId
  2. Call handler
- **Expected Results**:
  - Status code: 404
  - Error message: "Comment not found"
  - No DeleteCommand executed
- **Validates**: Requirement 3.5

**Test 1.3.5: Reject missing commentId**
- **Description**: Verify 400 when commentId missing
- **Setup**: Mock DynamoDB (should not be called)
- **Test Steps**:
  1. Create event without pathParameters.commentId
  2. Call handler
- **Expected Results**:
  - Status code: 400
  - Error message: "Missing commentId parameter"
- **Validates**: Requirement 6.6


#### Test Suite: Authentication

**Test 1.3.6: Verify withAuth middleware integration**
- **Description**: Verify handler requires authentication
- **Setup**: Test without Authorization header
- **Test Steps**:
  1. Create event without Authorization header
  2. Call exported handler
- **Expected Results**:
  - Status code: 401
  - Error message: "Missing authorization token"
- **Validates**: Property 8, Requirement 6.4

#### Test Suite: Database Error Handling

**Test 1.3.7: Handle GetCommand failure**
- **Description**: Verify graceful handling of retrieval errors
- **Setup**: Mock GetCommand to throw error
- **Test Steps**:
  1. Create valid event
  2. Call handler
- **Expected Results**:
  - Status code: 500
  - Error message: "Error deleting comment"
- **Validates**: Error handling

**Test 1.3.8: Handle DeleteCommand failure**
- **Description**: Verify graceful handling of deletion errors
- **Setup**: Mock DeleteCommand to throw error
- **Test Steps**:
  1. Create valid event with authorized user
  2. Call handler
- **Expected Results**:
  - Status code: 500
  - Error message: "Error deleting comment"
- **Validates**: Error handling

---

## 2. Frontend Unit Tests

### 2.1 CommentSection Component Tests

**File**: `frontend/src/components/__tests__/CommentSection.test.tsx`


#### Test Suite: Component Rendering

**Test 2.1.1: Render comment count badge**
- **Description**: Verify comment count displays correctly
- **Setup**:
  - Mock commentsApi.getComments
  - Render component with initialCommentsCount: 5
- **Test Steps**:
  1. Render CommentSection with props
  2. Query for comment count badge
- **Expected Results**:
  - Badge displays "5 comments"
  - Toggle button present
- **Validates**: Property 11 (Comment Count Display), Requirement 4.1

**Test 2.1.2: Render singular "comment" for count of 1**
- **Description**: Verify proper pluralization
- **Setup**: Render with initialCommentsCount: 1
- **Test Steps**:
  1. Render component
  2. Check badge text
- **Expected Results**:
  - Badge displays "1 comment" (not "comments")
- **Validates**: UI polish

**Test 2.1.3: Show input field when authenticated**
- **Description**: Verify input visible for authenticated users
- **Setup**: Render with isAuthenticated: true
- **Test Steps**:
  1. Render component
  2. Expand comments section
  3. Query for textarea
- **Expected Results**:
  - Textarea present with placeholder "Write a comment..."
  - Submit button present
- **Validates**: Property 15 (Authenticated Input Field Visibility), Requirement 5.1

**Test 2.1.4: Hide input field when not authenticated**
- **Description**: Verify input hidden for unauthenticated users
- **Setup**: Render with isAuthenticated: false
- **Test Steps**:
  1. Render component
  2. Expand comments section
  3. Query for textarea
- **Expected Results**:
  - Textarea not present
  - Submit button not present
- **Validates**: Property 15, Requirement 5.2


#### Test Suite: Comment Loading

**Test 2.1.5: Lazy load comments on expand**
- **Description**: Verify comments fetched only when expanded
- **Setup**:
  - Mock commentsApi.getComments to return 3 comments
  - Mock localStorage.getItem
- **Test Steps**:
  1. Render component (collapsed)
  2. Verify API not called yet
  3. Click toggle button
  4. Wait for loading to complete
- **Expected Results**:
  - API called after toggle clicked
  - Loading indicator shown during fetch
  - 3 comments displayed after load
  - Comments section expanded
- **Validates**: Property 12 (Comment Expansion Behavior), Requirement 4.2

**Test 2.1.6: Display loading state**
- **Description**: Verify loading indicator shown during fetch
- **Setup**: Mock API with delayed response
- **Test Steps**:
  1. Render component
  2. Click toggle
  3. Check for loading indicator before response
- **Expected Results**:
  - "Loading comments..." text displayed
  - Toggle button disabled during load
- **Validates**: UI feedback

**Test 2.1.7: Display error on fetch failure**
- **Description**: Verify error message shown on API failure
- **Setup**: Mock API to reject with error
- **Test Steps**:
  1. Render component
  2. Click toggle
  3. Wait for error
- **Expected Results**:
  - Error message: "Failed to load comments"
  - Comments not displayed
- **Validates**: Requirement 5.6

**Test 2.1.8: Toggle visibility without refetching**
- **Description**: Verify collapse/expand doesn't refetch
- **Setup**: Mock API
- **Test Steps**:
  1. Expand and load comments (API called once)
  2. Collapse section
  3. Expand again
  4. Verify API called only once
- **Expected Results**:
  - Comments cached after first load
  - No additional API calls on re-expand
- **Validates**: Performance optimization


#### Test Suite: Comment Submission

**Test 2.1.9: Submit valid comment**
- **Description**: Verify successful comment submission
- **Setup**:
  - Mock commentsApi.createComment to return new comment
  - Mock localStorage.getItem to return token
  - Render with isAuthenticated: true
- **Test Steps**:
  1. Expand comments
  2. Type "Great post!" in textarea
  3. Click submit button
  4. Wait for submission
- **Expected Results**:
  - API called with correct postId, text, token
  - New comment appears in list
  - Input field cleared
  - Comment count incremented
  - Submit button disabled during submission
- **Validates**: Property 16 (Submit Button Disabled), Property 17 (Successful Submission UI Update), Requirement 5.3, 5.4, 5.5

**Test 2.1.10: Disable submit for empty text**
- **Description**: Verify submit button disabled when text empty
- **Setup**: Render with isAuthenticated: true
- **Test Steps**:
  1. Expand comments
  2. Check submit button state with empty textarea
- **Expected Results**:
  - Submit button disabled
- **Validates**: Client-side validation

**Test 2.1.11: Show character count**
- **Description**: Verify character counter updates
- **Setup**: Render with isAuthenticated: true
- **Test Steps**:
  1. Expand comments
  2. Type "Hello" (5 chars)
  3. Check character count display
- **Expected Results**:
  - Counter shows "5/500"
- **Validates**: UI feedback

**Test 2.1.12: Validate empty comment client-side**
- **Description**: Verify client-side validation for empty text
- **Setup**: Render with isAuthenticated: true
- **Test Steps**:
  1. Expand comments
  2. Type whitespace only
  3. Attempt to submit
- **Expected Results**:
  - Error message: "Comment cannot be empty"
  - API not called
- **Validates**: Client-side validation


**Test 2.1.13: Validate max length client-side**
- **Description**: Verify client-side validation for 500+ characters
- **Setup**: Render with isAuthenticated: true
- **Test Steps**:
  1. Expand comments
  2. Type 501 characters
  3. Attempt to submit
- **Expected Results**:
  - Error message: "Comment is too long (max 500 characters)"
  - API not called
- **Validates**: Client-side validation

**Test 2.1.14: Display error on submission failure**
- **Description**: Verify error shown when API fails
- **Setup**: Mock API to reject
- **Test Steps**:
  1. Expand comments
  2. Type valid comment
  3. Submit
  4. Wait for error
- **Expected Results**:
  - Error message: "Failed to post comment"
  - Input field retains text
  - User can retry
- **Validates**: Property 18 (Failed Submission Error Display), Requirement 5.6

**Test 2.1.15: Clear error on input change**
- **Description**: Verify error cleared when user types
- **Setup**: Render with error state
- **Test Steps**:
  1. Display error message
  2. Type in textarea
- **Expected Results**:
  - Error message disappears
- **Validates**: UX improvement


#### Test Suite: Comment Deletion

**Test 2.1.16: Delete own comment**
- **Description**: Verify user can delete their own comment
- **Setup**:
  - Mock commentsApi.deleteComment
  - Render with comments including user's own comment
  - Set currentUserId to match comment userId
- **Test Steps**:
  1. Expand comments with 3 comments
  2. Find delete button on user's comment
  3. Click delete button
  4. Wait for deletion
- **Expected Results**:
  - API called with correct commentId and token
  - Comment removed from UI
  - Comment count decremented
- **Validates**: Property 14 (Delete Button Visibility), Requirement 4.5

**Test 2.1.17: Hide delete button for other users' comments**
- **Description**: Verify delete button not shown for others' comments
- **Setup**:
  - Render with comments from different users
  - Set currentUserId to "user-1"
- **Test Steps**:
  1. Expand comments
  2. Check for delete buttons on comments with userId !== "user-1"
- **Expected Results**:
  - Delete button not present on other users' comments
  - Delete button present only on user's own comments
- **Validates**: Property 14, Requirement 4.5

**Test 2.1.18: Display error on deletion failure**
- **Description**: Verify error shown when deletion fails
- **Setup**: Mock API to reject
- **Test Steps**:
  1. Expand comments
  2. Click delete on own comment
  3. Wait for error
- **Expected Results**:
  - Error message: "Failed to delete comment"
  - Comment remains in UI
- **Validates**: Error handling



### 2.2 CommentItem Component Tests

**File**: `frontend/src/components/__tests__/CommentItem.test.tsx`

#### Test Suite: Comment Display

**Test 2.2.1: Render comment with all fields**
- **Description**: Verify comment displays username, text, and timestamp
- **Setup**: Create mock comment object
- **Test Steps**:
  1. Render CommentItem with comment
  2. Query for username, text, timestamp elements
- **Expected Results**:
  - Username displayed and clickable
  - Comment text displayed
  - Timestamp displayed in relative format
- **Validates**: Property 13 (Comment Display Completeness), Requirement 4.3

**Test 2.2.2: Format timestamp as relative time**
- **Description**: Verify timestamp shows "2 hours ago" format
- **Setup**: Create comment with createdAt 2 hours ago
- **Test Steps**:
  1. Render CommentItem
  2. Check timestamp text
- **Expected Results**:
  - Displays "2 hours ago" or similar relative format
- **Validates**: Requirement 4.3

**Test 2.2.3: Username links to profile**
- **Description**: Verify username is clickable link
- **Setup**: Render comment with userId
- **Test Steps**:
  1. Render CommentItem
  2. Find username link
  3. Check href attribute
- **Expected Results**:
  - Username is anchor tag
  - href points to /profile/{userId}
- **Validates**: Navigation integration

**Test 2.2.4: Display multi-line comment text**
- **Description**: Verify line breaks preserved in text
- **Setup**: Create comment with text containing \n
- **Test Steps**:
  1. Render CommentItem
  2. Check text rendering
- **Expected Results**:
  - Line breaks preserved or converted to <br>
- **Validates**: Text formatting


#### Test Suite: Delete Button

**Test 2.2.5: Show delete button when canDelete is true**
- **Description**: Verify delete button shown for authorized user
- **Setup**: Render with canDelete: true
- **Test Steps**:
  1. Render CommentItem
  2. Query for delete button
- **Expected Results**:
  - Delete button present
  - Button has appropriate styling
- **Validates**: Property 14

**Test 2.2.6: Hide delete button when canDelete is false**
- **Description**: Verify delete button hidden for unauthorized user
- **Setup**: Render with canDelete: false
- **Test Steps**:
  1. Render CommentItem
  2. Query for delete button
- **Expected Results**:
  - Delete button not present
- **Validates**: Property 14

**Test 2.2.7: Call onDelete when button clicked**
- **Description**: Verify onDelete callback invoked
- **Setup**:
  - Mock onDelete function
  - Render with canDelete: true
- **Test Steps**:
  1. Render CommentItem
  2. Click delete button
  3. Verify callback called
- **Expected Results**:
  - onDelete called with correct commentId
- **Validates**: Component interaction

### 2.3 API Service Tests

**File**: `frontend/src/services/__tests__/commentsApi.test.ts`

#### Test Suite: createComment API

**Test 2.3.1: Call correct endpoint with auth**
- **Description**: Verify API call structure
- **Setup**: Mock global fetch
- **Test Steps**:
  1. Call commentsApi.createComment(postId, text, token)
  2. Verify fetch called with correct parameters
- **Expected Results**:
  - URL: `${API_URL}/posts/${postId}/comments`
  - Method: POST
  - Headers include Authorization: Bearer {token}
  - Body includes { text }
- **Validates**: API integration


**Test 2.3.2: Return comment object on success**
- **Description**: Verify response parsing
- **Setup**: Mock fetch to return 201 with comment
- **Test Steps**:
  1. Call createComment
  2. Await response
- **Expected Results**:
  - Returns { comment: {...} }
  - Comment has all required fields
- **Validates**: API contract

**Test 2.3.3: Throw error on failure**
- **Description**: Verify error handling
- **Setup**: Mock fetch to return 400
- **Test Steps**:
  1. Call createComment
  2. Expect promise rejection
- **Expected Results**:
  - Promise rejects with error
  - Error message extracted from response
- **Validates**: Error handling

#### Test Suite: getComments API

**Test 2.3.4: Call correct endpoint without auth**
- **Description**: Verify GET request structure
- **Setup**: Mock global fetch
- **Test Steps**:
  1. Call commentsApi.getComments(postId)
  2. Verify fetch parameters
- **Expected Results**:
  - URL: `${API_URL}/posts/${postId}/comments`
  - Method: GET
  - No Authorization header
- **Validates**: API integration

**Test 2.3.5: Return comments array on success**
- **Description**: Verify response parsing
- **Setup**: Mock fetch to return 200 with comments
- **Test Steps**:
  1. Call getComments
  2. Await response
- **Expected Results**:
  - Returns { comments: [...] }
  - Array contains comment objects
- **Validates**: API contract

#### Test Suite: deleteComment API

**Test 2.3.6: Call correct endpoint with auth**
- **Description**: Verify DELETE request structure
- **Setup**: Mock global fetch
- **Test Steps**:
  1. Call commentsApi.deleteComment(commentId, token)
  2. Verify fetch parameters
- **Expected Results**:
  - URL: `${API_URL}/comments/${commentId}`
  - Method: DELETE
  - Headers include Authorization: Bearer {token}
- **Validates**: API integration


**Test 2.3.7: Return success message on deletion**
- **Description**: Verify response parsing
- **Setup**: Mock fetch to return 200
- **Test Steps**:
  1. Call deleteComment
  2. Await response
- **Expected Results**:
  - Returns { message: "Comment deleted successfully" }
- **Validates**: API contract

---

## 3. Integration Tests

### 3.1 End-to-End Comment Creation Flow

**File**: `frontend/tests/e2e/comments.spec.ts` (Playwright)

**Test 3.1.1: Complete comment creation flow**
- **Description**: Test full user journey from login to comment creation
- **Setup**:
  - Start with clean database state
  - Create test user and post
- **Test Steps**:
  1. Navigate to login page
  2. Login with test credentials
  3. Navigate to feed
  4. Find test post
  5. Click to expand comments
  6. Type comment text
  7. Click submit button
  8. Wait for comment to appear
- **Expected Results**:
  - Comment appears in list
  - Comment count incremented
  - Input field cleared
  - Comment shows correct username and timestamp
- **Validates**: Requirements 1.1-1.6, 4.1-4.3, 5.1-5.5

**Test 3.1.2: Comment persists after page refresh**
- **Description**: Verify comment stored in database
- **Test Steps**:
  1. Create comment (as in 3.1.1)
  2. Refresh page
  3. Expand comments
- **Expected Results**:
  - Comment still visible
  - Comment data unchanged
- **Validates**: Property 7 (Round-Trip Persistence), Requirement 7.5



### 3.2 Comment Retrieval and Display

**Test 3.2.1: Display multiple comments in order**
- **Description**: Verify chronological ordering in UI
- **Setup**: Create post with 5 comments at different times
- **Test Steps**:
  1. Login and navigate to feed
  2. Find post with comments
  3. Expand comments
  4. Verify order
- **Expected Results**:
  - All 5 comments displayed
  - Comments ordered oldest to newest
  - Each comment shows username and timestamp
- **Validates**: Property 4 (Chronological Ordering), Requirements 2.1-2.3, 4.4

**Test 3.2.2: Display comments without authentication**
- **Description**: Verify public read access
- **Setup**: Create post with comments
- **Test Steps**:
  1. Navigate to feed without logging in
  2. Expand comments on post
- **Expected Results**:
  - Comments visible
  - No input field shown
  - No delete buttons shown
- **Validates**: Property 8, Requirements 5.2, 6.5

### 3.3 Comment Deletion with Authorization

**Test 3.3.1: Delete own comment successfully**
- **Description**: Test authorized deletion flow
- **Setup**:
  - Login as user1
  - Create comment on post
- **Test Steps**:
  1. Expand comments
  2. Find own comment with delete button
  3. Click delete
  4. Wait for deletion
- **Expected Results**:
  - Comment removed from UI
  - Comment count decremented
  - Comment not in database
- **Validates**: Property 5 (Deletion Authorization), Requirements 3.1-3.4

**Test 3.3.2: Cannot delete other users' comments**
- **Description**: Test authorization enforcement
- **Setup**:
  - User1 creates comment
  - Login as user2
- **Test Steps**:
  1. Navigate to post with user1's comment
  2. Expand comments
  3. Verify no delete button on user1's comment
- **Expected Results**:
  - Delete button not visible on other users' comments
  - Only visible on user2's own comments (if any)
- **Validates**: Property 5, Requirement 3.3



### 3.4 Comment Count Updates

**Test 3.4.1: Comment count increments on creation**
- **Description**: Verify count updates in real-time
- **Setup**: Post with 0 comments
- **Test Steps**:
  1. Login and navigate to post
  2. Note initial count: "0 comments"
  3. Create comment
  4. Verify count updates
- **Expected Results**:
  - Count changes to "1 comment"
  - No page refresh required
- **Validates**: Property 11, Requirement 4.1

**Test 3.4.2: Comment count decrements on deletion**
- **Description**: Verify count updates on deletion
- **Setup**: Post with 3 comments
- **Test Steps**:
  1. Login and navigate to post
  2. Note initial count: "3 comments"
  3. Delete own comment
  4. Verify count updates
- **Expected Results**:
  - Count changes to "2 comments"
  - No page refresh required
- **Validates**: Property 11, Requirement 4.1

### 3.5 Error Scenarios

**Test 3.5.1: Handle network failure gracefully**
- **Description**: Test offline/network error handling
- **Setup**:
  - Login and navigate to post
  - Simulate network offline
- **Test Steps**:
  1. Attempt to create comment
  2. Wait for error
- **Expected Results**:
  - Error message displayed
  - Input field retains text
  - User can retry when online
- **Validates**: Error handling

**Test 3.5.2: Handle authentication failure**
- **Description**: Test expired token handling
- **Setup**:
  - Login with token
  - Invalidate token server-side
- **Test Steps**:
  1. Attempt to create comment
  2. Wait for error
- **Expected Results**:
  - 401 error handled
  - User prompted to re-authenticate
- **Validates**: Property 8, Requirement 6.4



---

## 4. Edge Cases

### 4.1 Text Content Edge Cases

**Test 4.1.1: Empty string comment**
- **Layer**: Backend unit test
- **Description**: Verify "" rejected
- **Expected**: 400 error
- **Validates**: Requirement 1.5

**Test 4.1.2: Single space comment**
- **Layer**: Backend unit test
- **Description**: Verify " " rejected
- **Expected**: 400 error
- **Validates**: Property 2

**Test 4.1.3: Multiple whitespace types**
- **Layer**: Backend unit test
- **Description**: Verify "  \n\t  " rejected
- **Expected**: 400 error
- **Validates**: Property 2

**Test 4.1.4: Exactly 500 characters**
- **Layer**: Backend unit test
- **Description**: Verify boundary accepted
- **Expected**: 201 success
- **Validates**: Requirement 1.4

**Test 4.1.5: Exactly 501 characters**
- **Layer**: Backend unit test
- **Description**: Verify boundary rejected
- **Expected**: 400 error
- **Validates**: Requirement 1.4

**Test 4.1.6: Comment with emojis**
- **Layer**: Integration test
- **Description**: Create comment with "Great! 🎉👍"
- **Expected**: Comment stored and displayed correctly
- **Validates**: Unicode support

**Test 4.1.7: Comment with special characters**
- **Layer**: Integration test
- **Description**: Create comment with "<script>alert('xss')</script>"
- **Expected**: Text escaped/sanitized in display
- **Validates**: XSS prevention

**Test 4.1.8: Comment with line breaks**
- **Layer**: Integration test
- **Description**: Create comment with "Line 1\nLine 2\nLine 3"
- **Expected**: Line breaks preserved in display
- **Validates**: Text formatting

**Test 4.1.9: Comment with URLs**
- **Layer**: Integration test
- **Description**: Create comment with "Check out https://example.com"
- **Expected**: URL displayed (optionally as link)
- **Validates**: URL handling



### 4.2 Comment Volume Edge Cases

**Test 4.2.1: Post with 0 comments**
- **Layer**: Frontend unit test
- **Description**: Display "0 comments" and empty state
- **Expected**: "No comments yet" message shown
- **Validates**: Requirement 2.4

**Test 4.2.2: Post with 1 comment**
- **Layer**: Frontend unit test
- **Description**: Verify singular "comment" text
- **Expected**: Badge shows "1 comment" not "comments"
- **Validates**: UI polish

**Test 4.2.3: Post with 100+ comments**
- **Layer**: Integration test
- **Description**: Create post with 150 comments
- **Expected**: All comments retrieved and displayed
- **Validates**: Scalability (note: pagination not in MVP)

**Test 4.2.4: Rapid successive comment submissions**
- **Layer**: Integration test
- **Description**: Submit 5 comments in quick succession
- **Expected**:
  - All comments created
  - Comment count accurate
  - No race conditions
- **Validates**: Concurrency handling

### 4.3 Deletion Edge Cases

**Test 4.3.1: Delete non-existent comment**
- **Layer**: Backend unit test
- **Description**: Attempt to delete commentId that doesn't exist
- **Expected**: 404 error
- **Validates**: Requirement 3.5

**Test 4.3.2: Delete already-deleted comment**
- **Layer**: Integration test
- **Description**:
  1. Delete comment successfully
  2. Attempt to delete same commentId again
- **Expected**: 404 error on second attempt
- **Validates**: Idempotency

**Test 4.3.3: Unauthorized deletion attempt via API**
- **Layer**: Backend unit test
- **Description**: User2 attempts to delete User1's comment
- **Expected**: 403 error
- **Validates**: Property 5, Requirement 3.3



### 4.4 Authentication Edge Cases

**Test 4.4.1: Missing Authorization header**
- **Layer**: Backend unit test
- **Description**: POST/DELETE without auth header
- **Expected**: 401 error
- **Validates**: Property 8, Requirement 6.4

**Test 4.4.2: Invalid token format**
- **Layer**: Backend unit test
- **Description**: Send malformed JWT token
- **Expected**: 401 error
- **Validates**: Authentication security

**Test 4.4.3: Expired token**
- **Layer**: Integration test
- **Description**: Use expired authentication token
- **Expected**: 401 error
- **Validates**: Token validation

**Test 4.4.4: Token for deleted user**
- **Layer**: Integration test
- **Description**: Valid token but user deleted from database
- **Expected**: 401 or 404 error
- **Validates**: User existence check

### 4.5 Database Edge Cases

**Test 4.5.1: DynamoDB throttling**
- **Layer**: Backend unit test
- **Description**: Mock DynamoDB to return throttling error
- **Expected**: 500 error with retry logic (if implemented)
- **Validates**: Error handling

**Test 4.5.2: Missing environment variables**
- **Layer**: Backend unit test
- **Description**: COMMENTS_TABLE not set
- **Expected**: 500 error with descriptive message
- **Validates**: Configuration validation

**Test 4.5.3: Post doesn't exist**
- **Layer**: Integration test
- **Description**: Create comment on non-existent postId
- **Expected**: Comment created (no foreign key constraint in DynamoDB)
- **Note**: This is expected DynamoDB behavior
- **Validates**: Data model understanding



---

## 5. Property-Based Tests

Property-based tests use **fast-check** library to verify universal properties across randomized inputs. Each test runs minimum 100 iterations.

### 5.1 Backend Property Tests

**File**: `backend/src/functions/comments/__tests__/properties.test.js`

#### Property 1: Comment Creation Completeness

```javascript
// Feature: post-comments, Property 1: Comment creation produces complete object
test('Property 1: Created comments contain all required fields', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      fc.uuid(),
      fc.uuid(),
      fc.string({ minLength: 3, maxLength: 20 }),
      async (text, postId, userId, username) => {
        // Mock DynamoDB operations
        const mockSend = jest.fn().mockResolvedValue({});

        const event = {
          body: JSON.stringify({ text }),
          pathParameters: { postId },
          user: { id: userId, username }
        };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        // Verify all required fields present
        expect(body.comment).toHaveProperty('id');
        expect(body.comment).toHaveProperty('postId', postId);
        expect(body.comment).toHaveProperty('userId', userId);
        expect(body.comment).toHaveProperty('username', username);
        expect(body.comment).toHaveProperty('text', text);
        expect(body.comment).toHaveProperty('createdAt');

        // Verify createdAt is ISO 8601
        expect(new Date(body.comment.createdAt).toISOString()).toBe(body.comment.createdAt);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 1, Requirements 1.1, 1.2, 1.3, 1.6, 7.2, 7.3, 7.4



#### Property 2: Whitespace Rejection

```javascript
// Feature: post-comments, Property 2: Whitespace-only text rejected
test('Property 2: Whitespace-only comments are rejected', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string().filter(s => s.length > 0 && s.trim().length === 0),
      fc.uuid(),
      async (whitespaceText, postId) => {
        const event = {
          body: JSON.stringify({ text: whitespaceText }),
          pathParameters: { postId },
          user: { id: 'user-1', username: 'testuser' }
        };

        const response = await handler(event);

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('empty');
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 2, Requirement 1.5

#### Property 3: Comment Retrieval Completeness

```javascript
// Feature: post-comments, Property 3: Retrieval returns complete comments
test('Property 3: Retrieved comments contain all required fields', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          id: fc.uuid(),
          postId: fc.uuid(),
          userId: fc.uuid(),
          username: fc.string({ minLength: 3, maxLength: 20 }),
          text: fc.string({ minLength: 1, maxLength: 500 }),
          createdAt: fc.date().map(d => d.toISOString())
        }),
        { minLength: 0, maxLength: 20 }
      ),
      async (mockComments) => {
        // Mock DynamoDB to return these comments
        const mockSend = jest.fn().mockResolvedValue({ Items: mockComments });

        const event = {
          pathParameters: { postId: 'test-post-id' }
        };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(body.comments).toHaveLength(mockComments.length);

        // Verify each comment has all required fields
        body.comments.forEach(comment => {
          expect(comment).toHaveProperty('id');
          expect(comment).toHaveProperty('postId');
          expect(comment).toHaveProperty('userId');
          expect(comment).toHaveProperty('username');
          expect(comment).toHaveProperty('text');
          expect(comment).toHaveProperty('createdAt');
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 3, Requirements 2.1, 2.3, 2.5



#### Property 4: Chronological Ordering

```javascript
// Feature: post-comments, Property 4: Comments sorted chronologically
test('Property 4: Comments are sorted by createdAt ascending', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          id: fc.uuid(),
          postId: fc.constant('test-post'),
          userId: fc.uuid(),
          username: fc.string({ minLength: 3, maxLength: 20 }),
          text: fc.string({ minLength: 1, maxLength: 500 }),
          createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') })
            .map(d => d.toISOString())
        }),
        { minLength: 2, maxLength: 20 }
      ),
      async (mockComments) => {
        // Sort comments by createdAt ascending (as DynamoDB would)
        const sortedComments = [...mockComments].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        );

        const mockSend = jest.fn().mockResolvedValue({ Items: sortedComments });

        const event = {
          pathParameters: { postId: 'test-post' }
        };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        // Verify comments are in chronological order
        for (let i = 1; i < body.comments.length; i++) {
          const prev = new Date(body.comments[i - 1].createdAt);
          const curr = new Date(body.comments[i].createdAt);
          expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 4, Requirements 2.2, 4.4

#### Property 5: Deletion Authorization

```javascript
// Feature: post-comments, Property 5: Only authors can delete comments
test('Property 5: Deletion succeeds only for comment author', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      fc.uuid(),
      fc.uuid(),
      fc.boolean(),
      async (commentId, authorId, requesterId, shouldMatch) => {
        const actualRequesterId = shouldMatch ? authorId : requesterId;

        const mockComment = {
          id: commentId,
          postId: 'post-1',
          userId: authorId,
          username: 'author',
          text: 'test comment',
          createdAt: new Date().toISOString()
        };

        const mockSend = jest.fn()
          .mockResolvedValueOnce({ Item: mockComment }) // GetCommand
          .mockResolvedValueOnce({}) // DeleteCommand
          .mockResolvedValueOnce({}); // UpdateCommand

        const event = {
          pathParameters: { commentId },
          user: { id: actualRequesterId, username: 'requester' }
        };

        const response = await handler(event);

        if (shouldMatch || authorId === actualRequesterId) {
          // Should succeed
          expect(response.statusCode).toBe(200);
        } else {
          // Should fail with 403
          expect(response.statusCode).toBe(403);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 5, Requirements 3.1, 3.2, 3.3, 3.4



#### Property 6: Comment ID Uniqueness

```javascript
// Feature: post-comments, Property 6: Comment IDs are unique
test('Property 6: Generated comment IDs are unique', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 10, max: 50 }),
      async (numComments) => {
        const generatedIds = new Set();

        for (let i = 0; i < numComments; i++) {
          const mockSend = jest.fn().mockResolvedValue({});

          const event = {
            body: JSON.stringify({ text: `Comment ${i}` }),
            pathParameters: { postId: 'test-post' },
            user: { id: 'user-1', username: 'testuser' }
          };

          const response = await handler(event);
          const body = JSON.parse(response.body);

          expect(generatedIds.has(body.comment.id)).toBe(false);
          generatedIds.add(body.comment.id);
        }

        expect(generatedIds.size).toBe(numComments);
      }
    ),
    { numRuns: 50 } // Fewer runs due to nested loop
  );
});
```

**Validates**: Property 6, Requirement 7.1

#### Property 9: HTTP Status Code Correctness

```javascript
// Feature: post-comments, Property 9: Correct HTTP status codes
test('Property 9: API returns semantically correct status codes', async () => {
  const scenarios = [
    { type: 'valid_create', expectedStatus: 201 },
    { type: 'empty_text', expectedStatus: 400 },
    { type: 'missing_postId', expectedStatus: 400 },
    { type: 'valid_get', expectedStatus: 200 },
    { type: 'valid_delete', expectedStatus: 200 },
    { type: 'unauthorized_delete', expectedStatus: 403 },
    { type: 'not_found', expectedStatus: 404 }
  ];

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...scenarios),
      async (scenario) => {
        // Setup event based on scenario type
        let event, response;

        switch (scenario.type) {
          case 'valid_create':
            event = {
              body: JSON.stringify({ text: 'Valid comment' }),
              pathParameters: { postId: 'post-1' },
              user: { id: 'user-1', username: 'test' }
            };
            response = await createCommentHandler(event);
            break;

          case 'empty_text':
            event = {
              body: JSON.stringify({ text: '' }),
              pathParameters: { postId: 'post-1' },
              user: { id: 'user-1', username: 'test' }
            };
            response = await createCommentHandler(event);
            break;

          // ... other scenarios
        }

        expect(response.statusCode).toBe(scenario.expectedStatus);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 9, Requirement 6.6



#### Property 10: CORS Headers Presence

```javascript
// Feature: post-comments, Property 10: CORS headers present
test('Property 10: All responses include required CORS headers', async () => {
  const handlers = [
    { name: 'createComment', handler: createCommentHandler },
    { name: 'getComments', handler: getCommentsHandler },
    { name: 'deleteComment', handler: deleteCommentHandler }
  ];

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...handlers),
      fc.boolean(), // success or error scenario
      async (handlerInfo, shouldSucceed) => {
        // Create event that will succeed or fail based on shouldSucceed
        const event = shouldSucceed
          ? createValidEvent(handlerInfo.name)
          : createInvalidEvent(handlerInfo.name);

        const response = await handlerInfo.handler(event);

        // Verify CORS headers present regardless of success/failure
        expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
        expect(response.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
        expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 10, Requirement 6.7

### 5.2 Frontend Property Tests

**File**: `frontend/src/components/__tests__/properties.test.tsx`

#### Property 11: Comment Count Display

```typescript
// Feature: post-comments, Property 11: Comment count displayed correctly
test('Property 11: Displayed count matches actual comment count', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 100 }),
      fc.array(
        fc.record({
          id: fc.uuid(),
          postId: fc.constant('test-post'),
          userId: fc.uuid(),
          username: fc.string({ minLength: 3, maxLength: 20 }),
          text: fc.string({ minLength: 1, maxLength: 500 }),
          createdAt: fc.date().map(d => d.toISOString())
        })
      ),
      async (initialCount, mockComments) => {
        // Mock API to return mockComments
        jest.spyOn(commentsApi, 'getComments').mockResolvedValue({
          comments: mockComments
        });

        const { getByText } = render(
          <CommentSection
            postId="test-post"
            initialCommentsCount={initialCount}
            isAuthenticated={true}
            currentUserId="user-1"
          />
        );

        // Verify initial count displayed
        const expectedText = initialCount === 1 ? '1 comment' : `${initialCount} comments`;
        expect(getByText(expectedText)).toBeInTheDocument();

        // After loading, verify count matches actual comments
        await userEvent.click(getByText(/comment/));
        await waitFor(() => {
          const actualCount = mockComments.length;
          const actualText = actualCount === 1 ? '1 comment' : `${actualCount} comments`;
          expect(getByText(actualText)).toBeInTheDocument();
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 11, Requirement 4.1



#### Property 13: Comment Display Completeness

```typescript
// Feature: post-comments, Property 13: Comments display username and time
test('Property 13: Rendered comments include username and timestamp', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        id: fc.uuid(),
        postId: fc.uuid(),
        userId: fc.uuid(),
        username: fc.string({ minLength: 3, maxLength: 20 }),
        text: fc.string({ minLength: 1, maxLength: 500 }),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() })
          .map(d => d.toISOString())
      }),
      async (comment) => {
        const { getByText, container } = render(
          <CommentItem
            comment={comment}
            canDelete={false}
            onDelete={jest.fn()}
          />
        );

        // Verify username displayed
        expect(getByText(comment.username)).toBeInTheDocument();

        // Verify text displayed
        expect(getByText(comment.text)).toBeInTheDocument();

        // Verify timestamp displayed (in some format)
        const timestampElements = container.querySelectorAll('[class*="timestamp"]');
        expect(timestampElements.length).toBeGreaterThan(0);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 13, Requirement 4.3

#### Property 14: Delete Button Visibility

```typescript
// Feature: post-comments, Property 14: Delete button conditional visibility
test('Property 14: Delete button visible only when user is author', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        id: fc.uuid(),
        postId: fc.uuid(),
        userId: fc.uuid(),
        username: fc.string({ minLength: 3, maxLength: 20 }),
        text: fc.string({ minLength: 1, maxLength: 500 }),
        createdAt: fc.date().map(d => d.toISOString())
      }),
      fc.uuid(),
      fc.boolean(),
      async (comment, currentUserId, shouldMatch) => {
        const actualCurrentUserId = shouldMatch ? comment.userId : currentUserId;

        const { queryByRole } = render(
          <CommentItem
            comment={comment}
            canDelete={actualCurrentUserId === comment.userId}
            onDelete={jest.fn()}
          />
        );

        const deleteButton = queryByRole('button', { name: /delete/i });

        if (shouldMatch || actualCurrentUserId === comment.userId) {
          expect(deleteButton).toBeInTheDocument();
        } else {
          expect(deleteButton).not.toBeInTheDocument();
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 14, Requirement 4.5



#### Property 15: Authenticated Input Field Visibility

```typescript
// Feature: post-comments, Property 15: Input fields require authentication
test('Property 15: Comment input visible only when authenticated', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.uuid(),
      fc.integer({ min: 0, max: 50 }),
      async (isAuthenticated, postId, commentsCount) => {
        jest.spyOn(commentsApi, 'getComments').mockResolvedValue({
          comments: []
        });

        const { queryByPlaceholderText, getByText } = render(
          <CommentSection
            postId={postId}
            initialCommentsCount={commentsCount}
            isAuthenticated={isAuthenticated}
            currentUserId={isAuthenticated ? 'user-1' : undefined}
          />
        );

        // Expand comments
        await userEvent.click(getByText(/comment/));

        const textarea = queryByPlaceholderText(/write a comment/i);

        if (isAuthenticated) {
          expect(textarea).toBeInTheDocument();
        } else {
          expect(textarea).not.toBeInTheDocument();
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validates**: Property 15, Requirements 5.1, 5.2

---

## 6. Test Infrastructure

### 6.1 Test Setup and Configuration

#### Backend Test Setup

**File**: `backend/src/functions/comments/__tests__/setup.js`

```javascript
// Global test setup for comment tests
beforeAll(() => {
  // Set environment variables
  process.env.COMMENTS_TABLE = 'test-comments-table';
  process.env.POSTS_TABLE = 'test-posts-table';
  process.env.USERS_TABLE = 'test-users-table';
});

afterAll(() => {
  // Clean up
  delete process.env.COMMENTS_TABLE;
  delete process.env.POSTS_TABLE;
  delete process.env.USERS_TABLE;
});

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
```



#### Frontend Test Setup

**File**: `frontend/src/components/__tests__/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock fetch
global.fetch = jest.fn();
```

### 6.2 Test Utilities

#### Backend Test Helpers

**File**: `backend/src/functions/comments/__tests__/helpers.js`

```javascript
// Helper to create mock event
exports.createMockEvent = (overrides = {}) => ({
  body: JSON.stringify({ text: 'Test comment' }),
  pathParameters: { postId: 'test-post-id' },
  headers: { Authorization: 'Bearer test-token' },
  user: { id: 'test-user-id', username: 'testuser' },
  ...overrides
});

// Helper to create mock comment
exports.createMockComment = (overrides = {}) => ({
  id: 'comment-id',
  postId: 'post-id',
  userId: 'user-id',
  username: 'testuser',
  text: 'Test comment text',
  createdAt: new Date().toISOString(),
  ...overrides
});

// Helper to mock DynamoDB responses
exports.mockDynamoDBSuccess = (mockSend) => {
  mockSend.mockResolvedValue({ Items: [] });
};

exports.mockDynamoDBError = (mockSend, errorMessage) => {
  mockSend.mockRejectedValue(new Error(errorMessage));
};
```



#### Frontend Test Helpers

**File**: `frontend/src/components/__tests__/helpers.tsx`

```typescript
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Comment } from '../../types/comment';

// Helper to render with router
export const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Helper to create mock comment
export const createMockComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 'comment-1',
  postId: 'post-1',
  userId: 'user-1',
  username: 'testuser',
  text: 'Test comment',
  createdAt: new Date().toISOString(),
  ...overrides
});

// Helper to mock API responses
export const mockCommentsApi = {
  createComment: jest.fn(),
  getComments: jest.fn(),
  deleteComment: jest.fn()
};

// Helper to setup localStorage mock
export const setupLocalStorage = (token: string = 'test-token') => {
  (global.localStorage.getItem as jest.Mock).mockReturnValue(token);
};
```

### 6.3 Running Tests

#### Backend Tests

```bash
# Run all backend tests
cd backend
npm test

# Run specific test file
npm test -- src/functions/comments/__tests__/createComment.test.js

# Run with coverage
npm test -- --coverage

# Run property-based tests only
npm test -- src/functions/comments/__tests__/properties.test.js

# Run tests in watch mode
npm test -- --watch
```

#### Frontend Tests

```bash
# Run all frontend unit tests
cd frontend
npm test

# Run specific test file
npm test -- src/components/__tests__/CommentSection.test.tsx

# Run with coverage
npm test -- --coverage

# Run property-based tests only
npm test -- src/components/__tests__/properties.test.tsx

# Run tests in watch mode
npm test -- --watch
```



#### Integration Tests (E2E)

```bash
# Run all E2E tests
cd frontend
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run specific E2E test file
npx playwright test tests/e2e/comments.spec.ts
```

### 6.4 Coverage Requirements

#### Coverage Targets

- **Backend Lambda Functions**: >80% code coverage
- **Frontend Components**: >80% code coverage
- **Integration Tests**: Cover all critical user paths
- **Property-Based Tests**: Minimum 100 iterations per property

#### Coverage Reports

```bash
# Generate backend coverage report
cd backend
npm test -- --coverage
# Report generated in backend/coverage/

# Generate frontend coverage report
cd frontend
npm test -- --coverage
# Report generated in frontend/coverage/

# View HTML coverage report
open coverage/lcov-report/index.html
```

### 6.5 Continuous Integration

#### CI Pipeline Configuration

**File**: `.github/workflows/test-comments.yml` (example)

```yaml
name: Comment Feature Tests

on:
  push:
    paths:
      - 'backend/src/functions/comments/**'
      - 'frontend/src/components/Comment*'
      - 'frontend/src/services/api.ts'
  pull_request:
    paths:
      - 'backend/src/functions/comments/**'
      - 'frontend/src/components/Comment*'

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: cd backend && npm install
      - run: cd backend && npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: cd frontend && npm install
      - run: cd frontend && npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: cd frontend && npm install
      - run: npx playwright install
      - run: cd frontend && npm run test:e2e
```



### 6.6 Test Data Management

#### Test Database Setup

For integration tests, use a separate test database or DynamoDB Local:

```bash
# Install DynamoDB Local
npm install -g dynamodb-local

# Start DynamoDB Local
dynamodb-local

# Configure tests to use local endpoint
export AWS_ENDPOINT_URL=http://localhost:8000
```

#### Test Data Fixtures

**File**: `backend/src/functions/comments/__tests__/fixtures.js`

```javascript
exports.testUsers = [
  { id: 'user-1', username: 'alice', email: 'alice@example.com' },
  { id: 'user-2', username: 'bob', email: 'bob@example.com' },
  { id: 'user-3', username: 'charlie', email: 'charlie@example.com' }
];

exports.testPosts = [
  {
    id: 'post-1',
    userId: 'user-1',
    content: 'First post',
    createdAt: '2024-01-01T10:00:00.000Z',
    commentsCount: 0
  },
  {
    id: 'post-2',
    userId: 'user-2',
    content: 'Second post',
    createdAt: '2024-01-01T11:00:00.000Z',
    commentsCount: 3
  }
];

exports.testComments = [
  {
    id: 'comment-1',
    postId: 'post-2',
    userId: 'user-1',
    username: 'alice',
    text: 'Great post!',
    createdAt: '2024-01-01T11:05:00.000Z'
  },
  {
    id: 'comment-2',
    postId: 'post-2',
    userId: 'user-3',
    username: 'charlie',
    text: 'I agree!',
    createdAt: '2024-01-01T11:10:00.000Z'
  },
  {
    id: 'comment-3',
    postId: 'post-2',
    userId: 'user-2',
    username: 'bob',
    text: 'Thanks everyone!',
    createdAt: '2024-01-01T11:15:00.000Z'
  }
];
```



---

## 7. Test Execution Summary

### 7.1 Test File Checklist

#### Backend Test Files to Create

- [ ] `backend/src/functions/comments/__tests__/createComment.test.js`
  - Tests 1.1.1 through 1.1.11 (11 tests)

- [ ] `backend/src/functions/comments/__tests__/getComments.test.js` ✓ (Partially exists)
  - Tests 1.2.1 through 1.2.8 (8 tests)
  - Tests 1.2.1, 1.2.2, 1.2.5 already implemented
  - Need to add: 1.2.3, 1.2.4, 1.2.6, 1.2.7, 1.2.8

- [ ] `backend/src/functions/comments/__tests__/deleteComment.test.js`
  - Tests 1.3.1 through 1.3.8 (8 tests)

- [ ] `backend/src/functions/comments/__tests__/properties.test.js`
  - Property tests 1-6, 9-10 (8 property tests)

- [ ] `backend/src/functions/comments/__tests__/setup.js`
  - Test configuration and mocks

- [ ] `backend/src/functions/comments/__tests__/helpers.js`
  - Test utility functions

- [ ] `backend/src/functions/comments/__tests__/fixtures.js`
  - Test data fixtures

#### Frontend Test Files to Create

- [ ] `frontend/src/components/__tests__/CommentSection.test.tsx`
  - Tests 2.1.1 through 2.1.18 (18 tests)

- [ ] `frontend/src/components/__tests__/CommentItem.test.tsx`
  - Tests 2.2.1 through 2.2.7 (7 tests)

- [ ] `frontend/src/services/__tests__/commentsApi.test.ts`
  - Tests 2.3.1 through 2.3.7 (7 tests)

- [ ] `frontend/src/components/__tests__/properties.test.tsx`
  - Property tests 11, 13-15 (4 property tests)

- [ ] `frontend/src/components/__tests__/setup.ts`
  - Test configuration

- [ ] `frontend/src/components/__tests__/helpers.tsx`
  - Test utility functions

#### Integration Test Files to Create

- [ ] `frontend/tests/e2e/comments.spec.ts`
  - Tests 3.1.1 through 3.5.2 (10 integration tests)

### 7.2 Test Count Summary

| Category | Test Count |
|----------|-----------|
| Backend Unit Tests | 27 |
| Backend Property Tests | 8 |
| Frontend Unit Tests | 32 |
| Frontend Property Tests | 4 |
| Integration Tests (E2E) | 10 |
| Edge Case Tests | 19 |
| **Total** | **100** |



### 7.3 Requirements Coverage Matrix

| Requirement | Test IDs | Coverage |
|-------------|----------|----------|
| 1.1 Create comment record | 1.1.1, 3.1.1, Property 1 | ✓ |
| 1.2 Associate with post/user | 1.1.1, 1.1.3, Property 1 | ✓ |
| 1.3 Record timestamp | 1.1.1, Property 1 | ✓ |
| 1.4 Validate max length | 1.1.2, 1.1.6, 4.1.4, 4.1.5 | ✓ |
| 1.5 Reject empty/whitespace | 1.1.4, 1.1.5, Property 2, 4.1.1-4.1.3 | ✓ |
| 1.6 Return complete object | 1.1.1, 1.1.3, Property 1 | ✓ |
| 2.1 Retrieve all comments | 1.2.1, 1.2.4, 3.2.1, Property 3 | ✓ |
| 2.2 Sort chronologically | 1.2.3, 3.2.1, Property 4 | ✓ |
| 2.3 Include username | 1.2.1, 3.2.1, Property 3 | ✓ |
| 2.4 Return empty array | 1.2.2, 4.2.1 | ✓ |
| 2.5 Return complete data | 1.2.1, Property 3 | ✓ |
| 3.1 Verify author | 1.3.1, 3.3.1, Property 5 | ✓ |
| 3.2 Delete if author | 1.3.1, 3.3.1, Property 5 | ✓ |
| 3.3 Reject if not author | 1.3.3, 3.3.2, Property 5 | ✓ |
| 3.4 Return success | 1.3.1, 3.3.1 | ✓ |
| 3.5 Return 404 if not found | 1.3.4, 4.3.1 | ✓ |
| 4.1 Display comment count | 2.1.1, 2.1.2, 3.4.1, 3.4.2, Property 11 | ✓ |
| 4.2 Expand comments | 2.1.5, 3.2.1, Property 12 | ✓ |
| 4.3 Display username/time | 2.2.1, 2.2.2, 3.2.1, Property 13 | ✓ |
| 4.4 Chronological order | 1.2.3, 3.2.1, Property 4 | ✓ |
| 4.5 Delete button visibility | 2.1.16, 2.1.17, 2.2.5, 2.2.6, Property 14 | ✓ |
| 5.1 Show input when auth | 2.1.3, Property 15 | ✓ |
| 5.2 Hide input when not auth | 2.1.4, 3.2.2, Property 15 | ✓ |
| 5.3 Provide submit button | 2.1.9 | ✓ |
| 5.4 Disable during submit | 2.1.9, Property 16 | ✓ |
| 5.5 Clear input on success | 2.1.9, 3.1.1, Property 17 | ✓ |
| 5.6 Display error on failure | 2.1.7, 2.1.14, Property 18 | ✓ |
| 6.4 Require auth for POST/DELETE | 1.1.9, 1.3.6, 3.5.2, Property 8 | ✓ |
| 6.5 Allow unauth GET | 1.2.6, 3.2.2, Property 8 | ✓ |
| 6.6 Correct status codes | 1.1.4-1.1.8, 1.3.3-1.3.5, Property 9 | ✓ |
| 6.7 Include CORS headers | 1.2.8, Property 10 | ✓ |
| 7.1 Unique comment IDs | Property 6 | ✓ |
| 7.2 Store postId | Property 1 | ✓ |
| 7.3 Store userId/username | Property 1 | ✓ |
| 7.4 Store ISO 8601 timestamp | Property 1 | ✓ |
| 7.5 Round-trip persistence | 3.1.2, Property 7 | ✓ |

**Coverage**: 100% of requirements covered by tests



### 7.4 Property Coverage Matrix

| Property | Test ID | Validates |
|----------|---------|-----------|
| Property 1: Comment Creation Completeness | Backend Property Test 1 | Requirements 1.1, 1.2, 1.3, 1.6, 7.2, 7.3, 7.4 |
| Property 2: Whitespace Rejection | Backend Property Test 2 | Requirement 1.5 |
| Property 3: Comment Retrieval Completeness | Backend Property Test 3 | Requirements 2.1, 2.3, 2.5 |
| Property 4: Chronological Ordering | Backend Property Test 4 | Requirements 2.2, 4.4 |
| Property 5: Deletion Authorization | Backend Property Test 5 | Requirements 3.1, 3.2, 3.3, 3.4 |
| Property 6: Comment ID Uniqueness | Backend Property Test 6 | Requirement 7.1 |
| Property 7: Round-Trip Persistence | Integration Test 3.1.2 | Requirement 7.5 |
| Property 8: Authentication Requirements | Tests 1.1.9, 1.2.6, 1.3.6 | Requirements 6.4, 6.5 |
| Property 9: HTTP Status Code Correctness | Backend Property Test 9 | Requirement 6.6 |
| Property 10: CORS Headers Presence | Backend Property Test 10 | Requirement 6.7 |
| Property 11: Comment Count Display | Frontend Property Test 11 | Requirement 4.1 |
| Property 12: Comment Expansion Behavior | Test 2.1.5 | Requirement 4.2 |
| Property 13: Comment Display Completeness | Frontend Property Test 13 | Requirement 4.3 |
| Property 14: Delete Button Visibility | Frontend Property Test 14 | Requirement 4.5 |
| Property 15: Authenticated Input Field Visibility | Frontend Property Test 15 | Requirements 5.1, 5.2 |
| Property 16: Submit Button Disabled During Submission | Test 2.1.9 | Requirement 5.4 |
| Property 17: Successful Submission UI Update | Test 2.1.9 | Requirement 5.5 |
| Property 18: Failed Submission Error Display | Test 2.1.14 | Requirement 5.6 |

**Coverage**: All 18 correctness properties validated by tests

---

## 8. Implementation Priority

### Phase 1: Core Backend Tests (Week 1)
1. Create `createComment.test.js` with tests 1.1.1-1.1.11
2. Enhance `getComments.test.js` with tests 1.2.3-1.2.8
3. Create `deleteComment.test.js` with tests 1.3.1-1.3.8
4. Setup test infrastructure (setup.js, helpers.js, fixtures.js)

### Phase 2: Core Frontend Tests (Week 1-2)
1. Create `CommentSection.test.tsx` with tests 2.1.1-2.1.18
2. Create `CommentItem.test.tsx` with tests 2.2.1-2.2.7
3. Create `commentsApi.test.ts` with tests 2.3.1-2.3.7
4. Setup test infrastructure (setup.ts, helpers.tsx)

### Phase 3: Integration Tests (Week 2)
1. Create `comments.spec.ts` with E2E tests 3.1.1-3.5.2
2. Setup Playwright configuration for comment tests
3. Create test data seeding scripts

### Phase 4: Property-Based Tests (Week 2-3)
1. Install and configure fast-check
2. Create backend `properties.test.js` with Properties 1-6, 9-10
3. Create frontend `properties.test.tsx` with Properties 11, 13-15
4. Run property tests with 100+ iterations

### Phase 5: Edge Cases and Polish (Week 3)
1. Implement edge case tests (Section 4)
2. Verify coverage targets met (>80%)
3. Document any gaps or known issues
4. Setup CI pipeline for automated testing

---

## 9. Notes and Considerations

### 9.1 Testing Best Practices

- **Isolation**: Each test should be independent and not rely on other tests
- **Clarity**: Test names should clearly describe what is being tested
- **Maintainability**: Use helper functions to reduce duplication
- **Speed**: Mock external dependencies to keep tests fast
- **Reliability**: Avoid flaky tests by properly handling async operations

### 9.2 Known Limitations

- **Pagination**: MVP doesn't include pagination, so tests assume all comments fit in one response
- **Real-time Updates**: Tests don't cover WebSocket or real-time comment updates (not in MVP)
- **Comment Editing**: No tests for editing comments (feature not in MVP)
- **Nested Replies**: No tests for comment threads (feature not in MVP)
- **Rate Limiting**: No tests for API rate limiting (not implemented in MVP)

### 9.3 Future Test Enhancements

- Add performance tests for posts with 1000+ comments
- Add load tests for concurrent comment creation
- Add security tests for XSS and injection attacks
- Add accessibility tests for screen reader compatibility
- Add visual regression tests for UI components
- Add mutation testing to verify test quality

---

## 10. Conclusion

This comprehensive test plan provides 100 tests covering all requirements, correctness properties, and edge cases for the commenting feature. The tests are organized into:

- **27 backend unit tests** validating Lambda function behavior
- **8 backend property tests** verifying universal properties
- **32 frontend unit tests** validating React component behavior
- **4 frontend property tests** verifying UI properties
- **10 integration tests** validating end-to-end flows
- **19 edge case tests** covering boundary conditions

All tests reference the design document's correctness properties and requirements, ensuring complete traceability from specification to validation. The test infrastructure includes helpers, fixtures, and CI configuration to support ongoing development and maintenance.

