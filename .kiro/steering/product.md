# Product Overview

A serverless micro-blogging social media application built on AWS. Users can create accounts, post short messages, follow other users, and interact with posts through likes.

## Core Features

- User authentication and profile management
- Post creation and feed viewing
- Social interactions (follow/unfollow users, like posts)
- Real-time feed with sorting options (recent, popular)
- User profiles with follower/following counts

## Architecture

Full-stack serverless application:
- Frontend: React SPA hosted on S3/CloudFront
- Backend: AWS Lambda functions with API Gateway
- Database: DynamoDB for all data storage
- Authentication: AWS Cognito for user management

## Target Users

Social media users looking for a lightweight, Twitter-like microblogging experience.
