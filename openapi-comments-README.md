# Comments API - OpenAPI Documentation

This directory contains the OpenAPI 3.0 (Swagger) specification for the Comments API endpoints.

## Files

- `openapi-comments.yaml` - Complete OpenAPI 3.0 specification

## API Endpoints

### 1. Create Comment
- **POST** `/posts/{postId}/comments`
- **Authentication**: Required (Bearer token)
- **Description**: Create a new comment on a post
- **Request Body**: `{ "text": "comment text" }`
- **Response**: 201 Created with comment object

### 2. Get Comments
- **GET** `/posts/{postId}/comments`
- **Authentication**: Not required (public)
- **Description**: Retrieve all comments for a post
- **Response**: 200 OK with array of comments

### 3. Delete Comment
- **DELETE** `/comments/{commentId}`
- **Authentication**: Required (Bearer token, author only)
- **Description**: Delete a comment
- **Response**: 200 OK with success message

## Using the Documentation

### Option 1: Swagger UI (Online)
1. Go to [Swagger Editor](https://editor.swagger.io/)
2. Copy the contents of `openapi-comments.yaml`
3. Paste into the editor
4. View interactive documentation in the right panel

### Option 2: Swagger UI (Local)
```bash
# Using Docker
docker run -p 8080:8080 -e SWAGGER_JSON=/openapi-comments.yaml -v $(pwd):/usr/share/nginx/html swaggerapi/swagger-ui

# Then open http://localhost:8080
```

### Option 3: VS Code Extension
1. Install the "OpenAPI (Swagger) Editor" extension
2. Open `openapi-comments.yaml`
3. Right-click and select "Preview Swagger"

### Option 4: Generate API Client
```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate -i openapi-comments.yaml -g typescript-axios -o ./generated-client

# Generate Python client
openapi-generator-cli generate -i openapi-comments.yaml -g python -o ./generated-client
```

## API Base URL

**Production**: `https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod`

## Authentication

Most endpoints require authentication via AWS Cognito JWT token:

```bash
# Example request with authentication
curl -X POST \
  https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/posts/{postId}/comments \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"text": "Great post!"}'
```

## Example Requests

### Create a Comment
```bash
curl -X POST \
  'https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/posts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/comments' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "This is really insightful, thanks for sharing!"
  }'
```

### Get Comments for a Post
```bash
curl -X GET \
  'https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/posts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/comments'
```

### Delete a Comment
```bash
curl -X DELETE \
  'https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/comments/c1d2e3f4-a5b6-7890-cdef-123456789abc' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Schema Details

### Comment Object
```json
{
  "id": "c1d2e3f4-a5b6-7890-cdef-123456789abc",
  "postId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "user123",
  "username": "johndoe",
  "text": "This is a great post!",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Validation Rules
- **text**: Required, 1-500 characters, cannot be empty or whitespace-only
- **postId**: Required, must be a valid UUID
- **commentId**: Required for delete operation, must be a valid UUID

## HTTP Status Codes

- **200 OK**: Successful GET or DELETE operation
- **201 Created**: Comment successfully created
- **400 Bad Request**: Invalid input (missing fields, validation errors)
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: User not authorized (e.g., trying to delete another user's comment)
- **404 Not Found**: Comment does not exist
- **500 Internal Server Error**: Server-side error

## CORS Headers

All responses include CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Credentials: true`

## Implementation Files

Backend Lambda functions:
- `backend/src/functions/comments/createComment.js`
- `backend/src/functions/comments/getComments.js`
- `backend/src/functions/comments/deleteComment.js`

Frontend TypeScript types:
- `frontend/src/types/comment.ts`

## Notes

- Comments are sorted by creation date (oldest first) when retrieved
- Creating a comment increments the post's `commentsCount`
- Deleting a comment decrements the post's `commentsCount`
- Only comment authors can delete their own comments
- The `getComments` endpoint is public and does not require authentication
