const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { withAuth } = require('./middleware');

// Initialize S3 client
const s3Client = new S3Client();

/**
 * Lambda handler for generating presigned S3 upload URL for avatar
 * @param {Object} event - API Gateway event with user info added by auth middleware
 * @returns {Object} - API Gateway response with presigned URL
 */
const handler = async (event) => {
  try {
    // Get user ID from path parameter
    const userId = event.pathParameters?.userId;

    // Validate userId matches authenticated user (Requirement 5.2)
    if (userId !== event.user.id) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'You can only upload avatars for your own profile' }),
      };
    }

    // Get S3 bucket name from environment
    const avatarsBucket = process.env.AVATARS_BUCKET;
    if (!avatarsBucket) {
      throw new Error('AVATARS_BUCKET environment variable is not set');
    }

    // Parse request body to get file metadata
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Missing request body' }),
      };
    }

    const { contentType, fileExtension } = JSON.parse(event.body);

    // Validate content type (Requirement 1.1)
    const allowedContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!contentType || !allowedContentTypes.includes(contentType)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Invalid content type. Supported formats: JPEG, PNG, WebP'
        }),
      };
    }

    // Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!fileExtension || !allowedExtensions.includes(fileExtension.toLowerCase())) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Invalid file extension. Supported formats: jpg, jpeg, png, webp'
        }),
      };
    }

    // Generate S3 key for the avatar (Requirement 10.4)
    const s3Key = `${userId}/avatar.${fileExtension}`;

    // Create S3 PutObject command
    const command = new PutObjectCommand({
      Bucket: avatarsBucket,
      Key: s3Key,
      ContentType: contentType,
    });

    // Generate presigned URL with 15-minute expiration (Requirement 5.3)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900 // 15 minutes in seconds
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        key: s3Key,
        expiresIn: 900,
        contentType: contentType
      }),
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Error generating upload URL',
        error: error.message || 'Unknown error',
      }),
    };
  }
};

// Export the handler wrapped with authentication middleware (Requirement 5.1)
exports.handler = withAuth(handler);
