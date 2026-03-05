import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import Avatar from './Avatar';
import { resizeImage } from '../utils/imageResize';
import { usersApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Props for the AvatarUpload component
 */
interface AvatarUploadProps {
  /** User ID for the avatar being uploaded */
  userId: string;
  /** Current avatar URL, if any */
  avatarUrl?: string;
  /** Callback when upload succeeds with new avatar URL */
  onUploadSuccess?: (avatarUrl: string) => void;
  /** Callback when upload fails */
  onUploadError?: (error: string) => void;
}

/**
 * Validation constants
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * AvatarUpload component for uploading and managing user avatars.
 *
 * Features:
 * - File input with drag-and-drop support
 * - File type validation (JPEG, PNG, WebP)
 * - File size validation (max 5MB)
 * - Upload progress indicator
 * - Error message display
 * - Success confirmation
 * - Preview of current avatar
 * - Delete avatar with confirmation dialog
 *
 * Validates Requirements:
 * - 1.3: Display error for invalid file types
 * - 1.4: Display error for files exceeding size limit
 * - 1.7: Display success confirmation after upload
 * - 4.1: Remove avatar image from S3 storage
 * - 4.2: Update DynamoDB user record to remove avatar URL
 * - 4.3: Display default avatar after deletion
 * - 4.4: Display confirmation message after deletion
 *
 * Usage:
 * ```tsx
 * <AvatarUpload
 *   userId="123"
 *   avatarUrl="https://..."
 *   onUploadSuccess={(url) => console.log('Uploaded:', url)}
 * />
 * ```
 */
const AvatarUpload: React.FC<AvatarUploadProps> = ({
  userId,
  avatarUrl,
  onUploadSuccess,
  onUploadError,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();

  /**
   * Validate file type and size
   * Implements Requirements 1.1, 1.2, 1.3, 1.4
   */
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Please upload a JPEG, PNG, or WebP image.`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds the maximum limit of 5MB. Please choose a smaller file.`;
    }

    return null;
  };

  /**
   * Handle file selection from input or drop
   */
  const handleFileSelect = (file: File) => {
    // Clear previous states
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setPreviewUrl(null);
      if (onUploadError) {
        onUploadError(validationError);
      }
      return;
    }

    // File is valid - create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Trigger file input click
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handle upload button click
   * Implements Requirements: 1.1, 1.2, 1.5, 1.6, 6.1, 6.2, 6.3, 6.4
   */
  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setIsUploading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    try {
      // Step 1: Validate and resize image client-side (10% progress)
      setUploadProgress(10);
      const resizeResult = await resizeImage(selectedFile);

      if (!resizeResult.success || !resizeResult.file) {
        throw new Error(resizeResult.error || 'Failed to process image');
      }

      const processedFile = resizeResult.file;

      // Step 2: Request presigned URL from backend (30% progress)
      setUploadProgress(30);
      const { uploadUrl, key } = await usersApi.getAvatarUploadUrl(userId, processedFile, token);

      // Construct the avatar URL from CloudFront CDN
      const cdnUrl = import.meta.env.VITE_CLOUDFRONT_AVATAR_URL;
      const avatarUrl = `${cdnUrl}/${key}`;

      // Step 3: Upload directly to S3 using presigned URL (60% progress)
      setUploadProgress(60);
      await usersApi.uploadAvatarToS3(uploadUrl, processedFile);

      // Step 4: Notify backend to update user record (80% progress)
      setUploadProgress(80);
      await usersApi.updateAvatar(userId, avatarUrl, token);

      // Step 5: Complete (100% progress)
      setUploadProgress(100);
      setSuccess(true);
      setSuccessMessage('Avatar uploaded successfully!');
      setIsUploading(false);
      setSelectedFile(null);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(avatarUrl);
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);

      if (onUploadError) {
        onUploadError(errorMessage);
      }
    }
  };

  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setUploadProgress(0);

    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle delete avatar button click
   * Shows confirmation dialog
   * Implements Requirements: 4.1, 4.2, 4.3, 4.4
   */
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
  };

  /**
   * Handle delete confirmation
   * Calls deleteAvatar API and updates UI
   * Implements Requirements: 4.1, 4.2, 4.3, 4.4
   */
  const handleDeleteConfirm = async () => {
    if (!token) return;

    setIsDeleting(true);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setShowDeleteConfirm(false);

    try {
      // Call delete avatar API
      await usersApi.deleteAvatar(userId, token);

      // Show success message
      setSuccess(true);
      setSuccessMessage('Avatar deleted successfully!');

      // Call success callback with empty string to indicate avatar removed
      if (onUploadSuccess) {
        onUploadSuccess('');
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete avatar. Please try again.';
      setError(errorMessage);

      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle delete cancellation
   */
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="avatar-upload-container" style={{ maxWidth: '500px' }}>
      {/* Current Avatar Preview */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--primary-color)',
              }}
            />
          ) : (
            <Avatar userId={userId} avatarUrl={avatarUrl} size={120} />
          )}
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {previewUrl ? 'Preview' : 'Current Avatar'}
        </p>
      </div>

      {/* Drag and Drop Area */}
      <div
        className={`avatar-upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: isDragging ? '#f3f0ff' : 'var(--background-color)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        <div style={{ marginBottom: '1rem' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-muted)', margin: '0 auto' }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
          {selectedFile ? selectedFile.name : 'Drag and drop your avatar here'}
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          or
        </p>
        <button
          type="button"
          className="browse-button"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--primary-color)',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleBrowseClick();
          }}
          disabled={isUploading}
        >
          Browse files
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          Supported formats: JPEG, PNG, WebP (max 5MB)
        </p>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Uploading...
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {uploadProgress}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-color)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: 'var(--primary-color)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Error Message - Requirement 1.3, 1.4 */}
      {error && (
        <div
          className="avatar-upload-error"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid var(--error-color)',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ color: 'var(--error-color)', fontSize: '0.875rem', margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Success Message - Requirement 1.7, 4.4 */}
      {success && (
        <div
          className="avatar-upload-success"
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid var(--success-color)',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ color: 'var(--success-color)', fontSize: '0.875rem', margin: 0 }}>
            ✓ {successMessage}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {selectedFile && !isUploading && !success && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            style={{
              flex: 1,
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-color)';
            }}
          >
            Upload Avatar
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUploading}
            style={{
              flex: 1,
              backgroundColor: 'white',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '9999px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f8fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Delete Avatar Button - Requirement 4.1, 4.2, 4.3, 4.4 */}
      {avatarUrl && !selectedFile && !isUploading && !isDeleting && (
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={handleDeleteClick}
            style={{
              width: '100%',
              backgroundColor: 'white',
              color: 'var(--error-color)',
              border: '1px solid var(--error-color)',
              borderRadius: '9999px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            Delete Avatar
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog - Requirement 4.1, 4.2, 4.3, 4.4 */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleDeleteCancel}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
              Delete Avatar
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Are you sure you want to delete your avatar? This action cannot be undone. Your profile will display the default avatar.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--error-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = 'var(--error-color)';
                  }
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  backgroundColor: 'white',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '9999px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = '#f5f8fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
