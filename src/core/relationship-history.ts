/**
 * Relationship History Service for Canvas Roots
 *
 * Tracks relationship changes with timestamps and provides undo functionality.
 * History is persisted to plugin data and can be configured with retention periods.
 */

import { App, TFile, Notice } from 'obsidian';
import { getLogger } from './logging';
import { getErrorMessage } from './error-utils';

const logger = getLogger('RelationshipHistory');

/**
 * Types of relationship changes that can be tracked
 */
export type RelationshipChangeType =
	| 'add_father'
	| 'add_mother'
	| 'add_spouse'
	| 'add_child'
	| 'remove_father'
	| 'remove_mother'
	| 'remove_spouse'
	| 'remove_child'
	| 'update_father'
	| 'update_mother';

/**
 * A single relationship change record
 */
export interface RelationshipChange {
	/** Unique identifier for this change */
	id: string;
	/** Timestamp when change occurred */
	timestamp: number;
	/** Type of change */
	type: RelationshipChangeType;
	/** Path to the source file where change was made */
	sourceFile: string;
	/** Display name of the source person */
	sourceName: string;
	/** cr_id of the source person */
	sourceCrId: string;
	/** Path to the target file (the related person) */
	targetFile: string;
	/** Display name of the target person */
	targetName: string;
	/** cr_id of the target person */
	targetCrId: string;
	/** Previous value (for updates or removals) */
	previousValue?: string;
	/** New value (for additions or updates) */
	newValue?: string;
	/** Whether this change has been undone */
	undone: boolean;
	/** Whether this change was part of bidirectional sync (auto-generated) */
	isBidirectionalSync: boolean;
}

/**
 * History data structure stored in plugin data
 */
export interface RelationshipHistoryData {
	/** Version for future migrations */
	version: number;
	/** All recorded changes */
	changes: RelationshipChange[];
	/** Last cleanup timestamp */
	lastCleanup: number;
}

/**
 * Statistics about the relationship history
 */
export interface HistoryStats {
	totalChanges: number;
	undoneChanges: number;
	changesLast24h: number;
	changesLast7d: number;
	oldestChange: number | null;
	newestChange: number | null;
	changesByType: Record<RelationshipChangeType, number>;
}

/**
 * Options for recording a change
 */
export interface RecordChangeOptions {
	type: RelationshipChangeType;
	sourceFile: TFile;
	sourceName: string;
	sourceCrId: string;
	targetFile: TFile;
	targetName: string;
	targetCrId: string;
	previousValue?: string;
	newValue?: string;
	isBidirectionalSync?: boolean;
}

const HISTORY_DATA_KEY = 'relationship-history';
const CURRENT_VERSION = 1;

/**
 * Service for tracking and managing relationship change history
 */
export class RelationshipHistoryService {
	private history: RelationshipHistoryData;
	private saveCallback: (data: RelationshipHistoryData) => Promise<void>;

	constructor(
		private app: App,
		initialData: RelationshipHistoryData | null,
		saveCallback: (data: RelationshipHistoryData) => Promise<void>
	) {
		this.saveCallback = saveCallback;
		this.history = initialData || this.createEmptyHistory();

		// Migrate if needed
		if (this.history.version < CURRENT_VERSION) {
			this.migrateHistory();
		}

		logger.info('history-init', `Loaded ${this.history.changes.length} history entries`);
	}

	/**
	 * Create empty history structure
	 */
	private createEmptyHistory(): RelationshipHistoryData {
		return {
			version: CURRENT_VERSION,
			changes: [],
			lastCleanup: Date.now()
		};
	}

	/**
	 * Migrate history data to current version
	 */
	private migrateHistory(): void {
		// Future migrations would go here
		this.history.version = CURRENT_VERSION;
		logger.info('history-migrate', `Migrated history to version ${CURRENT_VERSION}`);
	}

	/**
	 * Generate a unique ID for a change
	 */
	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Record a relationship change
	 */
	async recordChange(options: RecordChangeOptions): Promise<RelationshipChange> {
		const change: RelationshipChange = {
			id: this.generateId(),
			timestamp: Date.now(),
			type: options.type,
			sourceFile: options.sourceFile.path,
			sourceName: options.sourceName,
			sourceCrId: options.sourceCrId,
			targetFile: options.targetFile.path,
			targetName: options.targetName,
			targetCrId: options.targetCrId,
			previousValue: options.previousValue,
			newValue: options.newValue,
			undone: false,
			isBidirectionalSync: options.isBidirectionalSync || false
		};

		this.history.changes.push(change);

		logger.info('history-record', 'Recorded relationship change', {
			id: change.id,
			type: change.type,
			source: change.sourceName,
			target: change.targetName
		});

		await this.save();
		return change;
	}

