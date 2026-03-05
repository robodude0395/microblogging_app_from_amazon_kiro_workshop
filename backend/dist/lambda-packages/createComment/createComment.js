// createComment Lambda function
// Purpose: Create a new comment on a post
// Authentication: Required (withAuth middleware)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { withAuth } = require('./middleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const COMMENTS_TABLE = process.env.COMMENTS_TABLE;
const POSTS_TABLE = process.env.POSTS_TABLE;

const handler = async (event) => {
  try {
    // Validate request body exists
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

    // Parse request body
    const { text } = JSON.parse(event.body);

    // Validate comment text is not empty or whitespace-only
    if (!text || text.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Comment text cannot be empty' }),
      };
    }

    // Validate comment text length (max 500 characters)
    const MAX_TEXT_LENGTH = 500;
    if (text.length > MAX_TEXT_LENGTH) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: `Comment text cannot exceed ${MAX_TEXT_LENGTH} characters` }),
      };
    }

    // Get postId from path parameters
    const postId = event.pathParameters?.postId;
    if (!postId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Missing postId parameter' }),
      };
    }

    // Validate environment variables
    if (!COMMENTS_TABLE) {
      throw new Error('COMMENTS_TABLE environment variable is not set');
    }
    if (!POSTS_TABLE) {
      throw new Error('POSTS_TABLE environment variable is not set');
    }

    // Generate unique comment ID
    const commentId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create comment object with all required fields
    const comment = {
      id: commentId,
      postId: postId,
      userId: event.user.id,
      username: event.user.username,
      text: text,
      createdAt: timestamp,
    };

    // Store comment in CommentsTable
    const putCommand = new PutCommand({
      TableName: COMMENTS_TABLE,
      Item: comment,
    });

    await docClient.send(putCommand);

    // Increment commentsCount in PostsTable
    const updateCommand = new UpdateCommand({
      TableName: POSTS_TABLE,
      Key: { id: postId },
      UpdateExpression: 'SET commentsCount = if_not_exists(commentsCount, :zero) + :inc',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':zero': 0,
      },
    });

    await docClient.send(updateCommand);

    // Return 201 response with complete comment object
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Comment created successfully',
        comment: comment,
      }),
    };
  } catch (error) {
    console.error('Error creating comment:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Error creating comment',
        error: error.message || 'Unknown error',
      }),
    };
  }
};

module.exports.handler = withAuth(handler);
