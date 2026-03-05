# Requirements Document

## Introduction

This document specifies requirements for adding comment functionality to posts in the micro-blogging social media application. Users will be able to add, view, and delete comments on posts they see in their feed, enabling richer conversations and engagement.

## Glossary

- **Comment_System**: The subsystem responsible for managing comments on posts
- **Comment**: A text-based response to a post created by an authenticated user
- **Post**: An existing content item in the feed that can receive comments
- **Authenticated_User**: A user who has successfully logged in via Cognito
- **Comment_Author**: The authenticated user who created a specific comment
- **Post_Author**: The authenticated user who created the post being commented on
- **CommentsTable**: The DynamoDB table storing comment data (PK: id, GSI: postId-index with SK: createdAt)
- **Feed**: The main view where users see posts and their associated comments

## Requirements

### Requirement 1: Create Comments

**User Story:** As an authenticated user, I want to add comments to posts in my feed, so that I can participate in conversations and share my thoughts.

#### Acceptance Criteria

1. WHEN an authenticated user submits a comment with valid text, THE Comment_System SHALL create a comment record in CommentsTable
2. THE Comment_System SHALL associate each comment with the Post id and the Comment_Author id
3. THE Comment_System SHALL record the creation timestamp for each comment
4. WHEN a comment text exceeds 500 characters, THE Comment_System SHALL return a validation error
5. WHEN a comment text is empty or contains only whitespace, THE Comment_System SHALL return a validation error
6. WHEN a comment is successfully created, THE Comment_System SHALL return the complete comment object including id, postId, userId, username, text, and createdAt

### Requirement 2: Retrieve Comments for Posts

**User Story:** As a user viewing the feed, I want to see comments on posts, so that I can read what others have said.

#### Acceptance Criteria

1. WHEN a user requests comments for a post, THE Comment_System SHALL retrieve all comments for that postId from CommentsTable using the postId-index
2. THE Comment_System SHALL return comments sorted by createdAt in ascending order (oldest first)
3. THE Comment_System SHALL include the comment author's username in each comment response
4. WHEN a post has no comments, THE Comment_System SHALL return an empty array
5. THE Comment_System SHALL return comment data including id, postId, userId, username, text, and createdAt for each comment

### Requirement 3: Delete Comments

**User Story:** As a comment author, I want to delete my own comments, so that I can remove content I no longer want visible.

#### Acceptance Criteria

1. WHEN an authenticated user requests to delete a comment, THE Comment_System SHALL verify the user is the Comment_Author
2. WHEN the authenticated user is the Comment_Author, THE Comment_System SHALL remove the comment from CommentsTable
3. IF the authenticated user is not the Comment_Author, THEN THE Comment_System SHALL return an authorization error
4. WHEN a comment is successfully deleted, THE Comment_System SHALL return a success confirmation
5. WHEN a comment id does not exist, THE Comment_System SHALL return a not found error

### Requirement 4: Display Comments in Feed

**User Story:** As a user browsing the feed, I want to see comments displayed under each post, so that I can follow conversations without leaving the feed.

#### Acceptance Criteria

1. THE Feed SHALL display a comment count for each post
2. WHEN a user expands comments for a post, THE Feed SHALL display all comments for that post
3. THE Feed SHALL display each comment with the author's username and creation time
4. THE Feed SHALL display comments in chronological order (oldest first)
5. WHEN an authenticated user views their own comment, THE Feed SHALL display a delete option

### Requirement 5: Comment Input Interface

**User Story:** As an authenticated user, I want an easy way to write and submit comments, so that I can quickly respond to posts.

#### Acceptance Criteria

1. THE Feed SHALL display a comment input field for each post when the user is authenticated
2. WHEN a user is not authenticated, THE Feed SHALL not display comment input fields
3. THE Feed SHALL provide a submit button to post the comment
4. WHEN a comment is being submitted, THE Feed SHALL disable the submit button to prevent duplicate submissions
5. WHEN a comment submission succeeds, THE Feed SHALL clear the input field and display the new comment
6. WHEN a comment submission fails, THE Feed SHALL display an error message to the user

### Requirement 6: API Endpoints

**User Story:** As a developer, I want RESTful API endpoints for comment operations, so that the frontend can interact with the comment system.

#### Acceptance Criteria

1. THE Comment_System SHALL provide a POST /posts/{postId}/comments endpoint to create comments
2. THE Comment_System SHALL provide a GET /posts/{postId}/comments endpoint to retrieve comments
3. THE Comment_System SHALL provide a DELETE /comments/{commentId} endpoint to delete comments
4. THE Comment_System SHALL require authentication for POST and DELETE operations
5. THE Comment_System SHALL allow unauthenticated access to GET operations
6. THE Comment_System SHALL return appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 500)
7. THE Comment_System SHALL include CORS headers in all API responses

### Requirement 7: Data Integrity

**User Story:** As a system administrator, I want comment data to maintain referential integrity, so that the system remains consistent and reliable.

#### Acceptance Criteria

1. THE Comment_System SHALL store each comment with a unique id
2. THE Comment_System SHALL store the postId for each comment to maintain the post-comment relationship
3. THE Comment_System SHALL store the userId and username for each comment to identify the author
4. THE Comment_System SHALL store the createdAt timestamp in ISO 8601 format
5. FOR ALL valid comment objects, storing then retrieving a comment SHALL produce an equivalent object (round-trip property)
