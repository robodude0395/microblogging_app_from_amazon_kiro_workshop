/**
 * Image resizing utilities for avatar uploads
 * Processes images to 400x400 pixels with aspect ratio maintenance and compression
 */

// Target dimensions for avatar images
const TARGET_SIZE = 400;

// JPEG quality for compression (0.0 to 1.0)
// 0.85 provides good balance between quality and file size
const JPEG_QUALITY = 0.85;

export interface ResizeResult {
  success: boolean;
  file?: File;
  error?: string;
}

/**
 * Resizes an image to 400x400 pixels, maintaining aspect ratio and cropping to square
 * Uses HTML5 Canvas API for client-side processing
 * Requirements: 6.1, 6.2, 6.3
 *
 * @param file - The image file to resize
 * @returns Promise resolving to ResizeResult with processed file or error
 */
export async function resizeImage(file: File): Promise<ResizeResult> {
  try {
    // Load the image
    const image = await loadImage(file);

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return {
        success: false,
        error: 'Failed to create canvas context for image processing.',
      };
    }

    // Set canvas to target dimensions
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;

    // Calculate crop dimensions to maintain aspect ratio
    const cropDimensions = calculateCropDimensions(image.width, image.height);

    // Draw the image on canvas with cropping
    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.drawImage(
      image,
      cropDimensions.sx,
      cropDimensions.sy,
      cropDimensions.sWidth,
      cropDimensions.sHeight,
      0,
      0,
      TARGET_SIZE,
      TARGET_SIZE
    );

    // Convert canvas to blob with compression
    const blob = await canvasToBlob(canvas, file.type);

    if (!blob) {
      return {
        success: false,
        error: 'Failed to compress image.',
      };
    }

    // Create new File object from blob
    const processedFile = new File([blob], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });

    return {
      success: true,
      file: processedFile,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process image.',
    };
  }
}

/**
 * Loads an image file and returns an HTMLImageElement
 *
 * @param file - The image file to load
 * @returns Promise resolving to HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file.'));
    };

    img.src = url;
  });
}

/**
 * Calculates crop dimensions to maintain aspect ratio and create a square crop
 * Uses center cropping strategy
 *
 * @param width - Original image width
 * @param height - Original image height
 * @returns Crop dimensions for canvas drawImage
 */
function calculateCropDimensions(width: number, height: number) {
  // Determine the size of the square crop (use the smaller dimension)
  const cropSize = Math.min(width, height);

  // Calculate starting positions to center the crop
  const sx = (width - cropSize) / 2;
  const sy = (height - cropSize) / 2;

  return {
    sx,
    sy,
    sWidth: cropSize,
    sHeight: cropSize,
  };
}

/**
 * Converts canvas to Blob with compression
 *
 * @param canvas - The canvas element to convert
 * @param mimeType - The desired output MIME type
 * @returns Promise resolving to Blob
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    // Use JPEG quality for JPEG images, default quality for others
    const quality = mimeType === 'image/jpeg' ? JPEG_QUALITY : undefined;

    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

/**
 * Checks if an image needs resizing (larger than 400x400)
 *
 * @param file - The image file to check
 * @returns Promise resolving to boolean indicating if resize is needed
 */
export async function needsResize(file: File): Promise<boolean> {
  try {
    const image = await loadImage(file);
    return image.width > TARGET_SIZE || image.height > TARGET_SIZE;
  } catch {
    // If we can't load the image, assume it needs processing
    return true;
  }
}
