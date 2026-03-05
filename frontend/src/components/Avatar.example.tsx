/**
 * Avatar Component Usage Examples
 *
 * This file demonstrates various ways to use the Avatar component.
 * These examples can be integrated into pages like Profile, Feed, etc.
 */

import Avatar from './Avatar';

// Example 1: Basic usage with avatar URL
export const BasicAvatar = () => (
  <Avatar
    userId="user123"
    avatarUrl="https://example.cloudfront.net/avatars/user123.jpg"
  />
);

// Example 2: Default avatar (no URL provided)
export const DefaultAvatar = () => (
  <Avatar userId="user456" />
);

// Example 3: Custom size
export const LargeAvatar = () => (
  <Avatar
    userId="user789"
    avatarUrl="https://example.cloudfront.net/avatars/user789.jpg"
    size={64}
  />
);

// Example 4: Small avatar for feed posts
export const SmallAvatar = () => (
  <Avatar
    userId="user101"
    avatarUrl="https://example.cloudfront.net/avatars/user101.jpg"
    size={32}
  />
);

// Example 5: Custom alt text for accessibility
export const AccessibleAvatar = () => (
  <Avatar
    userId="user202"
    avatarUrl="https://example.cloudfront.net/avatars/user202.jpg"
    alt="John Doe's profile picture"
  />
);

// Example 6: With custom className for additional styling
export const StyledAvatar = () => (
  <Avatar
    userId="user303"
    avatarUrl="https://example.cloudfront.net/avatars/user303.jpg"
    className="profile-avatar"
  />
);

// Example 7: In a user card layout
export const UserCard = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <Avatar
      userId="user404"
      avatarUrl="https://example.cloudfront.net/avatars/user404.jpg"
      size={48}
    />
    <div>
      <div style={{ fontWeight: 'bold' }}>John Doe</div>
      <div style={{ color: '#657786' }}>@johndoe</div>
    </div>
  </div>
);

// Example 8: In a post feed item
export const FeedPostAvatar = () => (
  <div style={{ display: 'flex', gap: '12px', padding: '16px' }}>
    <Avatar
      userId="user505"
      avatarUrl="https://example.cloudfront.net/avatars/user505.jpg"
      size={40}
    />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 'bold' }}>Jane Smith</div>
      <div>This is a sample post content...</div>
    </div>
  </div>
);
