/**
 * Enrich Place Hierarchy Modal
 *
 * Modal for batch enriching place hierarchy using geocoding.
 * Geocodes places without parents, parses the display_name into hierarchy
 * components, and creates/links parent place notes.
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { GeocodingService } from '../services/geocoding-service';
import { PlaceGraphService } from '../../core/place-graph';
import { createPlaceNote, updatePlaceNote, PlaceData } from '../../core/place-note-writer';
import type { PlaceNode, PlaceType } from '../../models/place';
import { setLucideIcon, createLucideIcon } from '../../ui/lucide-icons';

/**
 * Result of hierarchy enrichment for a single place
 */
export interface HierarchyEnrichmentResult {
	placeName: string;
	success: boolean;
	/** Parsed hierarchy components from geocoding */
	hierarchy?: string[];
	/** Parent places created */
	parentsCreated?: string[];
	/** Parent place linked to */
	parentLinked?: string;
	/** Error message if failed */
	error?: string;
	/** Whether place was skipped (already has parent) */
	skipped?: boolean;
}

/**
 * Summary of bulk hierarchy enrichment
 */
export interface BulkHierarchyEnrichmentResult {
	total: number;
	enriched: number;
	parentsCreated: number;
	failed: number;
	skipped: number;
	cancelled: number;
	results: HierarchyEnrichmentResult[];
}

/**
 * Options for the enrich place hierarchy modal
 */
export interface EnrichPlaceHierarchyModalOptions {
	/** Directory for creating new place notes */
	directory?: string;
	/** Callback when enrichment is complete */
	onComplete?: (result: BulkHierarchyEnrichmentResult) => void;
}

/**
 * Known place type mappings from OSM/Nominatim address components
 */
const OSM_TYPE_MAP: Record<string, PlaceType> = {
	country: 'country',
	state: 'state',
	province: 'province',
	region: 'region',
	county: 'county',
	city: 'city',
	town: 'town',
	village: 'village',
	municipality: 'city',
	district: 'district',
	suburb: 'district',
	neighbourhood: 'district',
	hamlet: 'village'
};

/**
 * Modal for enriching place hierarchy via geocoding
 */
export class EnrichPlaceHierarchyModal extends Modal {
	private placeGraph: PlaceGraphService;
	private geocodingService: GeocodingService;
	private options: EnrichPlaceHierarchyModalOptions;

	private placesToEnrich: PlaceNode[] = [];
	private isRunning = false;
	private isCancelled = false;
	private hasCompleted = false;

	private progressContainer: HTMLElement | null = null;
	private progressBar: HTMLElement | null = null;
	private progressText: HTMLElement | null = null;
	private resultsList: HTMLElement | null = null;
	private startButton: HTMLButtonElement | null = null;
	private cancelButton: HTMLButtonElement | null = null;
	private countText: HTMLElement | null = null;
	private timeText: HTMLElement | null = null;
	private previewContainer: HTMLElement | null = null;

	private createMissingParents = true;
	private includeIncompleteHierarchies = false;
	private directory = '';

