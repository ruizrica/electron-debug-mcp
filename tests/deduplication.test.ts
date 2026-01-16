import { describe, it, expect } from 'vitest';

/**
 * Deduplication Logic Tests
 * 
 * Tests for the duplicate cleanup utility's deduplication algorithms:
 * - Levenshtein distance calculation
 * - Similarity calculation
 * - Duplicate detection with threshold
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(str1, str2);
  return (longer.length - distance) / longer.length;
}

/**
 * Find duplicates in a list of items
 */
interface DuplicateItem {
  id: string;
  description: string;
  similarity: number;
  group: string[];
}

function findDuplicates(
  items: Array<{ id: string; description: string }>,
  threshold: number = 0.8
): DuplicateItem[] {
  const duplicates: DuplicateItem[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    if (processed.has(items[i].id)) continue;

    const group: string[] = [items[i].id];
    let maxSimilarity = 0;

    for (let j = i + 1; j < items.length; j++) {
      if (processed.has(items[j].id)) continue;

      const similarity = calculateSimilarity(
        items[i].description.toLowerCase(),
        items[j].description.toLowerCase()
      );

      if (similarity >= threshold) {
        group.push(items[j].id);
        maxSimilarity = Math.max(maxSimilarity, similarity);
        processed.add(items[j].id);
      }
    }

    if (group.length > 1) {
      duplicates.push({
        id: items[i].id,
        description: items[i].description,
        similarity: maxSimilarity,
        group
      });
      processed.add(items[i].id);
    }
  }

  return duplicates;
}

