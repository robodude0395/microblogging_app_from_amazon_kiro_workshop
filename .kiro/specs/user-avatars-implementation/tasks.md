# Implementation Plan: User Avatars

## Overview

This plan implements a complete avatar management system with S3 storage, CloudFront CDN delivery, presigned URL uploads, and client-side image processing. The implementation follows the existing monorepo structure with JavaScript Lambda functions, TypeScript React frontend, and AWS CDK infrastructure.

## Tasks

- [x] 1. Update infrastructure with avatar storage and CDN
  - [x] 1.1 Create S3 bucket for avatar storage in CDK stack
    - Add AvatarsBucket with private ACL and CORS configuration
    - Configure bucket lifecycle policies for optimization
    - _Requirements: 1.5, 5.4_

  - [x] 1.2 Create CloudFront distribution for avatar delivery
    - Configure CloudFront distribution with S3 origin
    - Set 24-hour cache TTL for avatar images
    - Configure default avatar as fallback
    - _Requirements: 2.4, 9.2_

  - [x] 1.3 Add IAM permissions for Lambda functions
    - Grant s3:PutObject permission to getAvatarUploadUrl function
    - Grant s3:DeleteObject permission to deleteAvatar function
    - Grant s3:GetObject permission for CloudFront OAI
    - _Requirements: 5.1, 5.3_

  - [x] 1.4 Update CDK outputs with avatar bucket and CloudFront URLs
    - Export AVATAR_BUCKET_NAME for Lambda environment variables
    - Export CLOUDFRONT_AVATAR_URL for frontend configuration
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Update DynamoDB schema for avatar URLs
  - [x] 2.1 Add avatarUrl field to UsersTable schema documentation
    - Document avatarUrl as optional string field
    - Document URL format: https://{cloudfront-domain}/{user-id}/avatar.{ext}
    - _Requirements: 1.6, 10.1, 10.4_

- [x] 3. Implement backend Lambda functions
  - [x] 3.1 Create getAvatarUploadUrl Lambda function
    - Implement authentication check using withAuth middleware
    - Generate S3 presigned URL with 15-minute expiration
    - Validate userId matches authenticated user
    - Return presigned URL and upload metadata
    - _Requirements: 5.1, 5.2, 5.3, 7.1_

  - [ ]* 3.2 Write unit tests for getAvatarUploadUrl
    - Test authentication requirement
    - Test presigned URL generation
    - Test userId validation
    - Test error handling
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.3 Create updateAvatar Lambda function
    - Implement authentication check using withAuth middleware
    - Validate userId matches authenticated user
    - Update DynamoDB UsersTable with avatarUrl
    - Return updated user profile
    - _Requirements: 1.6, 3.2, 5.2, 7.2, 10.2_

  - [ ]* 3.4 Write unit tests for updateAvatar
    - Test authentication requirement
    - Test DynamoDB update operation
    - Test userId validation
    - Test error handling
    - _Requirements: 1.6, 3.2, 5.2_

  - [x] 3.5 Create deleteAvatar Lambda function
    - Implement authentication check using withAuth middleware
    - Validate userId matches authenticated user
    - Delete avatar file from S3
    - Remove avatarUrl from DynamoDB UsersTable
    - _Requirements: 4.1, 4.2, 5.2, 7.3_

  - [ ]* 3.6 Write unit tests for deleteAvatar
    - Test authentication requirement
    - Test S3 deletion operation
    - Test DynamoDB update operation
    - Test userId validation
    - _Requirements: 4.1, 4.2, 5.2_

