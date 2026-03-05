// Smoke test for deleteComment Lambda function
// Validates basic functionality with mocked DynamoDB

// Set up mocks before requiring the handler
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
  GetCommand: jest.fn((params) => params),
  DeleteCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
}));

// Mock middleware
jest.mock('../../../common/middleware', () => ({
  withAuth: (handler) => handler,
}));

// Set environment variables before requiring handler
process.env.COMMENTS_TABLE = 'test-comments-table';
process.env.POSTS_TABLE = 'test-posts-table';

// Now require the handler
const { handler } = require('../deleteComment');

describe('deleteComment Lambda - Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should delete comment when user is the author', async () => {
    const mockComment = {
      id: 'comment-123',
      postId: 'post-123',
      userId: 'user-123',
      username: 'testuser',
      text: 'Test comment',
      createdAt: '2024-01-01T10:00:00.000Z',
    };

    // Mock GetCommand to return the comment
    mockSend.mockResolvedValueOnce({ Item: mockComment });
    // Mock DeleteCommand
    mockSend.mockResolvedValueOnce({});
    // Mock UpdateCommand
    mockSend.mockResolvedValueOnce({});

    const event = {
      pathParameters: { commentId: 'comment-123' },
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(3); // GetCommand, DeleteCommand, UpdateCommand

    const body = JSON.parse(response.body);
    expect(body.message).toBe('Comment deleted successfully');
  });

  test('should return 403 when user is not the author', async () => {
    const mockComment = {
      id: 'comment-123',
      postId: 'post-123',
      userId: 'user-456', // Different user
      username: 'otheruser',
      text: 'Test comment',
      createdAt: '2024-01-01T10:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({ Item: mockComment });

    const event = {
      pathParameters: { commentId: 'comment-123' },
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    expect(mockSend).toHaveBeenCalledTimes(1); // Only GetCommand

    const body = JSON.parse(response.body);
    expect(body.message).toBe('You are not authorized to delete this comment');
  });

  test('should return 404 when comment does not exist', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = {
      pathParameters: { commentId: 'comment-123' },
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    expect(mockSend).toHaveBeenCalledTimes(1); // Only GetCommand

    const body = JSON.parse(response.body);
    expect(body.message).toBe('Comment not found');
  });
});
