// deleteComment Lambda function
// Purpose: Delete a comment (author only)
// Authentication: Required (withAuth middleware)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { withAuth } = require('./middleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const COMMENTS_TABLE = process.env.COMMENTS_TABLE;
const POSTS_TABLE = process.env.POSTS_TABLE;

const handler = async (event) => {
  try {
    // Validate environment variables
    if (!COMMENTS_TABLE) {
      throw new Error('COMMENTS_TABLE environment variable is not set');
    }
    if (!POSTS_TABLE) {
      throw new Error('POSTS_TABLE environment variable is not set');
    }

    // Extract commentId from path parameters
    const commentId = event.pathParameters?.commentId;
    if (!commentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Missing commentId parameter',
        }),
      };
    }

    // Retrieve comment from CommentsTable to verify ownership
    const getCommand = new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { id: commentId },
    });

    const result = await docClient.send(getCommand);

    // Check if comment exists
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Comment not found',
        }),
      };
    }

    const comment = result.Item;

    // Verify authenticated user is the comment author
    if (comment.userId !== event.user.id) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'You are not authorized to delete this comment',
        }),
      };
    }

    // Delete comment from CommentsTable
    const deleteCommand = new DeleteCommand({
      TableName: COMMENTS_TABLE,
      Key: { id: commentId },
    });

    await docClient.send(deleteCommand);

    // Decrement commentsCount in PostsTable
    const updateCommand = new UpdateCommand({
      TableName: POSTS_TABLE,
      Key: { id: comment.postId },
      UpdateExpression: 'SET commentsCount = if_not_exists(commentsCount, :zero) - :dec',
      ExpressionAttributeValues: {
        ':dec': 1,
        ':zero': 0,
      },
    });

    await docClient.send(updateCommand);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Comment deleted successfully',
      }),
    };
  } catch (error) {
    console.error('Error deleting comment:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Error deleting comment',
        error: error.message || 'Unknown error',
      }),
    };
  }
};

module.exports.handler = withAuth(handler);
