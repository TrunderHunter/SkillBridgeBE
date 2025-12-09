/**
 * Vietnamese text search utilities
 * Supports accent-insensitive search (tìm kiếm không dấu)
 */

// Vietnamese character mapping for accent removal
const vietnameseCharMap: { [key: string]: string } = {
  'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
  'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
  'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
  'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
  'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
  'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
  'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
  'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
  'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
  'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
  'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
  'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
  'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
  'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
  'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
  'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
  'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
  'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
  'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
  'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
  'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
  'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
  'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
  'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
  'đ': 'd', 'Đ': 'D',
};

/**
 * Remove Vietnamese accents from text
 * @param text - Input text with Vietnamese accents
 * @returns Text without accents
 */
export function removeVietnameseAccents(text: string): string {
  if (!text) return '';
  return text
    .split('')
    .map((char) => vietnameseCharMap[char] || char)
    .join('');
}

/**
 * Create a flexible regex pattern for Vietnamese text search
 * This allows searching with or without accents
 * @param searchText - The search term (can be with or without accents)
 * @returns RegExp that matches both accented and non-accented versions
 */
export function createVietnameseSearchRegex(searchText: string): RegExp {
  if (!searchText || !searchText.trim()) {
    return new RegExp('', 'i');
  }

  const trimmed = searchText.trim();
  
  // Escape special regex characters
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create pattern that matches each character with its Vietnamese variants
  let pattern = '';
  for (const char of escaped) {
    const lowerChar = char.toLowerCase();
    
    // Find all Vietnamese variants of this character
    const variants: string[] = [char];
    
    if (lowerChar === 'a') {
      variants.push('à', 'á', 'ả', 'ã', 'ạ', 'ă', 'ằ', 'ắ', 'ẳ', 'ẵ', 'ặ', 'â', 'ầ', 'ấ', 'ẩ', 'ẫ', 'ậ');
    } else if (lowerChar === 'e') {
      variants.push('è', 'é', 'ẻ', 'ẽ', 'ẹ', 'ê', 'ề', 'ế', 'ể', 'ễ', 'ệ');
    } else if (lowerChar === 'i') {
      variants.push('ì', 'í', 'ỉ', 'ĩ', 'ị');
    } else if (lowerChar === 'o') {
      variants.push('ò', 'ó', 'ỏ', 'õ', 'ọ', 'ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ', 'ơ', 'ờ', 'ớ', 'ở', 'ỡ', 'ợ');
    } else if (lowerChar === 'u') {
      variants.push('ù', 'ú', 'ủ', 'ũ', 'ụ', 'ư', 'ừ', 'ứ', 'ử', 'ữ', 'ự');
    } else if (lowerChar === 'y') {
      variants.push('ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ');
    } else if (lowerChar === 'd') {
      variants.push('đ');
    }
    
    // Also check if input char is Vietnamese and map to base
    const baseChar = vietnameseCharMap[char];
    if (baseChar && !variants.includes(baseChar)) {
      variants.push(baseChar);
    }
    
    if (variants.length > 1) {
      // Create character class with all variants (case insensitive)
      pattern += `[${variants.join('')}]`;
    } else {
      pattern += escaped.charAt(escaped.indexOf(char) !== -1 ? escaped.indexOf(char) : 0) === char ? char : escaped;
    }
  }
  
  return new RegExp(pattern, 'i');
}

/**
 * Check if a text matches search term (accent-insensitive)
 * @param text - Text to search in
 * @param searchTerm - Search term
 * @returns boolean indicating if text contains search term
 */
export function matchesVietnameseSearch(text: string, searchTerm: string): boolean {
  if (!text || !searchTerm) return false;
  
  const normalizedText = removeVietnameseAccents(text.toLowerCase());
  const normalizedSearch = removeVietnameseAccents(searchTerm.toLowerCase().trim());
  
  return normalizedText.includes(normalizedSearch);
}

export default {
  removeVietnameseAccents,
  createVietnameseSearchRegex,
  matchesVietnameseSearch,
};
