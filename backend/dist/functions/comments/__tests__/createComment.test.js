// Smoke test for createComment Lambda function
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
  PutCommand: jest.fn((params) => params),
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
const { handler } = require('../createComment');

describe('createComment Lambda - Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  test('should create comment with valid input', async () => {
    const event = {
      pathParameters: { postId: 'post-123' },
      body: JSON.stringify({ text: 'This is a test comment' }),
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(2); // PutCommand and UpdateCommand

    const body = JSON.parse(response.body);
    expect(body.message).toBe('Comment created successfully');
    expect(body.comment).toMatchObject({
      postId: 'post-123',
      userId: 'user-123',
      username: 'testuser',
      text: 'This is a test comment',
    });
    expect(body.comment.id).toBeDefined();
    expect(body.comment.createdAt).toBeDefined();
  });

  test('should reject empty comment text', async () => {
    const event = {
      pathParameters: { postId: 'post-123' },
      body: JSON.stringify({ text: '' }),
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();

    const body = JSON.parse(response.body);
    expect(body.message).toBe('Comment text cannot be empty');
  });

  test('should reject comment text exceeding 500 characters', async () => {
    const longText = 'a'.repeat(501);
    const event = {
      pathParameters: { postId: 'post-123' },
      body: JSON.stringify({ text: longText }),
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();

    const body = JSON.parse(response.body);
    expect(body.message).toContain('cannot exceed 500 characters');
  });
});
