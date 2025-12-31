/**
 * Media Manager Modal
 *
 * Central hub for all media operations in Canvas Roots.
 * Provides quick access to:
 * - Browse Gallery (unified view of all linked media)
 * - Bulk Link Media (link to multiple entities)
 * - Find Unlinked (discover orphaned media files)
 * - Source Media Linker (smart source-image matching)
 */

import { App, Modal, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { MediaService, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, PDF_EXTENSIONS, DOCUMENT_EXTENSIONS } from '../media-service';
import { BulkMediaLinkModal } from './bulk-media-link-modal';
import { MediaGalleryModal } from './media-gallery-modal';
import { UnlinkedMediaModal } from './unlinked-media-modal';
import { SourceMediaLinkerModal } from '../../sources/ui/source-media-linker';
import { MediaUploadModal } from './media-upload-modal';
import { MediaPickerModal } from './media-picker-modal';
import { EntityPickerModal } from './entity-picker-modal';
import { FamilyGraphService } from '../family-graph';
import { PlaceGraphService } from '../place-graph';
import { EventService } from '../../events/services/event-service';
import { OrganizationService } from '../../organizations/services/organization-service';
import { SourceService } from '../../sources/services/source-service';
import { FolderFilterService } from '../folder-filter';

/**
 * All supported media extensions
 */
const ALL_MEDIA_EXTENSIONS = [
	...IMAGE_EXTENSIONS,
	...VIDEO_EXTENSIONS,
	...AUDIO_EXTENSIONS,
	...PDF_EXTENSIONS,
	...DOCUMENT_EXTENSIONS
];

/**
 * Stats about media in the vault
 */
interface MediaStats {
	totalMediaFiles: number;
	linkedFiles: number;
	unlinkedFiles: number;
	entitiesWithoutMedia: number;
	sourcesToReview: number;
}

/**
 * Media Manager Modal
 */
export class MediaManagerModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private stats: MediaStats | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-media-manager-modal');

		// Calculate stats in background
		this.calculateStats();

		this.renderContent();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Calculate media statistics
	 */
	private calculateStats(): void {
		const mediaService = new MediaService(this.app, this.plugin.settings);

		// Count total media files in vault (applying media folder filter if enabled)
		const allFiles = this.app.vault.getFiles();
		const mediaFiles = allFiles.filter(f => {
			const ext = '.' + f.extension.toLowerCase();
			if (!ALL_MEDIA_EXTENSIONS.includes(ext)) return false;
			// Apply media folder filter
			if (!this.isInMediaFolders(f.path)) return false;
			return true;
		});
		const totalMediaFiles = mediaFiles.length;

		// Get all linked media paths
		const linkedPaths = new Set<string>();

		// People
		const folderFilter = new FolderFilterService(this.plugin.settings);
		const familyGraph = new FamilyGraphService(this.app);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();
		let entitiesWithoutMedia = 0;

		for (const person of people) {
			if (person.media && person.media.length > 0) {
				for (const ref of person.media) {
					const item = mediaService.resolveMediaItem(ref);
					if (item.file) linkedPaths.add(item.file.path);
				}
			} else {
				entitiesWithoutMedia++;
			}
		}

		// Events
		const eventService = new EventService(this.app, this.plugin.settings);
		const events = eventService.getAllEvents();
		for (const event of events) {
			if (event.media && event.media.length > 0) {
				for (const ref of event.media) {
					const item = mediaService.resolveMediaItem(ref);
					if (item.file) linkedPaths.add(item.file.path);
				}
			} else {
				entitiesWithoutMedia++;
			}
		}

		// Places
		const placeGraph = new PlaceGraphService(this.app);
		placeGraph.setSettings(this.plugin.settings);
		placeGraph.setFolderFilter(folderFilter);
		const places = placeGraph.getAllPlaces();
		for (const place of places) {
			if (place.media && place.media.length > 0) {
				for (const ref of place.media) {
					const item = mediaService.resolveMediaItem(ref);
					if (item.file) linkedPaths.add(item.file.path);
				}
			} else {
				entitiesWithoutMedia++;
			}
		}

		// Organizations
		const orgService = new OrganizationService(this.plugin);
		const orgs = orgService.getAllOrganizations();
		for (const org of orgs) {
			if (org.media && org.media.length > 0) {
				for (const ref of org.media) {
					const item = mediaService.resolveMediaItem(ref);
					if (item.file) linkedPaths.add(item.file.path);
				}
			} else {
				entitiesWithoutMedia++;
			}
		}

		// Sources
		const sourceService = new SourceService(this.app, this.plugin.settings);
		const sources = sourceService.getAllSources();
		let sourcesToReview = 0;
		for (const source of sources) {
			if (source.media && source.media.length > 0) {
				for (const ref of source.media) {
					const item = mediaService.resolveMediaItem(ref);
					if (item.file) linkedPaths.add(item.file.path);
				}
			} else {
				sourcesToReview++;
			}
		}

		this.stats = {
			totalMediaFiles,
			linkedFiles: linkedPaths.size,
			unlinkedFiles: totalMediaFiles - linkedPaths.size,
			entitiesWithoutMedia,
			sourcesToReview
		};

		// Re-render with stats
		this.renderContent();
	}

	/**
	 * Render the modal content
	 */
	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createDiv({ cls: 'crc-media-manager-header' });
		const headerIcon = header.createDiv({ cls: 'crc-media-manager-header-icon' });
		setIcon(headerIcon, 'image');
		header.createEl('h2', { text: 'Media Manager' });

		// Action cards grid (6 tiles in 3×2 layout)
		const grid = contentEl.createDiv({ cls: 'crc-media-manager-grid' });

		// Row 1: Browse & Discover

		// Linked Media Gallery card
		this.renderActionCard(grid, {
			icon: 'layout-grid',
			iconClass: 'gallery',
			title: 'Linked Media Gallery',
			description: 'View media files linked to entities. Filter by entity type, search by name.',
			stat: this.stats ? `${this.stats.linkedFiles} linked files` : 'Loading...',
			onClick: () => this.openBrowseGallery()
		});

		// Find Unlinked card
		this.renderActionCard(grid, {
			icon: 'unlink',
			iconClass: 'unlinked',
			title: 'Find Unlinked',
			description: 'Discover media files in your vault that aren\'t linked to any entity.',
			stat: this.stats ? `${this.stats.unlinkedFiles} orphaned files` : 'Loading...',
			onClick: () => this.openFindUnlinked()
		});

		// Source Media Linker card
		this.renderActionCard(grid, {
			icon: 'file-image',
			iconClass: 'sources',
			title: 'Source Media Linker',
			description: 'Smart matching to link images to sources by filename patterns.',
			stat: this.stats ? `${this.stats.sourcesToReview} sources to review` : 'Loading...',
			onClick: () => this.openSourceMediaLinker()
		});

		// Row 2: Add & Link Operations

		// Upload Media card (NEW)
		this.renderActionCard(grid, {
			icon: 'upload',
			iconClass: 'upload',
			title: 'Upload Media',
			description: 'Upload files to your vault and optionally link them to entities.',
			stat: this.stats ? `Upload to ${this.getUploadDestination()}` : 'Loading...',
			onClick: () => this.openUploadMedia()
		});

		// Link Media card (NEW - MediaPickerModal in media-first mode)
		this.renderActionCard(grid, {
			icon: 'link',
			iconClass: 'link',
			title: 'Link Media',
			description: 'Select media files from your vault, then choose entities to link them to.',
			stat: this.stats ? `${this.stats.totalMediaFiles} files available` : 'Loading...',
			onClick: () => this.openLinkMedia()
		});

		// Bulk Link to Entities card (renamed from "Bulk Link Media")
		this.renderActionCard(grid, {
			icon: 'layers',
			iconClass: 'bulk',
			title: 'Bulk Link to Entities',
			description: 'Select multiple entities, then choose media files to link to all of them.',
			stat: this.stats ? `${this.stats.entitiesWithoutMedia} entities without media` : 'Loading...',
			onClick: () => this.openBulkLinkMedia()
		});

		// Stats bar
		if (this.stats) {
			const statsBar = contentEl.createDiv({ cls: 'crc-media-manager-stats' });

			this.renderStatItem(statsBar, this.stats.totalMediaFiles.toString(), 'Total files');
			this.renderStatDivider(statsBar);
			this.renderStatItem(statsBar, this.stats.linkedFiles.toString(), 'Linked');
			this.renderStatDivider(statsBar);
			this.renderStatItem(statsBar, this.stats.unlinkedFiles.toString(), 'Unlinked');
			this.renderStatDivider(statsBar);

			const coverage = this.stats.totalMediaFiles > 0
				? Math.round((this.stats.linkedFiles / this.stats.totalMediaFiles) * 100)
				: 0;
			this.renderStatItem(statsBar, `${coverage}%`, 'Coverage');
		}
	}

	/**
	 * Render an action card
	 */
	private renderActionCard(
		container: HTMLElement,
		config: {
			icon: string;
			iconClass: string;
			title: string;
			description: string;
			stat: string;
			onClick: () => void;
		}
	): void {
		const card = container.createDiv({ cls: 'crc-media-manager-card' });

		const cardHeader = card.createDiv({ cls: 'crc-media-manager-card-header' });
		const iconEl = cardHeader.createDiv({ cls: `crc-media-manager-card-icon crc-media-manager-card-icon--${config.iconClass}` });
		setIcon(iconEl, config.icon);
		cardHeader.createDiv({ cls: 'crc-media-manager-card-title', text: config.title });

		card.createDiv({ cls: 'crc-media-manager-card-description', text: config.description });

		const statEl = card.createDiv({ cls: 'crc-media-manager-card-stat' });
		statEl.textContent = config.stat;

		card.addEventListener('click', config.onClick);
	}

	/**
	 * Render a stat item in the stats bar
	 */
	private renderStatItem(container: HTMLElement, value: string, label: string): void {
		const item = container.createDiv({ cls: 'crc-media-manager-stat-item' });
		item.createDiv({ cls: 'crc-media-manager-stat-value', text: value });
		item.createDiv({ cls: 'crc-media-manager-stat-label', text: label });
	}

	/**
	 * Render a divider in the stats bar
	 */
	private renderStatDivider(container: HTMLElement): void {
		container.createDiv({ cls: 'crc-media-manager-stat-divider' });
	}

	/**
	 * Open Browse Gallery
	 */
	private openBrowseGallery(): void {
		this.close();
		new MediaGalleryModal(this.app, this.plugin).open();
	}

	/**
	 * Open Bulk Link Media modal
	 */
	private openBulkLinkMedia(): void {
		this.close();
		new BulkMediaLinkModal(this.app, this.plugin).open();
	}

	/**
	 * Open Find Unlinked modal
	 */
	private openFindUnlinked(): void {
		this.close();
		new UnlinkedMediaModal(this.app, this.plugin).open();
	}

	/**
	 * Open Source Media Linker modal
	 */
	private openSourceMediaLinker(): void {
		this.close();
		new SourceMediaLinkerModal(this.app, this.plugin).open();
	}

	/**
	 * Open Upload Media modal
	 */
	private openUploadMedia(): void {
		this.close();
		new MediaUploadModal(this.app, this.plugin).open();
	}

	/**
	 * Open Link Media flow - MediaPickerModal in media-first mode
	 */
	private openLinkMedia(): void {
		this.close();
		const mediaService = new MediaService(this.app, this.plugin.settings);
		new MediaPickerModal(
			this.app,
			mediaService,
			(files) => {
				if (files.length > 0) {
					// Open EntityPickerModal with the selected files
					new EntityPickerModal(this.app, this.plugin, files).open();
				}
			},
			{
				title: 'Select media to link',
				subtitle: 'Choose media files, then select entities to link them to',
				multiSelect: true
			},
			this.plugin
		).open();
	}

	/**
	 * Get the upload destination folder name
	 */
	private getUploadDestination(): string {
		const { mediaFolders } = this.plugin.settings;
		if (mediaFolders.length === 0) {
			return 'Not configured';
		}
		// Show just the folder name, not full path
		const firstFolder = mediaFolders[0];
		const parts = firstFolder.split('/');
		return parts[parts.length - 1] || firstFolder;
	}

	/**
	 * Check if a file path is within the configured media folders.
	 * Returns true if filter is disabled, folders are empty, or file is in a media folder.
	 */
	private isInMediaFolders(filePath: string): boolean {
		const { enableMediaFolderFilter, mediaFolders } = this.plugin.settings;

		// If filter is disabled or no folders configured, accept all files
		if (!enableMediaFolderFilter || mediaFolders.length === 0) {
			return true;
		}

		// Check if file is in any of the configured folders
		return mediaFolders.some(folder => {
			const normalizedFolder = folder.endsWith('/') ? folder : `${folder}/`;
			return filePath.startsWith(normalizedFolder) || filePath.startsWith(folder + '/');
		});
	}
}
