#!/usr/bin/env node
/**
 * Duplicate Cleanup Utility Script
 * 
 * This script helps identify and clean up duplicate tasks or resources.
 * It can be used with Commander MCP or other task management systems.
 * 
 * Usage:
 *   npm run cleanup-duplicates [options]
 * 
 * Options:
 *   --dry-run    Show what would be cleaned without actually deleting
 *   --verbose    Show detailed information about duplicates found
 *   --help       Show this help message
 */

import * as fs from 'fs';
import * as path from 'path';

interface DuplicateItem {
  id: string;
  description: string;
  similarity: number;
  group: string[];
}

interface CleanupOptions {
  dryRun: boolean;
  verbose: boolean;
  threshold: number; // Similarity threshold (0-1)
}

class DuplicateCleanup {
  private options: CleanupOptions;

  constructor(options: Partial<CleanupOptions> = {}) {
    this.options = {
      dryRun: options.dryRun ?? false,
      verbose: options.verbose ?? false,
      threshold: options.threshold ?? 0.8
    };
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(str1, str2);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
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
   * Find duplicates in a list of items
   */
  findDuplicates(items: Array<{ id: string; description: string }>): DuplicateItem[] {
    const duplicates: DuplicateItem[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      if (processed.has(items[i].id)) continue;

      const group: string[] = [items[i].id];
      let maxSimilarity = 0;

      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(items[j].id)) continue;

        const similarity = this.calculateSimilarity(
          items[i].description.toLowerCase(),
          items[j].description.toLowerCase()
        );

        if (similarity >= this.options.threshold) {
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

  /**
   * Log duplicate information
   */
  logDuplicates(duplicates: DuplicateItem[]): void {
    if (duplicates.length === 0) {
      console.log('✓ No duplicates found.');
      return;
    }

    console.log(`\nFound ${duplicates.length} duplicate group(s):\n`);

    duplicates.forEach((dup, index) => {
      console.log(`Group ${index + 1} (similarity: ${(dup.similarity * 100).toFixed(1)}%):`);
      console.log(`  Primary: ${dup.id} - ${dup.description}`);
      console.log(`  Duplicates: ${dup.group.slice(1).join(', ')}`);
      
      if (this.options.verbose) {
        console.log(`  Similarity: ${(dup.similarity * 100).toFixed(1)}%`);
      }
      console.log();
    });
  }

  /**
   * Clean up duplicates (dry-run or actual)
   */
  async cleanup(duplicates: DuplicateItem[]): Promise<void> {
    if (this.options.dryRun) {
      console.log('\n[DRY RUN] Would clean up the following duplicates:');
      this.logDuplicates(duplicates);
      console.log('\nRun without --dry-run to actually perform cleanup.');
      return;
    }

    // In a real implementation, this would call Commander MCP to delete duplicates
    console.log('\n[INFO] Actual cleanup would require Commander MCP integration.');
    console.log('This script identifies duplicates. Use Commander MCP tools to delete them.');
  }

  /**
   * Main execution
   */
  async run(): Promise<void> {
    console.log('Duplicate Cleanup Utility');
    console.log('========================\n');

    // Example: In a real scenario, this would fetch tasks from Commander MCP
    // For now, we'll demonstrate with example data
    const exampleItems = [
      { id: '1', description: 'Fix memory leak in logs array' },
      { id: '2', description: 'Fix memory leak in logs array' },
      { id: '3', description: 'Implement ListToolsRequestSchema handler' },
      { id: '4', description: 'Implement ListToolsRequestSchema handler' },
      { id: '5', description: 'Write TDD tests for CDP type safety' }
    ];

    console.log('Analyzing items for duplicates...\n');
    const duplicates = this.findDuplicates(exampleItems);
    
    this.logDuplicates(duplicates);
    await this.cleanup(duplicates);
  }
}

// CLI handling
const args = process.argv.slice(2);
const options: Partial<CleanupOptions> = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  threshold: 0.8
};

if (args.includes('--help')) {
  console.log(`
Duplicate Cleanup Utility

Usage:
  npm run cleanup-duplicates [options]

Options:
  --dry-run    Show what would be cleaned without actually deleting
  --verbose    Show detailed information about duplicates found
  --help       Show this help message

Examples:
  npm run cleanup-duplicates --dry-run
  npm run cleanup-duplicates --verbose
  `);
  process.exit(0);
}

const cleanup = new DuplicateCleanup(options);
cleanup.run().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
