/**
 * Bulk Media Link Modal
 *
 * Allows users to bulk link media files to entities that don't have media.
 * Supports all entity types: Person, Event, Place, Organization, Source.
 *
 * Workflow:
 * 1. Select entity type
 * 2. View entities without media
 * 3. Select entities to link
 * 4. Pick media files to link
 * 5. Execute bulk linking
 */

import { App, Modal, TFile, setIcon, Notice, Setting } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { MediaService, type MediaEntityType } from '../media-service';
import { MediaPickerModal } from './media-picker-modal';
import { BulkMediaLinkProgressModal } from './bulk-media-link-progress-modal';
import { FamilyGraphService, type PersonNode } from '../family-graph';
import { PlaceGraphService } from '../place-graph';
import { FolderFilterService } from '../folder-filter';
import { EventService } from '../../events/services/event-service';
import type { EventNote } from '../../events/types/event-types';
import { OrganizationService } from '../../organizations/services/organization-service';
import { getOrganizationType } from '../../organizations/constants/organization-types';
import { SourceService } from '../../sources/services/source-service';

/**
 * Entity item for display in the modal
 */
interface EntityItem {
	/** Unique identifier */
	crId: string;
	/** Display name */
	name: string;
	/** Entity file */
	file: TFile;
	/** Whether this entity is selected for linking */
	isSelected: boolean;
	/** Secondary info (type, date, etc.) */
	subtitle?: string;
}

/**
 * Entity type configuration
 */
interface EntityTypeConfig {
	value: MediaEntityType;
	label: string;
	icon: string;
}

const ENTITY_TYPES: EntityTypeConfig[] = [
	{ value: 'person', label: 'People', icon: 'user' },
	{ value: 'event', label: 'Events', icon: 'calendar' },
	{ value: 'place', label: 'Places', icon: 'map-pin' },
	{ value: 'organization', label: 'Organizations', icon: 'building' },
	{ value: 'source', label: 'Sources', icon: 'book-open' }
];

/**
 * Bulk Media Link Modal
 */
