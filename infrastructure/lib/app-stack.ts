import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

declare const require: any;
declare const __dirname: string;
const path = require('path');


export class AppStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly usersTable: dynamodb.Table;
  public readonly postsTable: dynamodb.Table;
  public readonly likesTable: dynamodb.Table;
  public readonly commentsTable: dynamodb.Table;
  public readonly followsTable: dynamodb.Table;
  public readonly api: apigateway.RestApi;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly avatarsBucket: s3.Bucket;
  public readonly avatarsDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Helper function to get Lambda package path
    const getLambdaPackagePath = (functionName: string) => {
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
        adminUserPassword: true  // Enable ADMIN_USER_PASSWORD_AUTH flow
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
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated'
          }
        },
        'sts:AssumeRoleWithWebIdentity'
      )
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
    this.usersTable.grantReadData(getPostsFunction);  // Add read permission for Users table
    this.usersTable.grantReadData(createPostFunction);  // Add read permission for Users table
    this.usersTable.grantReadData(likePostFunction);  // Add read permission for Users table
    this.usersTable.grantReadData(checkFollowingFunction);  // Add read permission for Users table
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

    // Output website bucket name for deployment scripts
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 bucket name for website hosting'
    });

    // Output CloudFront distribution ID for cache invalidation
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID for website'
    });

  }
}
