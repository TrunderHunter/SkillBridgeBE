import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converts a UUID string to a MongoDB ObjectId
 * @param uuid - The UUID string to convert
 * @returns MongoDB ObjectId
 * @throws Error if the UUID is invalid
 */
export const uuidToObjectId = (uuid: string): Types.ObjectId => {
  if (!uuid || typeof uuid !== 'string') {
    throw new Error('Invalid UUID: must be a non-empty string');
  }

  // Validate UUID format (basic check)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new Error('Invalid UUID format');
  }

  try {
    // Convert UUID to ObjectId by using the hex part without dashes
    const hexString = uuid.replace(/-/g, '');
    return new Types.ObjectId(hexString.substring(0, 24));
  } catch (error) {
    throw new Error(
      `Failed to convert UUID to ObjectId: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Converts a MongoDB ObjectId to a UUID string
 * @param objectId - The MongoDB ObjectId to convert
 * @returns UUID string
 */
export const objectIdToUuid = (objectId: Types.ObjectId): string => {
  if (!objectId || !Types.ObjectId.isValid(objectId)) {
    throw new Error('Invalid ObjectId');
  }

  const hexString = objectId.toString();
  // Pad with zeros if needed and format as UUID
  const paddedHex = hexString.padEnd(32, '0');

  return [
    paddedHex.substring(0, 8),
    paddedHex.substring(8, 12),
    paddedHex.substring(12, 16),
    paddedHex.substring(16, 20),
    paddedHex.substring(20, 32),
  ].join('-');
};

/**
 * Generates a new UUID
 * @returns A new UUID string
 */
export const generateUuid = (): string => {
  return uuidv4();
};

/**
 * Validates if a string is a valid UUID
 * @param uuid - The string to validate
 * @returns true if valid UUID, false otherwise
 */
export const isValidUuid = (uuid: string): boolean => {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Alias for backward compatibility
export const toObjectId = uuidToObjectId;
