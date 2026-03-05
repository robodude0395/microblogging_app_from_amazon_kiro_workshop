const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { withAuth } = require('../../common/middleware');

// Initialize clients
const s3Client = new S3Client();
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Lambda handler for deleting a user's avatar
 * @param {Object} event - API Gateway event with user info added by auth middleware
 * @returns {Object} - API Gateway response
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
        body: JSON.stringify({ message: 'You can only delete your own avatar' }),
      };
    }

    const usersTableName = process.env.USERS_TABLE;
    const avatarsBucket = process.env.AVATARS_BUCKET;

    if (!usersTableName) {
      throw new Error('USERS_TABLE environment variable is not set');
    }

    if (!avatarsBucket) {
      throw new Error('AVATARS_BUCKET environment variable is not set');
    }

    // First, get the current user data to check if avatar exists
    const getCommand = new GetCommand({
      TableName: usersTableName,
      Key: { id: userId }
    });

    const currentUserResult = await ddbDocClient.send(getCommand);

    if (!currentUserResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    const currentUser = currentUserResult.Item;

    // If user has an avatar, delete it from S3 (Requirement 4.1)
    if (currentUser.avatarUrl) {
      // Extract the S3 key from the avatar URL or construct it
      // Avatar files are stored with pattern: {userId}/avatar.{ext}
      // We need to delete all possible avatar files for this user
      const extensions = ['jpg', 'jpeg', 'png', 'webp'];

      // Try to delete all possible avatar file extensions
      const deletePromises = extensions.map(async (ext) => {
        const s3Key = `${userId}/avatar.${ext}`;
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: avatarsBucket,
            Key: s3Key,
          });
          await s3Client.send(deleteCommand);
          console.log(`Deleted avatar file: ${s3Key}`);
        } catch (error) {
          // Ignore errors for files that don't exist
          console.log(`Could not delete ${s3Key}:`, error.message);
        }
      });

      await Promise.all(deletePromises);
    }

    // Remove avatarUrl from DynamoDB (Requirement 4.2)
    const timestamp = new Date().toISOString();

    const updateCommand = new UpdateCommand({
      TableName: usersTableName,
      Key: { id: userId },
      UpdateExpression: 'REMOVE avatarUrl SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    });

    const result = await ddbDocClient.send(updateCommand);

    // Remove sensitive information if present
    const { password, ...user } = result.Attributes;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Avatar deleted successfully',
        user
      }),
    };
  } catch (error) {
    console.error('Error deleting avatar:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Error deleting avatar',
        error: error.message || 'Unknown error',
      }),
    };
  }
};

// Export the handler wrapped with authentication middleware (Requirement 5.1)
exports.handler = withAuth(handler);
