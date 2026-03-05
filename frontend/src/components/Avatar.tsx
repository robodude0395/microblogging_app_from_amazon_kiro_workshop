import React, { useState, useRef, useEffect } from 'react';

/**
 * Props for the Avatar component
 */
interface AvatarProps {
  /** User ID for the avatar */
  userId: string;
  /** URL of the user's avatar image, or undefined for default avatar */
  avatarUrl?: string;
  /** Size of the avatar in pixels (default: 40) */
  size?: number;
  /** Alt text for the avatar image (default: "User avatar") */
  alt?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Avatar component that displays user profile images with fallback handling.
 *
 * Features:
 * - Displays user avatar image or default avatar
 * - Handles image loading errors gracefully
 * - Implements lazy loading for performance
 * - Consistent sizing and styling
 * - Accessible with proper alt text
 *
 * Usage:
 * ```tsx
 * <Avatar userId="123" avatarUrl="https://..." size={48} />
 * <Avatar userId="456" /> // Uses default avatar
 * ```
 */
const Avatar: React.FC<AvatarProps> = ({
  userId: _userId,
  avatarUrl,
  size = 40,
  alt = 'User avatar',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Default avatar URL - served from CloudFront
  const DEFAULT_AVATAR_URL = '/default-avatar.svg';

  // Determine which image to display
  const displayUrl = (!avatarUrl || imageError) ? DEFAULT_AVATAR_URL : avatarUrl;

  // Reset error state when avatarUrl changes
  useEffect(() => {
    setImageError(false);
    setIsLoaded(false);
  }, [avatarUrl]);

  /**
   * Handle image loading errors by falling back to default avatar
   */
  const handleError = () => {
    if (!imageError) {
      setImageError(true);
    }
  };

  /**
   * Handle successful image load
   */
  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      className={`avatar-container ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
      }}
    >
      <img
        ref={imgRef}
        src={displayUrl}
        alt={alt}
        loading="lazy"
        onError={handleError}
        onLoad={handleLoad}
        className={`avatar-image ${isLoaded ? 'loaded' : 'loading'}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '50%',
          backgroundColor: '#e1e8ed',
          opacity: isLoaded ? 1 : 0.7,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
    </div>
  );
};

export default Avatar;
