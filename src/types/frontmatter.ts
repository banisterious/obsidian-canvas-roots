/**
 * Type definitions for person note frontmatter
 *
 * These interfaces define the expected structure of frontmatter
 * in person notes managed by Charted Roots.
 */

import type { SourcedFacts } from '../sources/types/source-types';

/**
 * Research level values based on Yvette Hoitink's "Six Levels of Ancestral Profiles"
 *
 * Tracks research progress toward GPS-compliant documentation:
 * - 0: Unidentified - Ancestor exists but no name established (placeholder)
 * - 1: Name Only - Name known, appears in others' records, no vital dates
 * - 2: Vital Statistics - Birth, marriage, death dates researched
 * - 3: Life Events - Occupations, residences, children, spouses documented
 * - 4: Extended Records - Property, military, religion, legal records researched
 * - 5: GPS Complete - Exhaustive research complete, written proof summary exists
 * - 6: Biography - Full narrative biography with historical context
 *
 * Use null/undefined for "not assessed" (distinct from level 0 "unidentified")
 */
export type ResearchLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Research level metadata for display purposes
 */
export const RESEARCH_LEVELS: Record<ResearchLevel, { name: string; description: string }> = {
	0: { name: 'Unidentified', description: 'Ancestor exists but no name established' },
	1: { name: 'Name Only', description: 'Name known, appears in others\' records' },
	2: { name: 'Vital Statistics', description: 'Birth, marriage, death dates researched' },
	3: { name: 'Life Events', description: 'Occupations, residences, children documented' },
	4: { name: 'Extended Records', description: 'Property, military, legal records researched' },
	5: { name: 'GPS Complete', description: 'Exhaustive research, written proof summary' },
	6: { name: 'Biography', description: 'Full narrative with historical context' }
};

/**
 * Basic frontmatter fields for a person note.
 * Uses index signature to allow dynamic spouse properties (spouse1, spouse2, etc.)
 */
export interface PersonFrontmatter {
	cr_id?: string;
	name?: string;
	// Biological parents
	father?: string;
	father_id?: string;
	mother?: string;
	mother_id?: string;
	// Step-parents (can be arrays for multiple step-parents)
	stepfather?: string | string[];
	stepfather_id?: string | string[];
	stepmother?: string | string[];
	stepmother_id?: string | string[];
	// Adoptive parents
	adoptive_father?: string;
	adoptive_father_id?: string;
	adoptive_mother?: string;
	adoptive_mother_id?: string;
	// Gender-neutral parents (opt-in via settings)
	parents?: string | string[];
	parents_id?: string | string[];
	// Spouses and children
	spouse?: string | string[];
	spouse_id?: string;
	children?: string | string[];
	sex?: string;
	gender?: string; // Kept for backwards compatibility - users can use either
	gender_identity?: string; // Distinct from biological sex - for identity tracking
	birth_date?: string;
	death_date?: string;
	birth_place?: string;
	death_place?: string;
	group_name?: string;
	/**
	 * Fact-level source tracking for GPS-aligned research
	 * Maps fact keys (birth_date, death_date, etc.) to source citations
	 *
	 * @deprecated Use individual sourced_* properties instead (e.g., sourced_birth_date)
	 * This nested format is incompatible with Obsidian's property panel.
	 * Maintained for backward compatibility until migration is complete.
	 */
	sourced_facts?: SourcedFacts;
	/**
	 * Flat sourced fact properties (Obsidian-compatible format)
	 * Each is an array of wikilinks to source notes.
	 * These replace the nested sourced_facts object.
	 */
	sourced_birth_date?: string[];
	sourced_birth_place?: string[];
	sourced_death_date?: string[];
	sourced_death_place?: string[];
	sourced_parents?: string[];
	sourced_marriage_date?: string[];
	sourced_marriage_place?: string[];
	sourced_spouse?: string[];
	sourced_occupation?: string[];
	sourced_residence?: string[];
	/**
	 * Research level tracking based on Hoitink's Six Levels
	 * 0-6 scale from "Unidentified" to "Biography"
	 * undefined = not assessed (distinct from 0 = unidentified)
	 */
	research_level?: ResearchLevel;
	/**
	 * General person-level sources (distinct from fact-level sourced_* properties)
	 * Array of wikilinks to source notes that document this person.
	 * Migrated from legacy source, source_2, source_3 properties by SourceMigrationService.
	 */
	sources?: string[];
	/**
	 * Companion cr_id array for sources (follows children/children_id pattern)
	 * Enables reliable linking even when source notes are renamed.
	 */
	sources_id?: string[];
	// Index signature for dynamic properties (spouse1, spouse1_id, spouse2, etc.)
	[key: string]: string | string[] | number | SourcedFacts | undefined;
}

/**
 * Spouse value type - can be string, array, or undefined
 */
export type SpouseValue = string | string[] | undefined;