- [x] 4. Update API Gateway routes in CDK
  - [x] 4.1 Add POST /users/{userId}/avatar/upload-url endpoint
    - Wire to getAvatarUploadUrl Lambda function
    - Configure CORS headers
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 4.2 Add PUT /users/{userId}/avatar endpoint
    - Wire to updateAvatar Lambda function
    - Configure CORS headers
    - _Requirements: 7.2, 7.4, 7.5_

  - [x] 4.3 Add DELETE /users/{userId}/avatar endpoint
    - Wire to deleteAvatar Lambda function
    - Configure CORS headers
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 5. Checkpoint - Deploy infrastructure and test backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement frontend API client methods
  - [x] 6.1 Add avatar API methods to services/api.ts
    - Implement getAvatarUploadUrl(userId) method
    - Implement updateAvatar(userId, avatarUrl) method
    - Implement deleteAvatar(userId) method
    - Implement uploadAvatarToS3(presignedUrl, file) method
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. Implement frontend image processing utilities
  - [x] 7.1 Create image validation utility
    - Validate file type (JPEG, PNG, WebP)
    - Validate file size (max 5MB)
    - Return validation errors with user-friendly messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Create image resizing utility
    - Resize images to 400x400 pixels
    - Maintain aspect ratio and crop to square
    - Compress image while maintaining quality
    - Use canvas API for client-side processing
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 7.3 Write unit tests for image utilities
    - Test file type validation
    - Test file size validation
    - Test image resizing logic
    - Test error handling
    - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [x] 8. Create Avatar display component
  - [x] 8.1 Create Avatar.tsx component
    - Accept userId and avatarUrl props
    - Display avatar image with fallback to default
    - Handle image loading errors gracefully
    - Apply consistent sizing and styling
    - Implement lazy loading for performance
    - _Requirements: 2.1, 2.3, 2.5, 9.1, 9.4_

  - [x] 8.2 Add default avatar image to project
    - Create or source default avatar placeholder image
    - Store in frontend public assets
    - Configure as fallback in Avatar component
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 9. Create AvatarUpload component
  - [x] 9.1 Create AvatarUpload.tsx component
    - Implement file input with drag-and-drop support
    - Show upload progress indicator
    - Display validation errors to user
    - Show success confirmation after upload
    - _Requirements: 1.3, 1.4, 1.7_

  - [x] 9.2 Implement upload flow in AvatarUpload
    - Validate image file on selection
    - Process and resize image client-side
    - Request presigned URL from backend
    - Upload directly to S3 using presigned URL
    - Notify backend to update user record
    - Handle upload errors with user feedback
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 6.1, 6.2, 6.3, 6.4_

  - [x] 9.3 Add delete avatar functionality to AvatarUpload
    - Add delete button when avatar exists
    - Confirm deletion with user
    - Call deleteAvatar API endpoint
    - Update UI to show default avatar
    - Display confirmation message
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 10. Integrate Avatar components into existing pages
  - [x] 10.1 Update Profile page with avatar display and upload
    - Add Avatar component to display current avatar
    - Add AvatarUpload component for profile owner
    - Show upload UI only for authenticated user's own profile
    - _Requirements: 2.1, 5.2_

  - [x] 10.2 Update Feed page to display avatars on posts
    - Add Avatar component next to each post
    - Pass author's userId and avatarUrl to Avatar component
    - Ensure avatars load asynchronously without blocking feed
    - _Requirements: 2.2, 9.1_

  - [x] 10.3 Update backend getPosts to include avatar URLs
    - Modify getPosts Lambda to include avatarUrl in user data
    - Ensure avatarUrl is included in post response
    - _Requirements: 2.2, 10.3_

  - [x] 10.4 Update backend getProfile to include avatar URL
    - Verify getProfile Lambda returns avatarUrl field
    - Ensure avatarUrl is included in profile response
    - _Requirements: 2.1, 10.2_

- [x] 11. Add environment configuration for frontend
  - [x] 11.1 Update .env.example with avatar configuration
    - Add VITE_CLOUDFRONT_AVATAR_URL variable
    - Add VITE_DEFAULT_AVATAR_URL variable
    - Document required environment variables
    - _Requirements: 2.4, 8.3_

  - [x] 11.2 Update frontend to use avatar environment variables
    - Configure CloudFront URL for avatar delivery
    - Configure default avatar URL
    - _Requirements: 2.4, 8.3_

- [x] 12. Final checkpoint - End-to-end testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Backend uses JavaScript (CommonJS) for Lambda functions
- Frontend uses TypeScript with React
- Infrastructure uses AWS CDK with TypeScript
- All avatar operations require authentication
- Presigned URLs expire after 15 minutes
- CloudFront cache TTL is 24 hours
- Images are resized to 400x400 pixels client-side before upload
