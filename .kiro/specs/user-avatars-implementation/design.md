# Design Document: User Avatars Implementation

## Overview

This design implements a complete avatar management system for the serverless micro-blogging application. The system enables users to upload, display, update, and delete profile pictures with automatic image processing, secure storage, and optimized delivery through AWS infrastructure.

### Key Design Decisions

**S3 + CloudFront Architecture**: Avatar images will be stored in a dedicated S3 bucket and served through CloudFront CDN for optimal performance and global distribution. This approach provides:
- Low-latency image delivery worldwide
- Automatic edge caching (24-hour TTL)
- Cost-effective storage and bandwidth
- Scalability for growing user base

**Presigned URL Upload Pattern**: Rather than uploading images through API Gateway (which has a 10MB payload limit), we use S3 presigned URLs. The flow is:
1. Frontend requests presigned URL from backend
2. Backend generates time-limited S3 upload URL (15 minutes)
3. Frontend uploads directly to S3 using presigned URL
4. Frontend notifies backend to update user record

This pattern avoids API Gateway limitations, reduces Lambda execution time, and provides better upload performance.

**Client-Side Image Processing**: Image validation (format, size) and initial resizing will occur in the browser before upload. This reduces:
- S3 storage costs (smaller files)
- CloudFront bandwidth costs
- Upload time for users
- Need for server-side processing Lambda

**Avatar URL Storage**: Avatar URLs are stored directly in the UsersTable DynamoDB record as a string field. This denormalized approach means:
- No additional database queries to fetch avatars
- Avatar URLs included automatically in user profile responses
- Simple to include in post feed responses (already fetching user data)

**Default Avatar Strategy**: A single default avatar image will be stored in S3 and served through CloudFront. The frontend will handle fallback logic, displaying the default avatar URL when a user's avatarUrl field is null or when image loading fails.

## Architecture

### System Components

```mermaid
graph TB
    subgraph "Frontend (React)"
        UI[Avatar UI Components]
        Upload[Upload Handler]
        Display[Avatar Display]
    end

    subgraph "API Gateway"
        API[REST API]
    end

    subgraph "Lambda Functions"
        GetURL[getAvatarUploadUrl]
        Update[updateAvatar]
        Delete[deleteAvatar]
    end

    subgraph "Storage Layer"
        S3[S3 Avatar Bucket]
        DDB[(DynamoDB UsersTable)]
    end

    subgraph "CDN"
        CF[CloudFront Distribution]
    end

    UI --> Upload
    Upload --> API
    API --> GetURL
    GetURL --> S3
    S3 -.presigned URL.-> Upload
    Upload -.direct upload.-> S3
    Upload --> Update
    Update --> DDB

    UI --> Delete
    Delete --> API
    API --> Delete
    Delete --> S3
    Delete --> DDB

    Display --> CF
    CF --> S3

    style S3 fill:#ff9900
    style CF fill:#8c4fff
    style DDB fill:#4053d6
