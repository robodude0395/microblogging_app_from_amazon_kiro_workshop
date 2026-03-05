// Smoke test for getComments Lambda function
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
  QueryCommand: jest.fn((params) => params),
}));

// Set environment variables before requiring handler
process.env.COMMENTS_TABLE = 'test-comments-table';

// Now require the handler
const { handler } = require('../getComments');

describe('getComments Lambda - Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should retrieve comments with proper structure', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        postId: 'post-123',
        userId: 'user-1',
        username: 'user1',
        text: 'First comment',
        createdAt: '2024-01-01T10:00:00.000Z',
      },
      {
        id: 'comment-2',
        postId: 'post-123',
        userId: 'user-2',
        username: 'user2',
        text: 'Second comment',
        createdAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    mockSend.mockResolvedValue({ Items: mockComments });

    const event = {
      pathParameters: { postId: 'post-123' },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const body = JSON.parse(response.body);
    expect(body.comments).toEqual(mockComments);
    expect(body.comments).toHaveLength(2);
  });

  test('should return empty array when no comments exist', async () => {
    mockSend.mockResolvedValue({ Items: [] });

    const event = {
      pathParameters: { postId: 'post-123' },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.comments).toEqual([]);
  });

  test('should return 400 when postId is missing', async () => {
    const event = {
      pathParameters: {},
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();

    const body = JSON.parse(response.body);
    expect(body.message).toBe('Missing postId parameter');
  });
});
