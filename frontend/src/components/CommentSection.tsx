import React, { useState } from 'react';
import { Comment } from '../types/comment';
import { commentsApi } from '../services/api';
import CommentItem from './CommentItem';

interface CommentSectionProps {
  postId: string;
  initialCommentsCount: number;
  isAuthenticated: boolean;
  currentUserId?: string;
}

/**
 * CommentSection component manages comment display and interaction for a post.
 *
 * Features:
 * - Lazy loading: fetches comments only when user expands the section
 * - Comment submission with validation and loading states
 * - Comment deletion with authorization check
 * - Displays comment count badge
 * - Expand/collapse toggle for comments
 * - Conditional comment input field (authenticated users only)
 * - Error handling and user feedback
 *
 * Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  initialCommentsCount,
  isAuthenticated,
  currentUserId,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount);

  /**
   * Fetch comments from API when user expands the section
   * Implements lazy loading to improve initial page load performance
   */
  const fetchComments = async () => {
    if (comments.length > 0) {
      // Already loaded, just toggle visibility
      setIsExpanded(!isExpanded);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { comments: fetchedComments } = await commentsApi.getComments(postId);
      setComments(fetchedComments);
      setIsExpanded(true);
    } catch (err) {
      setError('Failed to load comments');
      console.error('Error fetching comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle comment section visibility
   */
  const toggleComments = () => {
    if (!isExpanded && comments.length === 0) {
      // Need to fetch comments
      fetchComments();
    } else {
      // Just toggle visibility
      setIsExpanded(!isExpanded);
    }
  };

  /**
   * Validate comment text before submission
   */
  const validateCommentText = (text: string): string | null => {
    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return 'Comment cannot be empty';
    }

    if (trimmedText.length > 500) {
      return 'Comment is too long (max 500 characters)';
    }

    return null;
  };

  /**
   * Submit new comment
   * Validates input, calls API, updates UI on success
   */
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setError('You must be logged in to comment');
      return;
    }

    // Validate comment text
    const validationError = validateCommentText(commentText);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const { comment: newComment } = await commentsApi.createComment(
        postId,
        commentText.trim(),
        token
      );

      // Add new comment to the list
      setComments([...comments, newComment]);

      // Clear input field
      setCommentText('');

      // Update comment count
      setCommentsCount(commentsCount + 1);

      // Ensure comments are visible after posting
      if (!isExpanded) {
        setIsExpanded(true);
      }
    } catch (err) {
      setError('Failed to post comment');
      console.error('Error creating comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Delete a comment
   * Calls API and removes comment from UI on success
   */
  const handleDeleteComment = async (commentId: string) => {
    if (!isAuthenticated) {
      setError('You must be logged in to delete comments');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      await commentsApi.deleteComment(commentId, token);

      // Remove comment from UI
      setComments(comments.filter(comment => comment.id !== commentId));

      // Update comment count
      setCommentsCount(Math.max(0, commentsCount - 1));
    } catch (err) {
      setError('Failed to delete comment');
      console.error('Error deleting comment:', err);
    }
  };

  /**
   * Handle input change and clear errors
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    if (error) {
      setError(null);
    }
  };

  return (
    <div className="comment-section">
      {/* Comment count badge and toggle */}
      <div className="comment-header">
        <button
          onClick={toggleComments}
          className="comment-toggle"
          disabled={isLoading}
        >
          <span className="comment-count-badge">
            {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
          </span>
          <span className="comment-toggle-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
      </div>

      {/* Expanded comments section */}
      {isExpanded && (
        <div className="comments-container">
          {/* Loading state */}
          {isLoading && (
            <div className="comments-loading">Loading comments...</div>
          )}

          {/* Error message */}
          {error && (
            <div className="comments-error">{error}</div>
          )}

          {/* Comments list */}
          {!isLoading && comments.length > 0 && (
            <div className="comments-list">
              {comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  canDelete={isAuthenticated && currentUserId === comment.userId}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          )}

          {/* No comments message */}
          {!isLoading && comments.length === 0 && !error && (
            <div className="no-comments">No comments yet. Be the first to comment!</div>
          )}

          {/* Comment input field (authenticated users only) */}
          {isAuthenticated && (
            <form onSubmit={handleSubmitComment} className="comment-form">
              <textarea
                value={commentText}
                onChange={handleInputChange}
                placeholder="Write a comment..."
                className="comment-input"
                disabled={isSubmitting}
                rows={3}
              />
              <div className="comment-form-footer">
                <span className="comment-char-count">
                  {commentText.length}/500
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || commentText.trim().length === 0}
                  className="comment-submit-button"
                >
                  {isSubmitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
