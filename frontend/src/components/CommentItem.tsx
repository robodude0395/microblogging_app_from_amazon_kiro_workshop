import React from 'react';
import { Link } from 'react-router-dom';
import { Comment } from '../types/comment';

interface CommentItemProps {
  comment: Comment;
  canDelete: boolean;
  onDelete: (commentId: string) => Promise<void>;
}

/**
 * CommentItem component displays a single comment with author info and optional delete button.
 *
 * Features:
 * - Displays username as clickable link to profile
 * - Shows comment text
 * - Displays relative timestamp (e.g., "2 hours ago")
 * - Conditionally renders delete button for comment author
 *
 * Requirements: 4.3, 4.5
 */
const CommentItem: React.FC<CommentItemProps> = ({ comment, canDelete, onDelete }) => {
  const [isDeleting, setIsDeleting] = React.useState(false);

  /**
   * Format timestamp as relative time (e.g., "2 hours ago")
   */
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  /**
   * Handle delete button click
   */
  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="comment-item">
      <div className="comment-header">
        <Link to={`/profile/${comment.userId}`} className="comment-username">
          {comment.username}
        </Link>
        <span className="comment-timestamp">{formatRelativeTime(comment.createdAt)}</span>
      </div>
      <div className="comment-text">{comment.text}</div>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="comment-delete-button"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
    </div>
  );
};

export default CommentItem;