export class BulkMediaLinkModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private mediaService: MediaService;

	// Current state
	private selectedEntityType: MediaEntityType = 'person';
	private entities: EntityItem[] = [];
	private selectedEntities: Set<string> = new Set();
	private preselectedFiles: TFile[] = [];

	// UI elements
	private entityTypeSelect!: HTMLSelectElement;
	private entityListContainer!: HTMLElement;
	private selectionCountEl!: HTMLElement;
	private linkButton!: HTMLButtonElement;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
		this.mediaService = new MediaService(app, plugin.settings);
	}

	/**
	 * Set preselected media files (used when coming from Find Unlinked)
	 */
	setPreselectedFiles(files: TFile[]): void {
		this.preselectedFiles = files;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-bulk-media-link-modal');

		this.createModalContent();
		this.loadEntities();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Create the modal content
	 */
	private createModalContent(): void {
		const { contentEl } = this;

		// Header
		const header = contentEl.createDiv({ cls: 'crc-picker-header' });
		const titleSection = header.createDiv({ cls: 'crc-picker-title' });
		const icon = titleSection.createSpan();
		setIcon(icon, 'image-plus');
		titleSection.appendText('Bulk link media');

		// Show different subtitle when files are preselected
		const subtitleText = this.preselectedFiles.length > 0
			? `Link ${this.preselectedFiles.length} selected file(s) to entities`
			: 'Link media files to multiple entities at once';

		header.createDiv({
			cls: 'crc-picker-subtitle',
			text: subtitleText
		});

		// Entity type selector
		const selectorSection = contentEl.createDiv({ cls: 'crc-bulk-media-selector' });

		new Setting(selectorSection)
			.setName('Entity type')
			.setDesc('Select the type of entities to link media to')
			.addDropdown(dropdown => {
				this.entityTypeSelect = dropdown.selectEl;
				ENTITY_TYPES.forEach(type => {
					dropdown.addOption(type.value, type.label);
				});
				dropdown.setValue(this.selectedEntityType);
				dropdown.onChange(value => {
					this.selectedEntityType = value as MediaEntityType;
					this.selectedEntities.clear();
					this.loadEntities();
				});
			});

		// Instructions
		const instructions = contentEl.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		instructions.createEl('p', {
			text: 'Select entities without media, then choose media files to link to them.',
			cls: 'crc-text--small'
		});

		// Select all / Deselect all buttons
		const bulkActions = contentEl.createDiv({ cls: 'crc-bulk-media-actions' });

		const selectAllBtn = bulkActions.createEl('button', {
			cls: 'crc-btn crc-btn--small',
			text: 'Select all'
		});
		selectAllBtn.addEventListener('click', () => this.selectAll());

		const deselectAllBtn = bulkActions.createEl('button', {
			cls: 'crc-btn crc-btn--small',
			text: 'Deselect all'
		});
		deselectAllBtn.addEventListener('click', () => this.deselectAll());

		// Entity list container
		this.entityListContainer = contentEl.createDiv({ cls: 'crc-bulk-media-list' });

		// Footer with selection count and action buttons
		const footer = contentEl.createDiv({ cls: 'crc-picker-footer crc-picker-footer--spaced' });

		this.selectionCountEl = footer.createDiv({ cls: 'crc-picker-selection-count' });

		const footerButtons = footer.createDiv({ cls: 'crc-picker-footer__buttons' });

		const cancelBtn = footerButtons.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		this.linkButton = footerButtons.createEl('button', {
			cls: 'mod-cta',
			text: 'Link media to selected...'
		});
		this.linkButton.disabled = true;
		this.linkButton.addEventListener('click', () => this.openMediaPicker());

		this.updateSelectionCount();
	}

	/**
	 * Load entities without media for the selected type
	 */
	private loadEntities(): void {
		this.entities = [];

		switch (this.selectedEntityType) {
			case 'person':
				this.loadPeople();
				break;
			case 'event':
				this.loadEvents();
				break;
			case 'place':
				this.loadPlaces();
				break;
			case 'organization':
				this.loadOrganizations();
				break;
			case 'source':
				this.loadSources();
				break;
		}

		this.renderEntityList();
		this.updateSelectionCount();
	}

	/**
	 * Load people without media
	 */
	private loadPeople(): void {
		const folderFilter = new FolderFilterService(this.plugin.settings);
		const familyGraph = new FamilyGraphService(this.app);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);
		familyGraph.ensureCacheLoaded();

		const people = familyGraph.getAllPeople();
		const peopleWithoutMedia = people.filter(p => !p.media || p.media.length === 0);

		this.entities = peopleWithoutMedia.map(p => ({
			crId: p.crId,
			name: p.name,
			file: p.file,
			isSelected: false,
			subtitle: this.formatPersonSubtitle(p)
		}));
	}

	/**
	 * Load events without media
	 */
	private loadEvents(): void {
		const eventService = new EventService(this.app, this.plugin.settings);

		const events = eventService.getAllEvents();
		const eventsWithoutMedia = events.filter(e => !e.media || e.media.length === 0);

		this.entities = eventsWithoutMedia.map(e => ({
			crId: e.crId,
			name: e.title,
			file: e.file,
			isSelected: false,
			subtitle: this.formatEventSubtitle(e)
		}));
	}

	/**
	 * Load places without media
	 */
	private loadPlaces(): void {
		const folderFilter = new FolderFilterService(this.plugin.settings);
		const placeGraph = new PlaceGraphService(this.app);
		placeGraph.setSettings(this.plugin.settings);
		placeGraph.setFolderFilter(folderFilter);

		const places = placeGraph.getAllPlaces();
		const placesWithoutMedia = places.filter(p => !p.media || p.media.length === 0);

		this.entities = placesWithoutMedia
			.map(p => {
				const file = this.app.vault.getAbstractFileByPath(p.filePath);
				if (!(file instanceof TFile)) return null;
				const entity: EntityItem = {
					crId: p.id,
					name: p.name,
					file,
					isSelected: false,
					subtitle: p.placeType || p.category
				};
				return entity;
			})
			.filter((e): e is EntityItem => e !== null);
	}

	/**
	 * Load organizations without media
	 */
	private loadOrganizations(): void {
		const orgService = new OrganizationService(this.plugin);

		const orgs = orgService.getAllOrganizations();
		const orgsWithoutMedia = orgs.filter(o => !o.media || o.media.length === 0);

		this.entities = orgsWithoutMedia.map(o => {
			const typeDef = getOrganizationType(o.orgType);
			return {
				crId: o.crId,
				name: o.name,
				file: o.file,
				isSelected: false,
				subtitle: typeDef?.name || o.orgType || 'Organization'
			};
		});
	}

	/**
	 * Load sources without media
	 */
	private loadSources(): void {
		const sourceService = new SourceService(this.app, this.plugin.settings);

		const sources = sourceService.getAllSources();
		const sourcesWithoutMedia = sources.filter(s => s.media.length === 0);

		this.entities = sourcesWithoutMedia
			.map(s => {
				const file = this.app.vault.getAbstractFileByPath(s.filePath);
				if (!(file instanceof TFile)) return null;
				const entity: EntityItem = {
					crId: s.crId,
					name: s.title,
					file,
					isSelected: false,
					subtitle: s.sourceType || 'Source'
				};
				return entity;
			})
			.filter((e): e is EntityItem => e !== null);
	}

	/**
	 * Format person subtitle (dates, etc.)
	 */
	private formatPersonSubtitle(person: PersonNode): string {
		const parts: string[] = [];
		if (person.birthDate) parts.push(`b. ${person.birthDate}`);
		if (person.deathDate) parts.push(`d. ${person.deathDate}`);
		return parts.length > 0 ? parts.join(' · ') : '';
	}

	/**
	 * Format event subtitle (type, date)
	 */
	private formatEventSubtitle(event: EventNote): string {
		const parts: string[] = [];
		if (event.eventType) parts.push(event.eventType);
		if (event.date) parts.push(event.date);
		return parts.length > 0 ? parts.join(' · ') : '';
	}

	/**
	 * Render the entity list
	 */
	private renderEntityList(): void {
		this.entityListContainer.empty();

		if (this.entities.length === 0) {
			this.renderEmptyState();
			return;
		}

		// Sort alphabetically by name
		const sortedEntities = [...this.entities].sort((a, b) =>
			a.name.localeCompare(b.name)
		);

		for (const entity of sortedEntities) {
			this.renderEntityRow(entity);
		}
	}

	/**
	 * Render empty state when no entities without media
	 */
	private renderEmptyState(): void {
		const emptyState = this.entityListContainer.createDiv({ cls: 'crc-picker-empty' });
		const emptyIcon = emptyState.createSpan();
		setIcon(emptyIcon, 'check-circle');

		const typeConfig = ENTITY_TYPES.find(t => t.value === this.selectedEntityType);
		const typeName = typeConfig?.label.toLowerCase() || 'entities';

		emptyState.createEl('p', { text: `All ${typeName} have media linked` });
		emptyState.createEl('p', {
			text: 'Great job! There are no entities that need media.',
			cls: 'crc-text-muted'
		});
	}

	/**
	 * Render a single entity row
	 */
	private renderEntityRow(entity: EntityItem): void {
		const row = this.entityListContainer.createDiv({
			cls: `crc-bulk-media-row ${entity.isSelected ? 'crc-bulk-media-row--selected' : ''}`
		});

		// Checkbox
		const checkbox = row.createEl('input', {
			type: 'checkbox',
			cls: 'crc-bulk-media-row__checkbox'
		});
		checkbox.checked = this.selectedEntities.has(entity.crId);

		checkbox.addEventListener('change', () => {
			this.toggleEntitySelection(entity, checkbox.checked);
			row.toggleClass('crc-bulk-media-row--selected', checkbox.checked);
		});

		// Icon
		const typeConfig = ENTITY_TYPES.find(t => t.value === this.selectedEntityType);
		const iconEl = row.createDiv({ cls: 'crc-bulk-media-row__icon' });
		setIcon(iconEl, typeConfig?.icon || 'file');

		// Info
		const info = row.createDiv({ cls: 'crc-bulk-media-row__info' });
		info.createDiv({ cls: 'crc-bulk-media-row__name', text: entity.name });
		if (entity.subtitle) {
			info.createDiv({ cls: 'crc-bulk-media-row__subtitle', text: entity.subtitle });
		}

		// Make row clickable (excluding checkbox)
		row.addEventListener('click', (e) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
				this.toggleEntitySelection(entity, checkbox.checked);
				row.toggleClass('crc-bulk-media-row--selected', checkbox.checked);
			}
		});
	}

	/**
	 * Toggle entity selection
	 */
	private toggleEntitySelection(entity: EntityItem, selected: boolean): void {
		if (selected) {
			this.selectedEntities.add(entity.crId);
		} else {
			this.selectedEntities.delete(entity.crId);
		}
		this.updateSelectionCount();
	}

	/**
	 * Select all entities
	 */
	private selectAll(): void {
		for (const entity of this.entities) {
			this.selectedEntities.add(entity.crId);
		}
		this.renderEntityList();
		this.updateSelectionCount();
	}

	/**
	 * Deselect all entities
	 */
	private deselectAll(): void {
		this.selectedEntities.clear();
		this.renderEntityList();
		this.updateSelectionCount();
	}

	/**
	 * Update selection count display
	 */
	private updateSelectionCount(): void {
		const count = this.selectedEntities.size;
		const total = this.entities.length;

		this.selectionCountEl.setText(`${count} of ${total} selected`);
		this.linkButton.disabled = count === 0;
	}

	/**
	 * Open media picker to select files to link
	 */
	private openMediaPicker(): void {
		const selectedCount = this.selectedEntities.size;
		const typeConfig = ENTITY_TYPES.find(t => t.value === this.selectedEntityType);
		const typeName = typeConfig?.label.toLowerCase() || 'entities';

		// If we have preselected files, use them directly
		if (this.preselectedFiles.length > 0) {
			void this.linkMediaToEntities(this.preselectedFiles);
			return;
		}

		new MediaPickerModal(
			this.app,
			this.mediaService,
			(files) => { void this.linkMediaToEntities(files); },
			{
				title: 'Select media to link',
				subtitle: `Will be linked to ${selectedCount} ${typeName}`,
				multiSelect: true
			}
		).open();
	}

	/**
	 * Link selected media files to selected entities
	 */
	private async linkMediaToEntities(files: TFile[]): Promise<void> {
		if (files.length === 0) return;

		const selectedEntities = this.entities.filter(e => this.selectedEntities.has(e.crId));
		if (selectedEntities.length === 0) return;

		// For small operations (< 5 entities), skip the progress modal
		const showProgress = selectedEntities.length >= 5;

		let progressModal: BulkMediaLinkProgressModal | null = null;
		if (showProgress) {
			progressModal = new BulkMediaLinkProgressModal(this.app, files.length);
			progressModal.open();
		}

		let successCount = 0;
		let errorCount = 0;

		for (let i = 0; i < selectedEntities.length; i++) {
			const entity = selectedEntities[i];

			// Check for cancellation
			if (progressModal?.wasCancelled()) {
				break;
			}

			// Update progress
			if (progressModal) {
				progressModal.updateProgress({
					current: i + 1,
					total: selectedEntities.length,
					currentEntityName: entity.name
				});
			}

			try {
				for (const file of files) {
					const wikilink = this.mediaService.pathToWikilink(file.path);
					await this.mediaService.addMediaToEntity(entity.file, wikilink);
				}
				successCount++;
				progressModal?.recordSuccess();
			} catch (error) {
				console.error(`Failed to link media to ${entity.name}:`, error);
				errorCount++;
				progressModal?.recordError();
			}

			// Small delay to allow UI updates and prevent blocking
			if (showProgress && i % 10 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}

		// Mark complete and show results
		if (progressModal) {
			progressModal.markComplete();
		} else {
			// Show result notification for small operations
			if (errorCount === 0) {
				new Notice(`Linked ${files.length} media file(s) to ${successCount} entities`);
			} else {
				new Notice(`Linked media to ${successCount} entities, ${errorCount} failed`);
			}
		}

		// Refresh the list
		this.selectedEntities.clear();
		this.loadEntities();
	}
}
