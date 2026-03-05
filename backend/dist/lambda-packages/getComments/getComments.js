// getComments Lambda function
// Purpose: Retrieve all comments for a specific post
// Authentication: Not required (public read)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const COMMENTS_TABLE = process.env.COMMENTS_TABLE;

const handler = async (event) => {
  try {
    // Validate environment variable
    if (!COMMENTS_TABLE) {
      throw new Error('COMMENTS_TABLE environment variable is not set');
    }

    // Extract postId from path parameters
    const postId = event.pathParameters?.postId;
    if (!postId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Missing postId parameter',
        }),
      };
    }

    // Query CommentsTable using postId-index GSI
    const queryCommand = new QueryCommand({
      TableName: COMMENTS_TABLE,
      IndexName: 'postId-index',
      KeyConditionExpression: 'postId = :postId',
      ExpressionAttributeValues: {
        ':postId': postId,
      },
      ScanIndexForward: true, // Sort by createdAt ascending (oldest first)
    });

    const result = await docClient.send(queryCommand);
    const comments = result.Items || [];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        comments,
      }),
    };
  } catch (error) {
    console.error('Error getting comments:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Error getting comments',
        error: error.message || 'Unknown error',
      }),
    };
  }
};

module.exports.handler = handler;