	constructor(
		app: App,
		placeGraph: PlaceGraphService,
		options: EnrichPlaceHierarchyModalOptions = {}
	) {
		super(app);
		this.placeGraph = placeGraph;
		this.geocodingService = new GeocodingService(app);
		this.options = options;
		this.directory = options.directory || '';
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('cr-bulk-geocode-modal', 'cr-enrich-hierarchy-modal');

		// Modal title
		contentEl.createEl('h2', { text: 'Enrich place hierarchy' });

		// Load places that could benefit from hierarchy enrichment
		this.loadPlacesToEnrich();

		// Description
		const description = contentEl.createDiv({ cls: 'cr-bulk-geocode-description' });

		if (this.placesToEnrich.length === 0) {
			description.createEl('p', {
				text: 'All places already have parent places defined.',
				cls: 'cr-text-success'
			});

			new Setting(contentEl)
				.addButton(btn => btn
					.setButtonText('Close')
					.onClick(() => this.close()));

			return;
		}

		this.countText = description.createEl('p', {
			text: this.getCountText()
		});

		description.createEl('p', {
			text: 'This will geocode each place, parse the full address into hierarchy components (city → county → state → country), and create or link parent place notes.',
			cls: 'cr-text-muted cr-text-small'
		});

		// Preview list of places to enrich
		this.renderPlacePreviewList(contentEl);

		// Estimated time
		this.timeText = description.createEl('p', {
			text: this.getTimeText(),
			cls: 'cr-text-muted cr-text-small'
		});

		// Settings
		const settingsContainer = contentEl.createDiv({ cls: 'cr-enrich-settings' });

		new Setting(settingsContainer)
			.setName('Create missing parent places')
			.setDesc('Automatically create place notes for missing parents in the hierarchy')
			.addToggle(toggle => toggle
				.setValue(this.createMissingParents)
				.onChange(value => {
					this.createMissingParents = value;
				}));

		new Setting(settingsContainer)
			.setName('Include incomplete hierarchies')
			.setDesc('Re-enrich places that skip levels (e.g., city linked directly to state, missing county)')
			.addToggle(toggle => toggle
				.setValue(this.includeIncompleteHierarchies)
				.onChange(value => {
					this.includeIncompleteHierarchies = value;
					this.loadPlacesToEnrich();
					this.updatePlaceCount();
				}));

		new Setting(settingsContainer)
			.setName('Directory for new places')
			.setDesc('Where to create new parent place notes')
			.addText(text => text
				.setPlaceholder('e.g., Places')
				.setValue(this.directory)
				.onChange(value => {
					this.directory = value;
				}));

		// Progress section (hidden initially)
		this.progressContainer = contentEl.createDiv({ cls: 'cr-bulk-geocode-progress cr-hidden' });

		const progressHeader = this.progressContainer.createDiv({ cls: 'cr-progress-header' });
		this.progressText = progressHeader.createEl('span', { text: 'Starting...' });

		const progressBarContainer = this.progressContainer.createDiv({ cls: 'cr-progress-bar-container' });
		this.progressBar = progressBarContainer.createDiv({ cls: 'cr-progress-bar' });
		this.progressBar.style.width = '0%';

		// Results list (scrollable)
		this.resultsList = this.progressContainer.createDiv({ cls: 'cr-geocode-results-list' });

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will create new files and modify existing notes.'
		});

		// Buttons
		const buttonsContainer = contentEl.createDiv({ cls: 'cr-bulk-geocode-buttons' });

		new Setting(buttonsContainer)
			.addButton(btn => {
				this.cancelButton = btn.buttonEl;
				btn.setButtonText('Cancel')
					.onClick(() => {
						if (this.isRunning) {
							this.isCancelled = true;
							btn.setDisabled(true);
							btn.setButtonText('Cancelling...');
						} else {
							this.close();
						}
					});
			})
			.addButton(btn => {
				this.startButton = btn.buttonEl;
				btn.setButtonText('Start enrichment')
					.setCta()
					.onClick(() => this.startEnrichment());
			});
	}

	onClose(): void {
		// Only set cancelled if we're still running and haven't completed
		// (prevents false "cancelled" message when closing after completion)
		if (this.isRunning && !this.hasCompleted) {
			this.isCancelled = true;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load places that could benefit from hierarchy enrichment
	 * These are "real" category places without a parent_place defined,
	 * or optionally places with incomplete hierarchies (skipped levels)
	 */
	private loadPlacesToEnrich(): void {
		const allPlaces = this.placeGraph.getAllPlaces();

		// Place types that are top-level and don't need parent linking
		// Countries are obvious, but regions without parents are typically
		// sovereign nations (Taiwan, South Korea, etc.) that shouldn't be enriched
		const topLevelTypes = ['country', 'region'];

		// Filter to places without parent that are "real" category
		// (fictional/mythological places shouldn't use real-world geocoding)
		// Exclude top-level types - they don't need parent linking
		const orphanPlaces = allPlaces.filter(place =>
			!place.parentId &&
			!topLevelTypes.includes(place.placeType || '') &&
			['real', 'historical', 'disputed'].includes(place.category)
		);

		if (this.includeIncompleteHierarchies) {
			// Also include places with potentially incomplete hierarchies
			// Exclude places that already have coordinates (already enriched)
			const incompletePlaces = allPlaces.filter(place =>
				place.parentId &&
				!place.coordinates &&
				['real', 'historical', 'disputed'].includes(place.category) &&
				this.hasIncompleteHierarchy(place)
			);
			this.placesToEnrich = [...orphanPlaces, ...incompletePlaces];
		} else {
			this.placesToEnrich = orphanPlaces;
		}
	}

	/**
	 * Check if a place has an incomplete hierarchy (skips levels)
	 * For example, a city linked directly to a state (missing county)
	 */
	private hasIncompleteHierarchy(place: PlaceNode): boolean {
		if (!place.parentId) return false;

		const parent = this.placeGraph.getPlaceByCrId(place.parentId);
		if (!parent) return false;

		// Define expected parent types for each place type
		// Cities/towns should have county as parent, not state
		const cityTypes = ['city', 'town', 'village', 'municipality', 'hamlet'];
		const countyTypes = ['county', 'district'];
		const stateTypes = ['state', 'province', 'region'];

		// City/town linked to state (skipping county)
		if (place.placeType && cityTypes.includes(place.placeType)) {
			if (parent.placeType && stateTypes.includes(parent.placeType)) {
				return true;
			}
			// City linked to country (skipping county and state)
			if (parent.placeType === 'country') {
				return true;
			}
		}

		// County linked to country (skipping state)
		if (place.placeType && countyTypes.includes(place.placeType)) {
			if (parent.placeType === 'country') {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get the count text for the description
	 */
	private getCountText(): string {
		const count = this.placesToEnrich.length;
		if (this.includeIncompleteHierarchies) {
			return `Found ${count} place${count !== 1 ? 's' : ''} that could be enriched (including incomplete hierarchies).`;
		}
		return `Found ${count} place${count !== 1 ? 's' : ''} without parent places that could be enriched.`;
	}

	/**
	 * Get the estimated time text
	 */
	private getTimeText(): string {
		const estimatedMinutes = Math.ceil(this.placesToEnrich.length / 60);
		return estimatedMinutes === 1 ? 'Estimated time: about 1 minute' : `Estimated time: about ${estimatedMinutes} minutes`;
	}

	/**
	 * Update the place count display when options change
	 */
	private updatePlaceCount(): void {
		if (this.countText) {
			this.countText.textContent = this.getCountText();
		}
		if (this.timeText) {
			this.timeText.textContent = this.getTimeText();
		}
		// Also update the preview list
		this.updatePlacePreviewList();
	}

	/**
	 * Render the preview list of places to enrich
	 */
	private renderPlacePreviewList(container: HTMLElement): void {
		this.previewContainer = container.createDiv({ cls: 'cr-enrich-preview-list' });
		this.updatePlacePreviewList();
	}

	/**
	 * Update the preview list content
	 */
	private updatePlacePreviewList(): void {
		if (!this.previewContainer) return;

		this.previewContainer.empty();

		if (this.placesToEnrich.length === 0) {
			return;
		}

		// Create scrollable list
		const listEl = this.previewContainer.createDiv({ cls: 'cr-enrich-preview-items' });

		for (const place of this.placesToEnrich) {
			const item = listEl.createDiv({ cls: 'cr-enrich-preview-item' });

			const icon = item.createSpan({ cls: 'cr-enrich-preview-icon' });
			setLucideIcon(icon, 'map-pin', 14);

			const nameSpan = item.createSpan({ cls: 'cr-enrich-preview-name' });
			nameSpan.textContent = place.name;

			// Show place type if available
			if (place.placeType) {
				const typeSpan = item.createSpan({ cls: 'cr-enrich-preview-type cr-text-muted' });
				typeSpan.textContent = ` (${place.placeType})`;
			}
		}
	}

	/**
	 * Start the hierarchy enrichment process
	 */
	private async startEnrichment(): Promise<void> {
		// Guard against re-entry: don't start if already running or already completed
		// (The "Done" button triggers both original onClick and new onclick handlers)
		if (this.isRunning || this.hasCompleted) return;

		this.isRunning = true;
		this.isCancelled = false;
		this.hasCompleted = false;

		// Update UI
		if (this.startButton) {
			this.startButton.disabled = true;
			this.startButton.textContent = 'Processing...';
		}

		if (this.progressContainer) {
			this.progressContainer.removeClass('cr-hidden');
		}

		const results: HierarchyEnrichmentResult[] = [];
		let enrichedCount = 0;
		let parentsCreatedCount = 0;
		let failedCount = 0;
		let skippedCount = 0;
		let cancelledCount = 0;

		const total = this.placesToEnrich.length;

		for (let i = 0; i < total; i++) {
			// Check for cancellation
			if (this.isCancelled) {
				cancelledCount = total - i;
				break;
			}

			const place = this.placesToEnrich[i];
			const result = await this.enrichPlaceHierarchy(place);
			results.push(result);

			if (result.success) {
				enrichedCount++;
				parentsCreatedCount += result.parentsCreated?.length || 0;
			} else if (result.skipped) {
				skippedCount++;
			} else {
				failedCount++;
			}

			this.updateProgress(i + 1, total, result);
		}

		const summary: BulkHierarchyEnrichmentResult = {
			total,
			enriched: enrichedCount,
			parentsCreated: parentsCreatedCount,
			failed: failedCount,
			skipped: skippedCount,
			cancelled: cancelledCount,
			results
		};

		this.hasCompleted = true;
		this.showCompletion(summary);
		this.options.onComplete?.(summary);
		this.isRunning = false;
	}

	/**
	 * Enrich hierarchy for a single place
	 */
	private async enrichPlaceHierarchy(place: PlaceNode): Promise<HierarchyEnrichmentResult> {
		const result: HierarchyEnrichmentResult = {
			placeName: place.name,
			success: false
		};

		try {
			// Build search query - use existing parent if available for better accuracy
			let searchQuery = place.name;
			if (place.parentId) {
				const parent = this.placeGraph.getPlaceByCrId(place.parentId);
				if (parent) {
					searchQuery = `${place.name}, ${parent.name}`;
				}
			}

			// Geocode the place with detailed address info
			const geocodeResult = await this.geocodingService.geocodeWithDetails(searchQuery);

			if (!geocodeResult.success || !geocodeResult.addressComponents) {
				result.error = geocodeResult.error || 'No address components found';
				return result;
			}

			// Parse hierarchy from address components
			const hierarchy = this.parseHierarchyFromAddress(geocodeResult.addressComponents, place.name);
			result.hierarchy = hierarchy;

			// Check if this place IS a country (top-level, no parent needed)
			const isCountry = geocodeResult.addressComponents.country?.toLowerCase() === place.name.toLowerCase();

			if (hierarchy.length === 0) {
				if (isCountry) {
					// Countries are top-level - just update coordinates, no parent needed
					const file = this.app.vault.getAbstractFileByPath(place.filePath);
					if (file instanceof TFile) {
						await updatePlaceNote(this.app, file, {
							placeType: 'country',
							coordinates: geocodeResult.coordinates
						});
					}
					result.success = true;
					result.parentsCreated = [];
					result.parentLinked = '(top-level country)';
					return result;
				}
				result.error = 'Could not parse hierarchy from geocoding result';
				return result;
			}

			// Find or create parent places and link them
			const { parentId, parentsCreated } = await this.findOrCreateParentChain(
				hierarchy,
				place,
				geocodeResult.addressComponents
			);

			if (parentId) {
				// Update the original place to link to its parent
				const file = this.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					const parentPlace = this.placeGraph.getPlaceByCrId(parentId);
					await updatePlaceNote(this.app, file, {
						parentPlace: parentPlace?.name,
						parentPlaceId: parentId,
						// Also update coordinates if we got them
						coordinates: geocodeResult.coordinates
					});
				}

				result.success = true;
				result.parentsCreated = parentsCreated;
				result.parentLinked = this.placeGraph.getPlaceByCrId(parentId)?.name;
			} else {
				result.error = 'Could not establish parent chain';
			}

		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Unknown error';
		}

		return result;
	}

	/**
	 * Parse hierarchy from Nominatim address components
	 * Returns array from most specific to least specific (excluding the place itself)
	 */
	private parseHierarchyFromAddress(
		addressComponents: Record<string, string>,
		placeName: string
	): string[] {
		const hierarchy: string[] = [];

		// Order of address components from most specific to least
		const componentOrder = [
			'city', 'town', 'village', 'municipality', 'hamlet',
			'county', 'district', 'suburb',
			'state', 'province', 'region',
			'country'
		];

		// Track what we've added to avoid duplicates
		const added = new Set<string>();
		added.add(placeName.toLowerCase()); // Don't include the place itself

		for (const component of componentOrder) {
			const value = addressComponents[component];
			if (value && !added.has(value.toLowerCase())) {
				hierarchy.push(value);
				added.add(value.toLowerCase());
			}
		}

		return hierarchy;
	}

	/**
	 * Find or create the parent chain for a place
	 * Returns the cr_id of the immediate parent
	 */
	private async findOrCreateParentChain(
		hierarchy: string[],
		place: PlaceNode,
		addressComponents: Record<string, string>
	): Promise<{ parentId: string | undefined; parentsCreated: string[] }> {
		const parentsCreated: string[] = [];
		let childId: string | undefined;

		// Work backwards from country to most specific parent
		// This ensures each place has its parent created before it
		const reversedHierarchy = [...hierarchy].reverse();

		for (let i = 0; i < reversedHierarchy.length; i++) {
			const name = reversedHierarchy[i];
			const isImmediateParent = i === reversedHierarchy.length - 1;

			// Try to find existing place with this name
			let existingPlace = this.findPlaceByName(name);

			if (!existingPlace && this.createMissingParents) {
				// Determine place type from address components
				const placeType = this.inferPlaceType(name, addressComponents);

				// Create the place
				const placeData: PlaceData = {
					name,
					placeType,
					// Link to previously created parent if we have one
					parentPlaceId: childId,
					parentPlace: childId ? this.placeGraph.getPlaceByCrId(childId)?.name : undefined
				};

				try {
					const file = await createPlaceNote(this.app, placeData, {
						directory: this.directory,
						openAfterCreate: false
					});

					// Get the cr_id from the created file
					const cache = this.app.metadataCache.getFileCache(file);
					const newCrId = cache?.frontmatter?.cr_id;

					if (newCrId) {
						parentsCreated.push(name);

						// Refresh the place graph to include the new place
						this.placeGraph.reloadCache();

						existingPlace = this.placeGraph.getPlaceByCrId(newCrId);
						childId = newCrId;
					}
				} catch (error) {
					console.error(`Failed to create place "${name}":`, error);
				}
			} else if (existingPlace) {
				childId = existingPlace.id;
			}

			// Return the immediate parent's ID
			if (isImmediateParent && existingPlace) {
				return { parentId: existingPlace.id, parentsCreated };
			}
		}

		// Return the most specific parent we found/created
		return { parentId: childId, parentsCreated };
	}

	/**
	 * Find an existing place by name
	 */
	private findPlaceByName(name: string): PlaceNode | undefined {
		const allPlaces = this.placeGraph.getAllPlaces();
		const nameLower = name.toLowerCase();

		return allPlaces.find(p =>
			p.name.toLowerCase() === nameLower ||
			p.aliases.some(a => a.toLowerCase() === nameLower)
		);
	}

	/**
	 * Infer place type from address components
	 */
	private inferPlaceType(name: string, addressComponents: Record<string, string>): PlaceType | undefined {
		// Check which component matches this name
		for (const [component, value] of Object.entries(addressComponents)) {
			if (value.toLowerCase() === name.toLowerCase()) {
				return OSM_TYPE_MAP[component];
			}
		}
		return undefined;
	}

	/**
	 * Update progress display
	 */
	private updateProgress(current: number, total: number, result: HierarchyEnrichmentResult): void {
		const percent = Math.round((current / total) * 100);

		if (this.progressBar) {
			this.progressBar.style.width = `${percent}%`;
		}

		if (this.progressText) {
			this.progressText.textContent = `Processing ${current} of ${total} (${percent}%)`;
		}

		if (this.resultsList) {
			const item = this.resultsList.createDiv({ cls: 'cr-geocode-result-item' });

			const icon = item.createSpan({ cls: 'cr-geocode-result-icon' });
			if (result.success) {
				setLucideIcon(icon, 'check', 14);
				icon.addClass('cr-text-success');
			} else if (result.skipped) {
				setLucideIcon(icon, 'minus', 14);
				icon.addClass('cr-text-muted');
			} else {
				setLucideIcon(icon, 'x', 14);
				icon.addClass('cr-text-warning');
			}

			const text = item.createSpan({ cls: 'cr-geocode-result-text' });
			text.textContent = result.placeName;

			if (result.success && result.parentLinked) {
				const detail = item.createSpan({ cls: 'cr-geocode-result-coords cr-text-muted' });
				const createdText = result.parentsCreated && result.parentsCreated.length > 0
					? ` (created ${result.parentsCreated.length} parent${result.parentsCreated.length !== 1 ? 's' : ''})`
					: '';
				detail.textContent = ` → ${result.parentLinked}${createdText}`;
			} else if (result.error) {
				const error = item.createSpan({ cls: 'cr-geocode-result-error cr-text-warning' });
				error.textContent = ` - ${result.error}`;
			}

			// Auto-scroll to bottom
			this.resultsList.scrollTop = this.resultsList.scrollHeight;
		}
	}

	/**
	 * Show completion summary
	 */
	private showCompletion(result: BulkHierarchyEnrichmentResult): void {
		// Check if user actually cancelled (cancelled count > 0 means we broke out of the loop early)
		const wasActuallyCancelled = result.cancelled > 0;
		const processedCount = result.enriched + result.failed + result.skipped;

		if (this.progressText) {
			if (wasActuallyCancelled) {
				this.progressText.textContent = `Cancelled. Processed ${processedCount} of ${result.total}.`;
			} else {
				this.progressText.textContent = 'Complete!';
			}
		}

		if (this.startButton) {
			this.startButton.textContent = 'Done';
			this.startButton.disabled = false;
			this.startButton.onclick = () => this.close();
		}

		if (this.cancelButton) {
			this.cancelButton.style.display = 'none';
		}

		// Show summary notice
		let message: string;
		if (wasActuallyCancelled) {
			message = `Enrichment cancelled. Enriched ${result.enriched} places, created ${result.parentsCreated} parent notes.`;
		} else {
			message = `Enrichment complete! Enriched ${result.enriched} places, created ${result.parentsCreated} parent notes. ${result.failed} failed.`;
		}

		new Notice(message, 5000);
	}
}