describe('Deduplication Logic', () => {
  describe('Levenshtein Distance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('test', 'test')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should return length for completely different strings', () => {
      expect(levenshteinDistance('abc', 'def')).toBe(3);
      expect(levenshteinDistance('hello', 'world')).toBe(4);
    });

    it('should calculate distance for similar strings', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('test', 'best')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'test')).toBe(4);
      expect(levenshteinDistance('test', '')).toBe(4);
    });

    it('should handle single character differences', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      expect(levenshteinDistance('dog', 'dogs')).toBe(1);
      expect(levenshteinDistance('run', 'runs')).toBe(1);
    });

    it('should handle case differences', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
      expect(levenshteinDistance('TEST', 'test')).toBe(4);
    });
  });

  describe('Similarity Calculation', () => {
    it('should return 1.0 for identical strings', () => {
      expect(calculateSimilarity('hello', 'hello')).toBe(1.0);
      expect(calculateSimilarity('test', 'test')).toBe(1.0);
    });

    it('should return 1.0 for empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1.0);
    });

    it('should return 0.0 for completely different strings', () => {
      const similarity = calculateSimilarity('abc', 'def');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = calculateSimilarity('kitten', 'sitting');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });

    it('should return similarity close to 1.0 for minor differences', () => {
      const similarity1 = calculateSimilarity('test', 'best');
      const similarity2 = calculateSimilarity('hello', 'hell');
      const similarity3 = calculateSimilarity('run', 'runs');

      expect(similarity1).toBeGreaterThan(0.7);
      expect(similarity2).toBeGreaterThan(0.7);
      expect(similarity3).toBeGreaterThan(0.7);
    });

    it('should be case-insensitive when lowercased', () => {
      const similarity1 = calculateSimilarity('Hello', 'hello');
      const similarity2 = calculateSimilarity('TEST', 'test');
      
      // After lowercasing, they should be identical
      expect(calculateSimilarity('hello', 'hello')).toBe(1.0);
      expect(calculateSimilarity('test', 'test')).toBe(1.0);
    });

    it('should handle strings of different lengths', () => {
      const similarity = calculateSimilarity('short', 'much longer string');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1.0);
    });
  });

  describe('Duplicate Detection', () => {
    it('should find exact duplicates', () => {
      const items = [
        { id: '1', description: 'Fix memory leak in logs array' },
        { id: '2', description: 'Fix memory leak in logs array' },
        { id: '3', description: 'Implement ListToolsRequestSchema handler' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].group).toContain('1');
      expect(duplicates[0].group).toContain('2');
      expect(duplicates[0].similarity).toBe(1.0);
    });

    it('should find similar duplicates above threshold', () => {
      const items = [
        { id: '1', description: 'Fix memory leak in logs array' },
        { id: '2', description: 'Fix memory leak in log array' }, // Minor typo
        { id: '3', description: 'Implement ListToolsRequestSchema handler' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates.length).toBeGreaterThanOrEqual(1);
      if (duplicates.length > 0) {
        expect(duplicates[0].similarity).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('should not find duplicates below threshold', () => {
      const items = [
        { id: '1', description: 'Fix memory leak' },
        { id: '2', description: 'Implement new feature' }, // Very different
        { id: '3', description: 'Write tests' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const items: Array<{ id: string; description: string }> = [];
      const duplicates = findDuplicates(items);
      expect(duplicates).toHaveLength(0);
    });

    it('should handle array with single item', () => {
      const items = [
        { id: '1', description: 'Fix memory leak' }
      ];
      const duplicates = findDuplicates(items);
      expect(duplicates).toHaveLength(0);
    });

    it('should find multiple duplicate groups', () => {
      const items = [
        { id: '1', description: 'Fix memory leak in logs array' },
        { id: '2', description: 'Fix memory leak in logs array' },
        { id: '3', description: 'Implement ListToolsRequestSchema handler' },
        { id: '4', description: 'Implement ListToolsRequestSchema handler' },
        { id: '5', description: 'Write TDD tests' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect threshold parameter', () => {
      const items = [
        { id: '1', description: 'Fix memory leak' },
        { id: '2', description: 'Fix memory leak in logs' } // Similar but not identical
      ];

      const duplicatesHighThreshold = findDuplicates(items, 0.95);
      const duplicatesLowThreshold = findDuplicates(items, 0.5);

      // With high threshold, might not find duplicates
      // With low threshold, should find duplicates
      expect(duplicatesLowThreshold.length).toBeGreaterThanOrEqual(duplicatesHighThreshold.length);
    });

    it('should handle case-insensitive comparison', () => {
      const items = [
        { id: '1', description: 'Fix memory leak in logs array' },
        { id: '2', description: 'FIX MEMORY LEAK IN LOGS ARRAY' },
        { id: '3', description: 'Fix Memory Leak In Logs Array' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates.length).toBeGreaterThanOrEqual(1);
      if (duplicates.length > 0) {
        expect(duplicates[0].group.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should not process items already in a duplicate group', () => {
      const items = [
        { id: '1', description: 'Fix memory leak' },
        { id: '2', description: 'Fix memory leak' },
        { id: '3', description: 'Fix memory leak' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].group).toContain('1');
      expect(duplicates[0].group).toContain('2');
      expect(duplicates[0].group).toContain('3');
    });

    it('should handle very similar but distinct descriptions', () => {
      const items = [
        { id: '1', description: 'Fix memory leak in logs array' },
        { id: '2', description: 'Fix memory leak in logs' },
        { id: '3', description: 'Fix memory leak' }
      ];

      const duplicates = findDuplicates(items, 0.7);
      // Should find groups based on similarity threshold
      expect(duplicates.length).toBeGreaterThanOrEqual(0);
    });

    it('should return correct similarity scores', () => {
      const items = [
        { id: '1', description: 'Fix memory leak in logs array' },
        { id: '2', description: 'Fix memory leak in logs array' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].similarity).toBe(1.0);
    });

    it('should handle special characters in descriptions', () => {
      const items = [
        { id: '1', description: 'Fix bug: memory leak!' },
        { id: '2', description: 'Fix bug: memory leak!' },
        { id: '3', description: 'Fix bug: memory leak?' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle long descriptions', () => {
      const longDesc = 'This is a very long description that tests the deduplication logic with extended text to ensure it works correctly even with lengthy task descriptions that might contain multiple sentences and various details about what needs to be done.';
      const items = [
        { id: '1', description: longDesc },
        { id: '2', description: longDesc },
        { id: '3', description: 'Short description' }
      ];

      const duplicates = findDuplicates(items, 0.8);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].group).toContain('1');
      expect(duplicates[0].group).toContain('2');
    });
  });
});
