/**
 * Image validation utilities for avatar uploads
 * Validates file type and size according to system requirements
 */

// Supported image formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if the file type is supported (JPEG, PNG, or WebP)
 * Requirements: 1.1, 1.3
 */
export function validateFileType(file: File): ValidationResult {
  // Check MIME type
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file format. Please upload a JPEG, PNG, or WebP image.',
    };
  }

  // Additional check: validate file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));

  if (!hasValidExtension) {
    return {
      isValid: false,
      error: 'Invalid file format. Please upload a JPEG, PNG, or WebP image.',
    };
  }

  return { isValid: true };
}

/**
 * Validates if the file size is within the allowed limit (5MB)
 * Requirements: 1.2, 1.4
 */
export function validateFileSize(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File size (${sizeMB}MB) exceeds the maximum allowed size of 5MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Performs complete validation on an image file
 * Checks both file type and size
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export function validateImageFile(file: File): ValidationResult {
  // Validate file type first
  const typeValidation = validateFileType(file);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // Validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }

  return { isValid: true };
}
