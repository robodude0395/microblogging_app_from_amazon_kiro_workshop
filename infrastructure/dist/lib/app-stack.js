"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const path = require('path');
class AppStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Helper function to get Lambda package path
        const getLambdaPackagePath = (functionName) => {
            return path.join(__dirname, '../../backend/dist/lambda-packages', `${functionName}.zip`);
        };
        // Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            standardAttributes: {
                email: { required: true, mutable: true },
                preferredUsername: { required: true, mutable: true }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // User Pool Client
        this.userPoolClient = this.userPool.addClient('UserPoolClient', {
            authFlows: {
                userPassword: true,
                userSrp: true,
                adminUserPassword: true // Enable ADMIN_USER_PASSWORD_AUTH flow
            },
            preventUserExistenceErrors: true
        });
        // Identity Pool
        this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [{
                    clientId: this.userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName
                }]
        });
        // IAM Roles for authenticated and unauthenticated users
        const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                StringEquals: {
                    'cognito-identity.amazonaws.com:aud': this.identityPool.ref
                },
                'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'authenticated'
                }
            }, 'sts:AssumeRoleWithWebIdentity')
        });
        // Attach role to identity pool
        new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
            identityPoolId: this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn
            }
        });
        // DynamoDB Users Table
        // Schema:
        //   - id (string, partition key): Unique user identifier
        //   - username (string): User's display name
        //   - email (string): User's email address
        //   - bio (string, optional): User biography
        //   - followersCount (number): Count of followers
        //   - followingCount (number): Count of users being followed
        //   - avatarUrl (string, optional): URL to user's avatar image
        //     Format: https://{cloudfront-domain}/{user-id}/avatar.{ext}
        //     Example: https://d1234abcd.cloudfront.net/user-123/avatar.jpg
        //     When null or undefined, the default avatar should be displayed
        this.usersTable = new dynamodb.Table(this, 'UsersTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for username lookups
        this.usersTable.addGlobalSecondaryIndex({
            indexName: 'username-index',
            partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Posts Table
        this.postsTable = new dynamodb.Table(this, 'PostsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for user's posts
        this.postsTable.addGlobalSecondaryIndex({
            indexName: 'userId-index',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Likes Table
        this.likesTable = new dynamodb.Table(this, 'LikesTable', {
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for post's likes
        this.likesTable.addGlobalSecondaryIndex({
            indexName: 'postId-index',
            partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Comments Table
        this.commentsTable = new dynamodb.Table(this, 'CommentsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for post's comments
        this.commentsTable.addGlobalSecondaryIndex({
            indexName: 'postId-index',
            partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Follows Table
        this.followsTable = new dynamodb.Table(this, 'FollowsTable', {
            partitionKey: { name: 'followerId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'followeeId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for followee's followers
        this.followsTable.addGlobalSecondaryIndex({
            indexName: 'followee-index',
            partitionKey: { name: 'followeeId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'followerId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // API Gateway
        this.api = new apigateway.RestApi(this, 'MicroBloggingApi', {
            restApiName: 'Micro Blogging API',
            description: 'API for Micro Blogging application',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
                allowCredentials: true
            }
        });
        // S3 bucket for avatar storage (must be created before Lambda functions that reference it)
        this.avatarsBucket = new s3.Bucket(this, 'AvatarsBucket', {
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicAcls: false,
                blockPublicPolicy: true,
                ignorePublicAcls: false,
                restrictPublicBuckets: true
            }),
            cors: [
                {
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.HEAD
                    ],
                    allowedOrigins: ['*'], // In production, restrict to your domain
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag'],
                    maxAge: 3000
                }
            ],
            lifecycleRules: [
                {
                    // Transition old avatars to Infrequent Access after 90 days
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(90)
                        }
                    ]
                },
                {
                    // Clean up incomplete multipart uploads after 7 days
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
                }
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
            autoDeleteObjects: true // For development only
        });
        // Lambda function for registration
        const registerFunction = new lambda.Function(this, 'RegisterFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'register.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('register')),
            environment: {
                USER_POOL_ID: this.userPool.userPoolId,
                USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for login
        const loginFunction = new lambda.Function(this, 'LoginFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'login.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('login')),
            environment: {
                USER_POOL_ID: this.userPool.userPoolId,
                USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for getting user profile
        const getProfileFunction = new lambda.Function(this, 'GetProfileFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'getProfile.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('getProfile')),
            environment: {
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for updating user profile
        const updateProfileFunction = new lambda.Function(this, 'UpdateProfileFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'updateProfile.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('updateProfile')),
            environment: {
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for following a user
        const followUserFunction = new lambda.Function(this, 'FollowUserFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'followUser.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('followUser')),
            environment: {
                USERS_TABLE: this.usersTable.tableName,
                FOLLOWS_TABLE: this.followsTable.tableName
            }
        });
        // Lambda function for unfollowing a user
        const unfollowUserFunction = new lambda.Function(this, 'UnfollowUserFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'unfollowUser.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('unfollowUser')),
            environment: {
                USERS_TABLE: this.usersTable.tableName,
                FOLLOWS_TABLE: this.followsTable.tableName
            }
        });
        // Lambda function for checking if following a user
        const checkFollowingFunction = new lambda.Function(this, 'CheckFollowingFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'checkFollowing.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('checkFollowing')),
            environment: {
                FOLLOWS_TABLE: this.followsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for creating posts
        const createPostFunction = new lambda.Function(this, 'CreatePostFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'createPost.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('createPost')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for getting posts
        const getPostsFunction = new lambda.Function(this, 'GetPostsFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'getPosts.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('getPosts')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for liking posts
        const likePostFunction = new lambda.Function(this, 'LikePostFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'likePost.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('likePost')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                LIKES_TABLE: this.likesTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for getting avatar upload URL
        const getAvatarUploadUrlFunction = new lambda.Function(this, 'GetAvatarUploadUrlFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'getAvatarUploadUrl.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('getAvatarUploadUrl')),
            environment: {
                AVATARS_BUCKET: this.avatarsBucket.bucketName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for updating avatar
        const updateAvatarFunction = new lambda.Function(this, 'UpdateAvatarFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'updateAvatar.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('updateAvatar')),
            environment: {
                USERS_TABLE: this.usersTable.tableName,
                AVATARS_BUCKET: this.avatarsBucket.bucketName
            }
        });
        // Lambda function for deleting avatar
        const deleteAvatarFunction = new lambda.Function(this, 'DeleteAvatarFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'deleteAvatar.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('deleteAvatar')),
            environment: {
                AVATARS_BUCKET: this.avatarsBucket.bucketName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
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
        // Grant permissions to Lambda functions
        this.userPool.grant(registerFunction, 'cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword');
        this.userPool.grant(loginFunction, 'cognito-idp:AdminInitiateAuth', 'cognito-idp:GetUser');
        this.usersTable.grantReadWriteData(registerFunction);
        this.usersTable.grantReadData(loginFunction);
        this.usersTable.grantReadData(getProfileFunction);
        this.usersTable.grantReadWriteData(updateProfileFunction);
        this.usersTable.grantReadWriteData(followUserFunction);
        this.usersTable.grantReadWriteData(unfollowUserFunction);
        this.usersTable.grantReadData(getPostsFunction); // Add read permission for Users table
        this.usersTable.grantReadData(createPostFunction); // Add read permission for Users table
        this.usersTable.grantReadData(likePostFunction); // Add read permission for Users table
        this.usersTable.grantReadData(checkFollowingFunction); // Add read permission for Users table
        this.followsTable.grantReadWriteData(followUserFunction);
        this.followsTable.grantReadWriteData(unfollowUserFunction);
        this.followsTable.grantReadData(checkFollowingFunction);
        this.postsTable.grantReadWriteData(createPostFunction);
        this.postsTable.grantReadData(getPostsFunction);
        this.postsTable.grantReadWriteData(likePostFunction);
        this.likesTable.grantReadWriteData(likePostFunction);
        // Grant S3 permissions for avatar Lambda functions
        // Grant s3:PutObject permission to getAvatarUploadUrl function (for presigned URL generation)
        this.avatarsBucket.grantPut(getAvatarUploadUrlFunction);
        // Grant s3:DeleteObject permission to deleteAvatar function
        this.avatarsBucket.grantDelete(deleteAvatarFunction);
        // Grant DynamoDB permissions for avatar functions
        this.usersTable.grantReadData(getAvatarUploadUrlFunction);
        this.usersTable.grantReadWriteData(updateAvatarFunction);
        this.usersTable.grantReadWriteData(deleteAvatarFunction);
        // Grant DynamoDB permissions for comment Lambda functions
        this.commentsTable.grantReadWriteData(createCommentFunction);
        this.postsTable.grantReadWriteData(createCommentFunction);
        this.usersTable.grantReadData(createCommentFunction);
        this.commentsTable.grantReadData(getCommentsFunction);
        this.commentsTable.grantReadWriteData(deleteCommentFunction);
        this.postsTable.grantReadWriteData(deleteCommentFunction);
        this.usersTable.grantReadData(deleteCommentFunction);
        // API Gateway endpoints
        const auth = this.api.root.addResource('auth');
        const register = auth.addResource('register');
        register.addMethod('POST', new apigateway.LambdaIntegration(registerFunction));
        const login = auth.addResource('login');
        login.addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
        const users = this.api.root.addResource('users');
        const userId = users.addResource('{userId}');
        userId.addMethod('GET', new apigateway.LambdaIntegration(getProfileFunction));
        userId.addMethod('PUT', new apigateway.LambdaIntegration(updateProfileFunction));
        // Follow/unfollow endpoints
        const follow = userId.addResource('follow');
        follow.addMethod('POST', new apigateway.LambdaIntegration(followUserFunction));
        const unfollow = userId.addResource('unfollow');
        unfollow.addMethod('POST', new apigateway.LambdaIntegration(unfollowUserFunction));
        const following = userId.addResource('following');
        following.addMethod('GET', new apigateway.LambdaIntegration(checkFollowingFunction));
        const posts = this.api.root.addResource('posts');
        posts.addMethod('GET', new apigateway.LambdaIntegration(getPostsFunction));
        posts.addMethod('POST', new apigateway.LambdaIntegration(createPostFunction));
        const userPosts = userId.addResource('posts');
        userPosts.addMethod('GET', new apigateway.LambdaIntegration(getPostsFunction));
        // Avatar endpoints
        const avatar = userId.addResource('avatar');
        avatar.addMethod('PUT', new apigateway.LambdaIntegration(updateAvatarFunction));
        avatar.addMethod('DELETE', new apigateway.LambdaIntegration(deleteAvatarFunction));
        const uploadUrl = avatar.addResource('upload-url');
        uploadUrl.addMethod('POST', new apigateway.LambdaIntegration(getAvatarUploadUrlFunction));
        const postId = posts.addResource('{postId}');
        const likePost = postId.addResource('like');
        likePost.addMethod('POST', new apigateway.LambdaIntegration(likePostFunction));
        // Comment endpoints
        const postComments = postId.addResource('comments');
        postComments.addMethod('POST', new apigateway.LambdaIntegration(createCommentFunction));
        postComments.addMethod('GET', new apigateway.LambdaIntegration(getCommentsFunction));
        const comments = this.api.root.addResource('comments');
        const commentId = comments.addResource('{commentId}');
        commentId.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCommentFunction));
        // S3 bucket for frontend hosting
        this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Keep all public access blocked
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
            autoDeleteObjects: true, // For development only
        });
        // CloudFront Origin Access Identity for website bucket
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
            comment: 'Allow CloudFront to access the S3 bucket'
        });
        // Grant read permissions to CloudFront OAI
        this.websiteBucket.grantRead(originAccessIdentity);
        // CloudFront distribution for website
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.websiteBucket, {
                    originAccessIdentity: originAccessIdentity
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html', // Serve index.html as the root
            errorResponses: [
                {
                    // Return index.html for 403 errors (when file not found)
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(0)
                },
                {
                    // Return index.html for 404 errors (when file not found)
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(0)
                }
            ]
        });
        // CloudFront Origin Access Identity for avatars bucket
        const avatarsOriginAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'AvatarsOriginAccessIdentity', {
            comment: 'Allow CloudFront to access the avatars S3 bucket'
        });
        // Grant read permissions to CloudFront OAI for avatars bucket
        this.avatarsBucket.grantRead(avatarsOriginAccessIdentity);
        // CloudFront distribution for avatar delivery
        this.avatarsDistribution = new cloudfront.Distribution(this, 'AvatarsDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.avatarsBucket, {
                    originAccessIdentity: avatarsOriginAccessIdentity
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: new cloudfront.CachePolicy(this, 'AvatarsCachePolicy', {
                    cachePolicyName: 'AvatarsCachePolicy',
                    comment: '24-hour cache for avatar images',
                    defaultTtl: cdk.Duration.hours(24),
                    maxTtl: cdk.Duration.hours(24),
                    minTtl: cdk.Duration.hours(24),
                    enableAcceptEncodingGzip: true,
                    enableAcceptEncodingBrotli: true,
                    headerBehavior: cloudfront.CacheHeaderBehavior.none(),
                    queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
                    cookieBehavior: cloudfront.CacheCookieBehavior.none()
                }),
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD
            },
            errorResponses: [
                {
                    // Return default avatar for 403 errors (when avatar not found)
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/default-avatar.png',
                    ttl: cdk.Duration.hours(24)
                },
                {
                    // Return default avatar for 404 errors (when avatar not found)
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/default-avatar.png',
                    ttl: cdk.Duration.hours(24)
                }
            ]
        });
        // Grant authenticated users access to their own user data
        this.usersTable.grantReadWriteData(authenticatedRole);
        this.postsTable.grantReadWriteData(authenticatedRole);
        this.likesTable.grantReadWriteData(authenticatedRole);
        this.commentsTable.grantReadWriteData(authenticatedRole);
        this.followsTable.grantReadWriteData(authenticatedRole);
        // Output the configuration values for frontend .env file
        // Order matches the .env file: VITE_API_URL, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID, VITE_IDENTITY_POOL_ID
        new cdk.CfnOutput(this, 'ViteApiUrl', {
            value: this.api.url,
            description: 'API Gateway endpoint URL'
        });
        new cdk.CfnOutput(this, 'ViteUserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID'
        });
        new cdk.CfnOutput(this, 'ViteUserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID'
        });
        new cdk.CfnOutput(this, 'ViteIdentityPoolId', {
            value: this.identityPool.ref,
            description: 'Cognito Identity Pool ID'
        });
        // Output CloudFront domain for avatars
        new cdk.CfnOutput(this, 'AvatarsCdnDomain', {
            value: this.avatarsDistribution.distributionDomainName,
            description: 'CloudFront domain for avatar images'
        });
        // Output avatar bucket name for Lambda environment variables
        new cdk.CfnOutput(this, 'AvatarBucketName', {
            value: this.avatarsBucket.bucketName,
            description: 'S3 bucket name for avatar storage'
        });
        // Output CloudFront avatar URL for frontend configuration
        new cdk.CfnOutput(this, 'ViteCloudfrontAvatarUrl', {
            value: `https://${this.avatarsDistribution.distributionDomainName}`,
            description: 'CloudFront URL for avatar delivery'
        });
    }
}
exports.AppStack = AppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2FwcC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQyxtRUFBcUQ7QUFDckQsdUVBQXlEO0FBQ3pELCtEQUFpRDtBQUNqRCx1REFBeUM7QUFDekMsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUk5RCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFHN0IsTUFBYSxRQUFTLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFlckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw2Q0FBNkM7UUFDN0MsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLFlBQW9CLEVBQUUsRUFBRTtZQUNwRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9DQUFvQyxFQUFFLEdBQUcsWUFBWSxNQUFNLENBQUMsQ0FBQztRQUMzRixDQUFDLENBQUM7UUFFRixvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNyRCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDM0Isa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDeEMsaUJBQWlCLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDckQ7WUFDRCxjQUFjLEVBQUU7Z0JB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QUNqRCxLQUFLLEVBQUUsV0FBVyxJQUFJLENBQUMsbUJBQW1CLENBQUMsc0JBQXNCLEVBQUU7WUFDbkUsV0FBVyxFQUFFLG9DQUFvQztTQUNsRCxDQUFDLENBQUM7SUFFTCxDQUFDO0NBQ0Y7QUF6bkJELDRCQXluQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5cbmRlY2xhcmUgY29uc3QgcmVxdWlyZTogYW55O1xuZGVjbGFyZSBjb25zdCBfX2Rpcm5hbWU6IHN0cmluZztcbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5cblxuZXhwb3J0IGNsYXNzIEFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSBpZGVudGl0eVBvb2w6IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlcnNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBwb3N0c1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGxpa2VzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgY29tbWVudHNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBmb2xsb3dzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzaXRlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYXZhdGFyc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXZhdGFyc0Rpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGdldCBMYW1iZGEgcGFja2FnZSBwYXRoXG4gICAgY29uc3QgZ2V0TGFtYmRhUGFja2FnZVBhdGggPSAoZnVuY3Rpb25OYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0L2xhbWJkYS1wYWNrYWdlcycsIGAke2Z1bmN0aW9uTmFtZX0uemlwYCk7XG4gICAgfTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICAgIHByZWZlcnJlZFVzZXJuYW1lOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH1cbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kgLy8gRm9yIGRldmVsb3BtZW50IG9ubHlcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnRcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbC5hZGRDbGllbnQoJ1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IHRydWUgIC8vIEVuYWJsZSBBRE1JTl9VU0VSX1BBU1NXT1JEX0FVVEggZmxvd1xuICAgICAgfSxcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBJZGVudGl0eSBQb29sXG4gICAgdGhpcy5pZGVudGl0eVBvb2wgPSBuZXcgY29nbml0by5DZm5JZGVudGl0eVBvb2wodGhpcywgJ0lkZW50aXR5UG9vbCcsIHtcbiAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogZmFsc2UsXG4gICAgICBjb2duaXRvSWRlbnRpdHlQcm92aWRlcnM6IFt7XG4gICAgICAgIGNsaWVudElkOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIHByb3ZpZGVyTmFtZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZVxuICAgICAgfV1cbiAgICB9KTtcblxuICAgIC8vIElBTSBSb2xlcyBmb3IgYXV0aGVudGljYXRlZCBhbmQgdW5hdXRoZW50aWNhdGVkIHVzZXJzXG4gICAgY29uc3QgYXV0aGVudGljYXRlZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0F1dGhlbnRpY2F0ZWRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbScsXG4gICAgICAgIHtcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgICdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkJzogdGhpcy5pZGVudGl0eVBvb2wucmVmXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnRm9yQW55VmFsdWU6U3RyaW5nTGlrZSc6IHtcbiAgICAgICAgICAgICdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yJzogJ2F1dGhlbnRpY2F0ZWQnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnc3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHknXG4gICAgICApXG4gICAgfSk7XG5cbiAgICAvLyBBdHRhY2ggcm9sZSB0byBpZGVudGl0eSBwb29sXG4gICAgbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnQodGhpcywgJ0lkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50Jywge1xuICAgICAgaWRlbnRpdHlQb29sSWQ6IHRoaXMuaWRlbnRpdHlQb29sLnJlZixcbiAgICAgIHJvbGVzOiB7XG4gICAgICAgIGF1dGhlbnRpY2F0ZWQ6IGF1dGhlbnRpY2F0ZWRSb2xlLnJvbGVBcm5cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RCIFVzZXJzIFRhYmxlXG4gICAgLy8gU2NoZW1hOlxuICAgIC8vICAgLSBpZCAoc3RyaW5nLCBwYXJ0aXRpb24ga2V5KTogVW5pcXVlIHVzZXIgaWRlbnRpZmllclxuICAgIC8vICAgLSB1c2VybmFtZSAoc3RyaW5nKTogVXNlcidzIGRpc3BsYXkgbmFtZVxuICAgIC8vICAgLSBlbWFpbCAoc3RyaW5nKTogVXNlcidzIGVtYWlsIGFkZHJlc3NcbiAgICAvLyAgIC0gYmlvIChzdHJpbmcsIG9wdGlvbmFsKTogVXNlciBiaW9ncmFwaHlcbiAgICAvLyAgIC0gZm9sbG93ZXJzQ291bnQgKG51bWJlcik6IENvdW50IG9mIGZvbGxvd2Vyc1xuICAgIC8vICAgLSBmb2xsb3dpbmdDb3VudCAobnVtYmVyKTogQ291bnQgb2YgdXNlcnMgYmVpbmcgZm9sbG93ZWRcbiAgICAvLyAgIC0gYXZhdGFyVXJsIChzdHJpbmcsIG9wdGlvbmFsKTogVVJMIHRvIHVzZXIncyBhdmF0YXIgaW1hZ2VcbiAgICAvLyAgICAgRm9ybWF0OiBodHRwczovL3tjbG91ZGZyb250LWRvbWFpbn0ve3VzZXItaWR9L2F2YXRhci57ZXh0fVxuICAgIC8vICAgICBFeGFtcGxlOiBodHRwczovL2QxMjM0YWJjZC5jbG91ZGZyb250Lm5ldC91c2VyLTEyMy9hdmF0YXIuanBnXG4gICAgLy8gICAgIFdoZW4gbnVsbCBvciB1bmRlZmluZWQsIHRoZSBkZWZhdWx0IGF2YXRhciBzaG91bGQgYmUgZGlzcGxheWVkXG4gICAgdGhpcy51c2Vyc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc2Vyc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSAvLyBGb3IgZGV2ZWxvcG1lbnQgb25seVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgdXNlcm5hbWUgbG9va3Vwc1xuICAgIHRoaXMudXNlcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VybmFtZS1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJuYW1lJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RCIFBvc3RzIFRhYmxlXG4gICAgdGhpcy5wb3N0c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQb3N0c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSAvLyBGb3IgZGV2ZWxvcG1lbnQgb25seVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgdXNlcidzIHBvc3RzXG4gICAgdGhpcy5wb3N0c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3VzZXJJZC1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgTGlrZXMgVGFibGVcbiAgICB0aGlzLmxpa2VzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0xpa2VzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdwb3N0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kgLy8gRm9yIGRldmVsb3BtZW50IG9ubHlcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHBvc3QncyBsaWtlc1xuICAgIHRoaXMubGlrZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdwb3N0SWQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwb3N0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgQ29tbWVudHMgVGFibGVcbiAgICB0aGlzLmNvbW1lbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0NvbW1lbnRzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBwb3N0J3MgY29tbWVudHNcbiAgICB0aGlzLmNvbW1lbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAncG9zdElkLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncG9zdElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NyZWF0ZWRBdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBGb2xsb3dzIFRhYmxlXG4gICAgdGhpcy5mb2xsb3dzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0ZvbGxvd3NUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZm9sbG93ZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmb2xsb3dlZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBmb2xsb3dlZSdzIGZvbGxvd2Vyc1xuICAgIHRoaXMuZm9sbG93c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2ZvbGxvd2VlLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZm9sbG93ZWVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmb2xsb3dlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdNaWNyb0Jsb2dnaW5nQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdNaWNybyBCbG9nZ2luZyBBUEknLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIE1pY3JvIEJsb2dnaW5nIGFwcGxpY2F0aW9uJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogYXBpZ2F0ZXdheS5Db3JzLkRFRkFVTFRfSEVBREVSUyxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBhdmF0YXIgc3RvcmFnZSAobXVzdCBiZSBjcmVhdGVkIGJlZm9yZSBMYW1iZGEgZnVuY3Rpb25zIHRoYXQgcmVmZXJlbmNlIGl0KVxuICAgIHRoaXMuYXZhdGFyc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0F2YXRhcnNCdWNrZXQnLCB7XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IHRydWUsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IHRydWVcbiAgICAgIH0pLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFEXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sIC8vIEluIHByb2R1Y3Rpb24sIHJlc3RyaWN0IHRvIHlvdXIgZG9tYWluXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDBcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBUcmFuc2l0aW9uIG9sZCBhdmF0YXJzIHRvIEluZnJlcXVlbnQgQWNjZXNzIGFmdGVyIDkwIGRheXNcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBDbGVhbiB1cCBpbmNvbXBsZXRlIG11bHRpcGFydCB1cGxvYWRzIGFmdGVyIDcgZGF5c1xuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg3KVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gRm9yIGRldmVsb3BtZW50IG9ubHlcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHJlZ2lzdHJhdGlvblxuICAgIGNvbnN0IHJlZ2lzdGVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWdpc3RlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAncmVnaXN0ZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ3JlZ2lzdGVyJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgVVNFUlNfVEFCTEU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgbG9naW5cbiAgICBjb25zdCBsb2dpbkZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTG9naW5GdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2xvZ2luLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdsb2dpbicpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGdldHRpbmcgdXNlciBwcm9maWxlXG4gICAgY29uc3QgZ2V0UHJvZmlsZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UHJvZmlsZUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0UHJvZmlsZS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZ2V0UHJvZmlsZScpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHVwZGF0aW5nIHVzZXIgcHJvZmlsZVxuICAgIGNvbnN0IHVwZGF0ZVByb2ZpbGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwZGF0ZVByb2ZpbGVGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ3VwZGF0ZVByb2ZpbGUuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ3VwZGF0ZVByb2ZpbGUnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBmb2xsb3dpbmcgYSB1c2VyXG4gICAgY29uc3QgZm9sbG93VXNlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRm9sbG93VXNlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnZm9sbG93VXNlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZm9sbG93VXNlcicpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBGT0xMT1dTX1RBQkxFOiB0aGlzLmZvbGxvd3NUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgdW5mb2xsb3dpbmcgYSB1c2VyXG4gICAgY29uc3QgdW5mb2xsb3dVc2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVbmZvbGxvd1VzZXJGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ3VuZm9sbG93VXNlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgndW5mb2xsb3dVc2VyJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUlNfVEFCTEU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEZPTExPV1NfVEFCTEU6IHRoaXMuZm9sbG93c1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBjaGVja2luZyBpZiBmb2xsb3dpbmcgYSB1c2VyXG4gICAgY29uc3QgY2hlY2tGb2xsb3dpbmdGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrRm9sbG93aW5nRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdjaGVja0ZvbGxvd2luZy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnY2hlY2tGb2xsb3dpbmcnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBGT0xMT1dTX1RBQkxFOiB0aGlzLmZvbGxvd3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIHBvc3RzXG4gICAgY29uc3QgY3JlYXRlUG9zdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlUG9zdEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnY3JlYXRlUG9zdC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnY3JlYXRlUG9zdCcpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBPU1RTX1RBQkxFOiB0aGlzLnBvc3RzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBnZXR0aW5nIHBvc3RzXG4gICAgY29uc3QgZ2V0UG9zdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFBvc3RzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdnZXRQb3N0cy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZ2V0UG9zdHMnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQT1NUU19UQUJMRTogdGhpcy5wb3N0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUlNfVEFCTEU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgbGlraW5nIHBvc3RzXG4gICAgY29uc3QgbGlrZVBvc3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpa2VQb3N0RnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdsaWtlUG9zdC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnbGlrZVBvc3QnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQT1NUU19UQUJMRTogdGhpcy5wb3N0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgTElLRVNfVEFCTEU6IHRoaXMubGlrZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGdldHRpbmcgYXZhdGFyIHVwbG9hZCBVUkxcbiAgICBjb25zdCBnZXRBdmF0YXJVcGxvYWRVcmxGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEF2YXRhclVwbG9hZFVybEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0QXZhdGFyVXBsb2FkVXJsLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdnZXRBdmF0YXJVcGxvYWRVcmwnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBBVkFUQVJTX0JVQ0tFVDogdGhpcy5hdmF0YXJzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHVwZGF0aW5nIGF2YXRhclxuICAgIGNvbnN0IHVwZGF0ZUF2YXRhckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlQXZhdGFyRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICd1cGRhdGVBdmF0YXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ3VwZGF0ZUF2YXRhcicpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVkFUQVJTX0JVQ0tFVDogdGhpcy5hdmF0YXJzQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgZGVsZXRpbmcgYXZhdGFyXG4gICAgY29uc3QgZGVsZXRlQXZhdGFyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWxldGVBdmF0YXJGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2RlbGV0ZUF2YXRhci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZGVsZXRlQXZhdGFyJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQVZBVEFSU19CVUNLRVQ6IHRoaXMuYXZhdGFyc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBjcmVhdGluZyBjb21tZW50c1xuICAgIGNvbnN0IGNyZWF0ZUNvbW1lbnRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NyZWF0ZUNvbW1lbnRGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2NyZWF0ZUNvbW1lbnQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ2NyZWF0ZUNvbW1lbnQnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBDT01NRU5UU19UQUJMRTogdGhpcy5jb21tZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUE9TVFNfVEFCTEU6IHRoaXMucG9zdHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGdldHRpbmcgY29tbWVudHNcbiAgICBjb25zdCBnZXRDb21tZW50c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0Q29tbWVudHNGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2dldENvbW1lbnRzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdnZXRDb21tZW50cycpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIENPTU1FTlRTX1RBQkxFOiB0aGlzLmNvbW1lbnRzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGRlbGV0aW5nIGNvbW1lbnRzXG4gICAgY29uc3QgZGVsZXRlQ29tbWVudEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGVsZXRlQ29tbWVudEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnZGVsZXRlQ29tbWVudC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZGVsZXRlQ29tbWVudCcpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIENPTU1FTlRTX1RBQkxFOiB0aGlzLmNvbW1lbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQT1NUU19UQUJMRTogdGhpcy5wb3N0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUlNfVEFCTEU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuXG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBMYW1iZGEgZnVuY3Rpb25zXG4gICAgdGhpcy51c2VyUG9vbC5ncmFudChyZWdpc3RlckZ1bmN0aW9uLCAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJywgJ2NvZ25pdG8taWRwOkFkbWluU2V0VXNlclBhc3N3b3JkJyk7XG4gICAgdGhpcy51c2VyUG9vbC5ncmFudChsb2dpbkZ1bmN0aW9uLCAnY29nbml0by1pZHA6QWRtaW5Jbml0aWF0ZUF1dGgnLCAnY29nbml0by1pZHA6R2V0VXNlcicpO1xuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocmVnaXN0ZXJGdW5jdGlvbik7XG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEobG9naW5GdW5jdGlvbik7XG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0UHJvZmlsZUZ1bmN0aW9uKTtcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVwZGF0ZVByb2ZpbGVGdW5jdGlvbik7XG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShmb2xsb3dVc2VyRnVuY3Rpb24pO1xuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodW5mb2xsb3dVc2VyRnVuY3Rpb24pO1xuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWREYXRhKGdldFBvc3RzRnVuY3Rpb24pOyAgLy8gQWRkIHJlYWQgcGVybWlzc2lvbiBmb3IgVXNlcnMgdGFibGVcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShjcmVhdGVQb3N0RnVuY3Rpb24pOyAgLy8gQWRkIHJlYWQgcGVybWlzc2lvbiBmb3IgVXNlcnMgdGFibGVcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShsaWtlUG9zdEZ1bmN0aW9uKTsgIC8vIEFkZCByZWFkIHBlcm1pc3Npb24gZm9yIFVzZXJzIHRhYmxlXG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEoY2hlY2tGb2xsb3dpbmdGdW5jdGlvbik7ICAvLyBBZGQgcmVhZCBwZXJtaXNzaW9uIGZvciBVc2VycyB0YWJsZVxuICAgIHRoaXMuZm9sbG93c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShmb2xsb3dVc2VyRnVuY3Rpb24pO1xuICAgIHRoaXMuZm9sbG93c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1bmZvbGxvd1VzZXJGdW5jdGlvbik7XG4gICAgdGhpcy5mb2xsb3dzVGFibGUuZ3JhbnRSZWFkRGF0YShjaGVja0ZvbGxvd2luZ0Z1bmN0aW9uKTtcbiAgICB0aGlzLnBvc3RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNyZWF0ZVBvc3RGdW5jdGlvbik7XG4gICAgdGhpcy5wb3N0c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0UG9zdHNGdW5jdGlvbik7XG4gICAgdGhpcy5wb3N0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsaWtlUG9zdEZ1bmN0aW9uKTtcbiAgICB0aGlzLmxpa2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxpa2VQb3N0RnVuY3Rpb24pO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnMgZm9yIGF2YXRhciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgLy8gR3JhbnQgczM6UHV0T2JqZWN0IHBlcm1pc3Npb24gdG8gZ2V0QXZhdGFyVXBsb2FkVXJsIGZ1bmN0aW9uIChmb3IgcHJlc2lnbmVkIFVSTCBnZW5lcmF0aW9uKVxuICAgIHRoaXMuYXZhdGFyc0J1Y2tldC5ncmFudFB1dChnZXRBdmF0YXJVcGxvYWRVcmxGdW5jdGlvbik7XG4gICAgLy8gR3JhbnQgczM6RGVsZXRlT2JqZWN0IHBlcm1pc3Npb24gdG8gZGVsZXRlQXZhdGFyIGZ1bmN0aW9uXG4gICAgdGhpcy5hdmF0YXJzQnVja2V0LmdyYW50RGVsZXRlKGRlbGV0ZUF2YXRhckZ1bmN0aW9uKTtcbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9ucyBmb3IgYXZhdGFyIGZ1bmN0aW9uc1xuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWREYXRhKGdldEF2YXRhclVwbG9hZFVybEZ1bmN0aW9uKTtcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVwZGF0ZUF2YXRhckZ1bmN0aW9uKTtcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRlbGV0ZUF2YXRhckZ1bmN0aW9uKTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIGZvciBjb21tZW50IExhbWJkYSBmdW5jdGlvbnNcbiAgICB0aGlzLmNvbW1lbnRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNyZWF0ZUNvbW1lbnRGdW5jdGlvbik7XG4gICAgdGhpcy5wb3N0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjcmVhdGVDb21tZW50RnVuY3Rpb24pO1xuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWREYXRhKGNyZWF0ZUNvbW1lbnRGdW5jdGlvbik7XG4gICAgdGhpcy5jb21tZW50c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0Q29tbWVudHNGdW5jdGlvbik7XG4gICAgdGhpcy5jb21tZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkZWxldGVDb21tZW50RnVuY3Rpb24pO1xuICAgIHRoaXMucG9zdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZGVsZXRlQ29tbWVudEZ1bmN0aW9uKTtcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShkZWxldGVDb21tZW50RnVuY3Rpb24pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgZW5kcG9pbnRzXG4gICAgY29uc3QgYXV0aCA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2F1dGgnKTtcbiAgICBjb25zdCByZWdpc3RlciA9IGF1dGguYWRkUmVzb3VyY2UoJ3JlZ2lzdGVyJyk7XG4gICAgcmVnaXN0ZXIuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocmVnaXN0ZXJGdW5jdGlvbikpO1xuXG4gICAgY29uc3QgbG9naW4gPSBhdXRoLmFkZFJlc291cmNlKCdsb2dpbicpO1xuICAgIGxvZ2luLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxvZ2luRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHVzZXJzID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgndXNlcnMnKTtcbiAgICBjb25zdCB1c2VySWQgPSB1c2Vycy5hZGRSZXNvdXJjZSgne3VzZXJJZH0nKTtcbiAgICB1c2VySWQuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQcm9maWxlRnVuY3Rpb24pKTtcbiAgICB1c2VySWQuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVQcm9maWxlRnVuY3Rpb24pKTtcblxuICAgIC8vIEZvbGxvdy91bmZvbGxvdyBlbmRwb2ludHNcbiAgICBjb25zdCBmb2xsb3cgPSB1c2VySWQuYWRkUmVzb3VyY2UoJ2ZvbGxvdycpO1xuICAgIGZvbGxvdy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmb2xsb3dVc2VyRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHVuZm9sbG93ID0gdXNlcklkLmFkZFJlc291cmNlKCd1bmZvbGxvdycpO1xuICAgIHVuZm9sbG93LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVuZm9sbG93VXNlckZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBmb2xsb3dpbmcgPSB1c2VySWQuYWRkUmVzb3VyY2UoJ2ZvbGxvd2luZycpO1xuICAgIGZvbGxvd2luZy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNoZWNrRm9sbG93aW5nRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHBvc3RzID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgncG9zdHMnKTtcbiAgICBwb3N0cy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFBvc3RzRnVuY3Rpb24pKTtcbiAgICBwb3N0cy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVQb3N0RnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHVzZXJQb3N0cyA9IHVzZXJJZC5hZGRSZXNvdXJjZSgncG9zdHMnKTtcbiAgICB1c2VyUG9zdHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQb3N0c0Z1bmN0aW9uKSk7XG5cbiAgICAvLyBBdmF0YXIgZW5kcG9pbnRzXG4gICAgY29uc3QgYXZhdGFyID0gdXNlcklkLmFkZFJlc291cmNlKCdhdmF0YXInKTtcbiAgICBhdmF0YXIuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVBdmF0YXJGdW5jdGlvbikpO1xuICAgIGF2YXRhci5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRlbGV0ZUF2YXRhckZ1bmN0aW9uKSk7XG4gICAgY29uc3QgdXBsb2FkVXJsID0gYXZhdGFyLmFkZFJlc291cmNlKCd1cGxvYWQtdXJsJyk7XG4gICAgdXBsb2FkVXJsLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldEF2YXRhclVwbG9hZFVybEZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBwb3N0SWQgPSBwb3N0cy5hZGRSZXNvdXJjZSgne3Bvc3RJZH0nKTtcbiAgICBjb25zdCBsaWtlUG9zdCA9IHBvc3RJZC5hZGRSZXNvdXJjZSgnbGlrZScpO1xuICAgIGxpa2VQb3N0LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxpa2VQb3N0RnVuY3Rpb24pKTtcblxuICAgIC8vIENvbW1lbnQgZW5kcG9pbnRzXG4gICAgY29uc3QgcG9zdENvbW1lbnRzID0gcG9zdElkLmFkZFJlc291cmNlKCdjb21tZW50cycpO1xuICAgIHBvc3RDb21tZW50cy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVDb21tZW50RnVuY3Rpb24pKTtcbiAgICBwb3N0Q29tbWVudHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRDb21tZW50c0Z1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBjb21tZW50cyA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2NvbW1lbnRzJyk7XG4gICAgY29uc3QgY29tbWVudElkID0gY29tbWVudHMuYWRkUmVzb3VyY2UoJ3tjb21tZW50SWR9Jyk7XG4gICAgY29tbWVudElkLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlQ29tbWVudEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBTMyBidWNrZXQgZm9yIGZyb250ZW5kIGhvc3RpbmdcbiAgICB0aGlzLndlYnNpdGVCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdXZWJzaXRlQnVja2V0Jywge1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCwgLy8gS2VlcCBhbGwgcHVibGljIGFjY2VzcyBibG9ja2VkXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBGb3IgZGV2ZWxvcG1lbnQgb25seVxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IE9yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIHdlYnNpdGUgYnVja2V0XG4gICAgY29uc3Qgb3JpZ2luQWNjZXNzSWRlbnRpdHkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnT3JpZ2luQWNjZXNzSWRlbnRpdHknLCB7XG4gICAgICBjb21tZW50OiAnQWxsb3cgQ2xvdWRGcm9udCB0byBhY2Nlc3MgdGhlIFMzIGJ1Y2tldCdcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHJlYWQgcGVybWlzc2lvbnMgdG8gQ2xvdWRGcm9udCBPQUlcbiAgICB0aGlzLndlYnNpdGVCdWNrZXQuZ3JhbnRSZWFkKG9yaWdpbkFjY2Vzc0lkZW50aXR5KTtcblxuICAgIC8vIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciB3ZWJzaXRlXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMud2Vic2l0ZUJ1Y2tldCwge1xuICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvcmlnaW5BY2Nlc3NJZGVudGl0eVxuICAgICAgICB9KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsIC8vIFNlcnZlIGluZGV4Lmh0bWwgYXMgdGhlIHJvb3RcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBSZXR1cm4gaW5kZXguaHRtbCBmb3IgNDAzIGVycm9ycyAod2hlbiBmaWxlIG5vdCBmb3VuZClcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDApXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBSZXR1cm4gaW5kZXguaHRtbCBmb3IgNDA0IGVycm9ycyAod2hlbiBmaWxlIG5vdCBmb3VuZClcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDApXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgYXZhdGFycyBidWNrZXRcbiAgICBjb25zdCBhdmF0YXJzT3JpZ2luQWNjZXNzSWRlbnRpdHkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnQXZhdGFyc09yaWdpbkFjY2Vzc0lkZW50aXR5Jywge1xuICAgICAgY29tbWVudDogJ0FsbG93IENsb3VkRnJvbnQgdG8gYWNjZXNzIHRoZSBhdmF0YXJzIFMzIGJ1Y2tldCdcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHJlYWQgcGVybWlzc2lvbnMgdG8gQ2xvdWRGcm9udCBPQUkgZm9yIGF2YXRhcnMgYnVja2V0XG4gICAgdGhpcy5hdmF0YXJzQnVja2V0LmdyYW50UmVhZChhdmF0YXJzT3JpZ2luQWNjZXNzSWRlbnRpdHkpO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZm9yIGF2YXRhciBkZWxpdmVyeVxuICAgIHRoaXMuYXZhdGFyc0Rpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnQXZhdGFyc0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuYXZhdGFyc0J1Y2tldCwge1xuICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBhdmF0YXJzT3JpZ2luQWNjZXNzSWRlbnRpdHlcbiAgICAgICAgfSksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kodGhpcywgJ0F2YXRhcnNDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6ICdBdmF0YXJzQ2FjaGVQb2xpY3knLFxuICAgICAgICAgIGNvbW1lbnQ6ICcyNC1ob3VyIGNhY2hlIGZvciBhdmF0YXIgaW1hZ2VzJyxcbiAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLFxuICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgZW5hYmxlQWNjZXB0RW5jb2RpbmdHemlwOiB0cnVlLFxuICAgICAgICAgIGVuYWJsZUFjY2VwdEVuY29kaW5nQnJvdGxpOiB0cnVlLFxuICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKVxuICAgICAgICB9KSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQUQsXG4gICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRFxuICAgICAgfSxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBSZXR1cm4gZGVmYXVsdCBhdmF0YXIgZm9yIDQwMyBlcnJvcnMgKHdoZW4gYXZhdGFyIG5vdCBmb3VuZClcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9kZWZhdWx0LWF2YXRhci5wbmcnLFxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gUmV0dXJuIGRlZmF1bHQgYXZhdGFyIGZvciA0MDQgZXJyb3JzICh3aGVuIGF2YXRhciBub3QgZm91bmQpXG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvZGVmYXVsdC1hdmF0YXIucG5nJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5ob3VycygyNClcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgYXV0aGVudGljYXRlZCB1c2VycyBhY2Nlc3MgdG8gdGhlaXIgb3duIHVzZXIgZGF0YVxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aGVudGljYXRlZFJvbGUpO1xuICAgIHRoaXMucG9zdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aGVudGljYXRlZFJvbGUpO1xuICAgIHRoaXMubGlrZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aGVudGljYXRlZFJvbGUpO1xuICAgIHRoaXMuY29tbWVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aGVudGljYXRlZFJvbGUpO1xuICAgIHRoaXMuZm9sbG93c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhdXRoZW50aWNhdGVkUm9sZSk7XG5cbiAgICAvLyBPdXRwdXQgdGhlIGNvbmZpZ3VyYXRpb24gdmFsdWVzIGZvciBmcm9udGVuZCAuZW52IGZpbGVcbiAgICAvLyBPcmRlciBtYXRjaGVzIHRoZSAuZW52IGZpbGU6IFZJVEVfQVBJX1VSTCwgVklURV9VU0VSX1BPT0xfSUQsIFZJVEVfVVNFUl9QT09MX0NMSUVOVF9JRCwgVklURV9JREVOVElUWV9QT09MX0lEXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZpdGVBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBlbmRwb2ludCBVUkwnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVml0ZVVzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWaXRlVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWaXRlSWRlbnRpdHlQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5pZGVudGl0eVBvb2wucmVmLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIElkZW50aXR5IFBvb2wgSUQnXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgQ2xvdWRGcm9udCBkb21haW4gZm9yIGF2YXRhcnNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXZhdGFyc0NkbkRvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF2YXRhcnNEaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkb21haW4gZm9yIGF2YXRhciBpbWFnZXMnXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgYXZhdGFyIGJ1Y2tldCBuYW1lIGZvciBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F2YXRhckJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdmF0YXJzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciBhdmF0YXIgc3RvcmFnZSdcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBDbG91ZEZyb250IGF2YXRhciBVUkwgZm9yIGZyb250ZW5kIGNvbmZpZ3VyYXRpb25cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVml0ZUNsb3VkZnJvbnRBdmF0YXJVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmF2YXRhcnNEaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IFVSTCBmb3IgYXZhdGFyIGRlbGl2ZXJ5J1xuICAgIH0pO1xuXG4gIH1cbn1cbiJdfQ==