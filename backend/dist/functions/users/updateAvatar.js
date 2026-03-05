const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { withAuth } = require('../../common/middleware');

// Initialize clients
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Lambda handler for updating a user's avatar URL
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
        body: JSON.stringify({ message: 'You can only update your own avatar' }),
      };
    }

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

    const { avatarUrl } = JSON.parse(event.body);

    // Validate avatarUrl is provided
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Invalid or missing avatarUrl' }),
      };
    }

    const usersTableName = process.env.USERS_TABLE;
    if (!usersTableName) {
      throw new Error('USERS_TABLE environment variable is not set');
    }

    // First, verify the user exists
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

    // Update the user's avatarUrl in DynamoDB (Requirements 1.6, 3.2)
    const timestamp = new Date().toISOString();

    const updateCommand = new UpdateCommand({
      TableName: usersTableName,
      Key: { id: userId },
      UpdateExpression: 'SET avatarUrl = :avatarUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':avatarUrl': avatarUrl,
        ':updatedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    });

    const result = await ddbDocClient.send(updateCommand);

    // Remove sensitive information if present
    const { password, ...user } = result.Attributes;

    // Return updated user profile (Requirement 10.2)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Avatar updated successfully',
        user
      }),
    };
  } catch (error) {
    console.error('Error updating avatar:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Error updating avatar',
        error: error.message || 'Unknown error',
      }),
    };
  }
};

// Export the handler wrapped with authentication middleware (Requirement 5.2)
exports.handler = withAuth(handler);
