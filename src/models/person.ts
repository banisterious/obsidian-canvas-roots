/**
 * Person data model matching the Charted Roots Schema
 */
export interface Person {
	/** Unique identifier (UUID) - MANDATORY */
	cr_id: string;

	/** Display name (defaults to file title) */
	name: string;

	/** Path to the person's note file */
	filePath: string;

	/** Link to father's note */
	father?: string;

	/** Link to mother's note */
	mother?: string;

	/** Link(s) to spouse(s) - LEGACY FORMAT */
	spouse?: string | string[];

	/** Birth date (YYYY-MM-DD) */
	born?: string;

	/** Death date (YYYY-MM-DD) */
	died?: string;

	/** Whether this person is the root of the tree */
	cr_root?: boolean;

	/** Children links */
	child?: string | string[];
}

/**
 * Enhanced spouse relationship with metadata
 * Supports complex marital histories with temporal tracking
 */
export interface SpouseRelationship {
	/** cr_id of spouse - REQUIRED */
	personId: string;

	/** Wikilink to spouse's note (for display) */
	personLink?: string;

	/** Date of marriage (flexible format: YYYY, YYYY-MM, YYYY-MM-DD) */
	marriageDate?: string;

	/** Date of divorce/separation if applicable */
	divorceDate?: string;

	/** Current status of the marriage */
	marriageStatus?: 'current' | 'divorced' | 'widowed' | 'separated' | 'annulled';

	/** Location of marriage (can be wikilink) */
	marriageLocation?: string;

	/** Explicit ordering for layout (1, 2, 3...) */
	marriageOrder?: number;
}

/**
 * Normalized person data for graph processing
 */
export interface PersonNode {
	id: string;
	name: string;
	filePath: string;
	fatherId?: string;
	motherId?: string;

	/** Legacy: simple array of spouse cr_ids (for backward compatibility) */
	spouseIds: string[];

	/** Enhanced: array of spouse relationships with metadata */
	spouses?: SpouseRelationship[];

	childIds: string[];
	born?: string;
	died?: string;
	isRoot?: boolean;
}

/**
 * Family unit representing a marriage/partnership
 */
export interface FamilyUnit {
	id: string;
	spouseIds: string[];
	childIds: string[];

	/** Optional: Marriage metadata if available */
	marriageDate?: string;
	marriageOrder?: number;
}
