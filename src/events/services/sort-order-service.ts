/**
 * Sort Order Computation Service
 *
 * Computes sort_order values for events based on before/after DAG relationships.
 * Uses topological sort to order events respecting their relative ordering constraints.
 */

import { App, TFile } from 'obsidian';
import type { EventNote } from '../types/event-types';
import { getLogger } from '../../core/logging';

const logger = getLogger('SortOrderService');

/**
 * Result of computing sort order for events
 */
export interface SortOrderResult {
	/** Number of events that were updated */
	updatedCount: number;
	/** Events that couldn't be ordered due to cycles */
	cycleEvents: string[];
	/** Any errors encountered */
	errors: string[];
}

/**
 * Compute and update sort_order values for events based on before/after relationships.
 * Uses topological sort respecting date-based ordering first, then before/after constraints.
 *
 * @param app - Obsidian App instance
 * @param events - All event notes to process
 * @returns Result with counts and any cycle information
 */
export async function computeSortOrder(
	app: App,
	events: EventNote[]
): Promise<SortOrderResult> {
	const result: SortOrderResult = {
		updatedCount: 0,
		cycleEvents: [],
		errors: []
	};

	if (events.length === 0) {
		return result;
	}

	// Build lookup maps
	const eventByPath = new Map<string, EventNote>();
	const eventByCrId = new Map<string, EventNote>();

	for (const event of events) {
		eventByPath.set(event.filePath, event);
		// Also index without .md extension for wikilinks
		const pathWithoutMd = event.filePath.replace(/\.md$/, '');
		eventByPath.set(pathWithoutMd, event);
		// Also just filename for simple wikilinks
		const filename = event.filePath.split('/').pop()?.replace(/\.md$/, '') || '';
		if (filename) {
			eventByPath.set(filename, event);
		}
		eventByCrId.set(event.crId, event);
	}

	// Build adjacency list for the DAG
	// edge from A -> B means "A comes before B"
	const graph = new Map<string, Set<string>>();
	const inDegree = new Map<string, number>();

	// Initialize all nodes
	for (const event of events) {
		graph.set(event.crId, new Set());
		inDegree.set(event.crId, 0);
	}

	// Add edges from before/after relationships
	for (const event of events) {
		// If this event has "before" references, it should come before those events
		// This event -> referenced event
		if (event.before) {
			for (const beforeRef of event.before) {
				const refPath = normalizeWikilink(beforeRef);
				const targetEvent = eventByPath.get(refPath);
				if (targetEvent) {
					// Edge: this event -> target event (this comes before target)
					graph.get(event.crId)!.add(targetEvent.crId);
					inDegree.set(targetEvent.crId, (inDegree.get(targetEvent.crId) || 0) + 1);
				}
			}
		}

		// If this event has "after" references, those events should come before this one
		// Referenced event -> this event
		if (event.after) {
			for (const afterRef of event.after) {
				const refPath = normalizeWikilink(afterRef);
				const sourceEvent = eventByPath.get(refPath);
				if (sourceEvent) {
					// Edge: source event -> this event (source comes before this)
					graph.get(sourceEvent.crId)!.add(event.crId);
					inDegree.set(event.crId, (inDegree.get(event.crId) || 0) + 1);
				}
			}
		}
	}

	// Perform topological sort using Kahn's algorithm
	// Start with events that have no incoming edges
	const queue: EventNote[] = [];

	// Sort by date first, then add to queue
	const sortedByDate = [...events].sort((a, b) => {
		if (a.date && b.date) {
			return a.date.localeCompare(b.date);
		}
		if (a.date) return -1;
		if (b.date) return 1;
		return a.title.localeCompare(b.title);
	});

	// Add events with no dependencies to the queue
	for (const event of sortedByDate) {
		if (inDegree.get(event.crId) === 0) {
			queue.push(event);
		}
	}

	// Process the queue
	const sortedOrder: EventNote[] = [];
	const visited = new Set<string>();

	while (queue.length > 0) {
		// Sort queue by date for stable ordering
		queue.sort((a, b) => {
			if (a.date && b.date) {
				return a.date.localeCompare(b.date);
			}
			if (a.date) return -1;
			if (b.date) return 1;
			return a.title.localeCompare(b.title);
		});

		const event = queue.shift()!;

		if (visited.has(event.crId)) {
			continue;
		}

		visited.add(event.crId);
		sortedOrder.push(event);

		// Process outgoing edges
		for (const neighborId of graph.get(event.crId) || []) {
			const newDegree = (inDegree.get(neighborId) || 1) - 1;
			inDegree.set(neighborId, newDegree);

			if (newDegree === 0 && !visited.has(neighborId)) {
				const neighbor = eventByCrId.get(neighborId);
				if (neighbor) {
					queue.push(neighbor);
				}
			}
		}
	}

	// Check for cycles (events that weren't visited)
	for (const event of events) {
		if (!visited.has(event.crId)) {
			result.cycleEvents.push(event.title);
		}
	}

	if (result.cycleEvents.length > 0) {
		logger.warn('computeSortOrder', `Detected cycles involving ${result.cycleEvents.length} events`);
	}

	// Assign sort_order values and update frontmatter
	for (let i = 0; i < sortedOrder.length; i++) {
		const event = sortedOrder[i];
		const sortOrder = (i + 1) * 10; // Use increments of 10 for flexibility

		// Only update if the value changed
		if (event.sortOrder !== sortOrder) {
			try {
				await updateEventSortOrder(app, event.file, sortOrder);
				result.updatedCount++;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				result.errors.push(`Failed to update ${event.title}: ${errorMsg}`);
				logger.error('computeSortOrder', `Failed to update ${event.filePath}`, error);
			}
		}
	}

	logger.info('computeSortOrder', `Updated sort_order for ${result.updatedCount} events`);
	return result;
}

/**
 * Update the sort_order property in an event note's frontmatter
 */
async function updateEventSortOrder(app: App, file: TFile, sortOrder: number): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		frontmatter.sort_order = sortOrder;
	});
}

/**
 * Normalize a wikilink to a path for lookup
 */
function normalizeWikilink(link: string): string {
	return link
		.replace(/^\[\[/, '')
		.replace(/\]\]$/, '')
		.trim();
}

/**
 * Clear sort_order values from all events
 */
export async function clearSortOrder(
	app: App,
	events: EventNote[]
): Promise<number> {
	let clearedCount = 0;

	for (const event of events) {
		if (event.sortOrder !== undefined) {
			try {
				await app.fileManager.processFrontMatter(event.file, (frontmatter) => {
					delete frontmatter.sort_order;
				});
				clearedCount++;
			} catch (error) {
				logger.error('clearSortOrder', `Failed to clear sort_order for ${event.filePath}`, error);
			}
		}
	}

	logger.info('clearSortOrder', `Cleared sort_order from ${clearedCount} events`);
	return clearedCount;
}