	/**
	 * Undo a specific change by ID
	 */
	async undoChange(changeId: string): Promise<boolean> {
		const change = this.history.changes.find(c => c.id === changeId);
		if (!change) {
			logger.warn('history-undo', `Change not found: ${changeId}`);
			return false;
		}

		if (change.undone) {
			logger.warn('history-undo', `Change already undone: ${changeId}`);
			return false;
		}

		try {
			// Perform the actual undo operation
			await this.performUndo(change);

			// Mark as undone
			change.undone = true;
			await this.save();

			logger.info('history-undo', 'Successfully undid change', {
				id: change.id,
				type: change.type
			});

			return true;
		} catch (error) {
			const errorMsg = getErrorMessage(error);
			logger.error('history-undo', 'Failed to undo change', {
				id: changeId,
				error: errorMsg
			});
			new Notice(`Failed to undo change: ${errorMsg}`);
			return false;
		}
	}

	/**
	 * Perform the actual undo operation by reverting the frontmatter change
	 */
	private async performUndo(change: RelationshipChange): Promise<void> {
		const sourceFile = this.app.vault.getAbstractFileByPath(change.sourceFile);
		if (!(sourceFile instanceof TFile)) {
			throw new Error(`Source file not found: ${change.sourceFile}`);
		}

		await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
			switch (change.type) {
				case 'add_father':
					// Remove the added father
					delete frontmatter.father;
					delete frontmatter.father_id;
					break;

				case 'add_mother':
					// Remove the added mother
					delete frontmatter.mother;
					delete frontmatter.mother_id;
					break;

				case 'add_spouse':
					// Remove the added spouse from array
					this.removeFromArrayProperty(frontmatter, 'spouse', change.newValue);
					this.removeFromArrayProperty(frontmatter, 'spouse_id', change.targetCrId);
					break;

				case 'add_child':
					// Remove the added child from array
					this.removeFromArrayProperty(frontmatter, 'child', change.newValue);
					this.removeFromArrayProperty(frontmatter, 'children_id', change.targetCrId);
					break;

				case 'remove_father':
					// Restore the removed father
					frontmatter.father = change.previousValue;
					frontmatter.father_id = change.targetCrId;
					break;

				case 'remove_mother':
					// Restore the removed mother
					frontmatter.mother = change.previousValue;
					frontmatter.mother_id = change.targetCrId;
					break;

				case 'remove_spouse':
					// Restore the removed spouse
					this.addToArrayProperty(frontmatter, 'spouse', change.previousValue);
					this.addToArrayProperty(frontmatter, 'spouse_id', change.targetCrId);
					break;

				case 'remove_child':
					// Restore the removed child
					this.addToArrayProperty(frontmatter, 'child', change.previousValue);
					this.addToArrayProperty(frontmatter, 'children_id', change.targetCrId);
					break;

				case 'update_father':
					// Restore previous father
					frontmatter.father = change.previousValue;
					break;

				case 'update_mother':
					// Restore previous mother
					frontmatter.mother = change.previousValue;
					break;
			}
		});
	}

	/**
	 * Helper to remove a value from an array property in frontmatter
	 */
	private removeFromArrayProperty(
		frontmatter: Record<string, unknown>,
		property: string,
		value: string | undefined
	): void {
		if (!value) return;

		const existing = frontmatter[property];
		if (Array.isArray(existing)) {
			frontmatter[property] = existing.filter(v => v !== value && !String(v).includes(value));
			// If array becomes empty, remove property
			if ((frontmatter[property] as unknown[]).length === 0) {
				delete frontmatter[property];
			} else if ((frontmatter[property] as unknown[]).length === 1) {
				// Convert single-item array to single value
				frontmatter[property] = (frontmatter[property] as unknown[])[0];
			}
		} else if (typeof existing === 'string' && (existing === value || existing.includes(value))) {
			delete frontmatter[property];
		}
	}

	/**
	 * Helper to add a value to an array property in frontmatter
	 */
	private addToArrayProperty(
		frontmatter: Record<string, unknown>,
		property: string,
		value: string | undefined
	): void {
		if (!value) return;

		const existing = frontmatter[property];
		if (Array.isArray(existing)) {
			if (!existing.includes(value)) {
				existing.push(value);
			}
		} else if (typeof existing === 'string') {
			frontmatter[property] = [existing, value];
		} else {
			frontmatter[property] = value;
		}
	}

	/**
	 * Undo the most recent (non-undone) change
	 */
	async undoLastChange(): Promise<RelationshipChange | null> {
		// Find the most recent non-undone change
		const recentChanges = this.history.changes
			.filter(c => !c.undone)
			.sort((a, b) => b.timestamp - a.timestamp);

		if (recentChanges.length === 0) {
			logger.info('history-undo', 'No changes to undo');
			new Notice('No relationship changes to undo');
			return null;
		}

		const change = recentChanges[0];
		const success = await this.undoChange(change.id);

		return success ? change : null;
	}

	/**
	 * Get all changes for a specific person (by file path)
	 */
	getChangesForPerson(filePath: string): RelationshipChange[] {
		return this.history.changes
			.filter(c => c.sourceFile === filePath || c.targetFile === filePath)
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Get recent changes (within specified hours)
	 */
	getRecentChanges(hours: number = 24): RelationshipChange[] {
		const cutoff = Date.now() - (hours * 60 * 60 * 1000);
		return this.history.changes
			.filter(c => c.timestamp >= cutoff)
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Get all changes (most recent first)
	 */
	getAllChanges(): RelationshipChange[] {
		return [...this.history.changes].sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Get undoable changes (non-undone, most recent first)
	 */
	getUndoableChanges(): RelationshipChange[] {
		return this.history.changes
			.filter(c => !c.undone)
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Get history statistics
	 */
	getStats(): HistoryStats {
		const now = Date.now();
		const day = 24 * 60 * 60 * 1000;
		const week = 7 * day;

		const changes = this.history.changes;
		const timestamps = changes.map(c => c.timestamp);

		const changesByType: Record<RelationshipChangeType, number> = {
			add_father: 0,
			add_mother: 0,
			add_spouse: 0,
			add_child: 0,
			remove_father: 0,
			remove_mother: 0,
			remove_spouse: 0,
			remove_child: 0,
			update_father: 0,
			update_mother: 0
		};

		for (const change of changes) {
			changesByType[change.type]++;
		}

		return {
			totalChanges: changes.length,
			undoneChanges: changes.filter(c => c.undone).length,
			changesLast24h: changes.filter(c => c.timestamp >= now - day).length,
			changesLast7d: changes.filter(c => c.timestamp >= now - week).length,
			oldestChange: timestamps.length > 0 ? Math.min(...timestamps) : null,
			newestChange: timestamps.length > 0 ? Math.max(...timestamps) : null,
			changesByType
		};
	}

	/**
	 * Clean up old history entries based on retention period (in days)
	 */
	async cleanupOldEntries(retentionDays: number): Promise<number> {
		const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
		const initialCount = this.history.changes.length;

		this.history.changes = this.history.changes.filter(c => c.timestamp >= cutoff);
		this.history.lastCleanup = Date.now();

		const removedCount = initialCount - this.history.changes.length;

		if (removedCount > 0) {
			await this.save();
			logger.info('history-cleanup', `Removed ${removedCount} old history entries`);
		}

		return removedCount;
	}

	/**
	 * Clear all history
	 */
	async clearHistory(): Promise<void> {
		const count = this.history.changes.length;
		this.history = this.createEmptyHistory();
		await this.save();
		logger.info('history-clear', `Cleared ${count} history entries`);
	}

	/**
	 * Save history to plugin data
	 */
	private async save(): Promise<void> {
		await this.saveCallback(this.history);
	}

	/**
	 * Get the data key used for storage
	 */
	static getDataKey(): string {
		return HISTORY_DATA_KEY;
	}
}

/**
 * Format a change for display
 */
export function formatChangeDescription(change: RelationshipChange): string {
	const source = change.sourceName;
	const target = change.targetName;

	switch (change.type) {
		case 'add_father':
			return `Added ${target} as father of ${source}`;
		case 'add_mother':
			return `Added ${target} as mother of ${source}`;
		case 'add_spouse':
			return `Added ${target} as spouse of ${source}`;
		case 'add_child':
			return `Added ${target} as child of ${source}`;
		case 'remove_father':
			return `Removed ${target} as father of ${source}`;
		case 'remove_mother':
			return `Removed ${target} as mother of ${source}`;
		case 'remove_spouse':
			return `Removed ${target} as spouse of ${source}`;
		case 'remove_child':
			return `Removed ${target} as child of ${source}`;
		case 'update_father':
			return `Changed father of ${source} from ${change.previousValue} to ${target}`;
		case 'update_mother':
			return `Changed mother of ${source} from ${change.previousValue} to ${target}`;
		default: {
			const _exhaustiveCheck: never = change.type;
			return `Unknown change: ${_exhaustiveCheck}`;
		}
	}
}

/**
 * Format a timestamp for display
 */
export function formatChangeTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diff = now.getTime() - timestamp;

	// Less than a minute ago
	if (diff < 60 * 1000) {
		return 'Just now';
	}

	// Less than an hour ago
	if (diff < 60 * 60 * 1000) {
		const minutes = Math.floor(diff / (60 * 1000));
		return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	}

	// Less than a day ago
	if (diff < 24 * 60 * 60 * 1000) {
		const hours = Math.floor(diff / (60 * 60 * 1000));
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	}

	// Less than a week ago
	if (diff < 7 * 24 * 60 * 60 * 1000) {
		const days = Math.floor(diff / (24 * 60 * 60 * 1000));
		return `${days} day${days === 1 ? '' : 's'} ago`;
	}

	// Format as date
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
