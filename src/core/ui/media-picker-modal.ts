/**
 * Media File Picker Modal
 *
 * Allows users to select media files (images, videos, audio, documents)
 * from the vault to link to entities (person, place, event, organization).
 */

import { App, Modal, TFile, Notice, normalizePath, setIcon, TextComponent } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import {
	MediaService,
	MediaType,
	IMAGE_EXTENSIONS,
	VIDEO_EXTENSIONS,
	AUDIO_EXTENSIONS,
	PDF_EXTENSIONS,
	DOCUMENT_EXTENSIONS
} from '../media-service';
import { FolderSuggest } from './folder-suggest';

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
 * Filter options for media
 */
type MediaFilterType = 'all' | 'image' | 'video' | 'audio' | 'document';

/**
 * Sort options for media files
 */
type SortOption = 'name-asc' | 'name-desc' | 'modified' | 'size';

/**
 * Options for the media picker modal
 */
export interface MediaPickerOptions {
	/** Custom title (default: "Select media") */
	title?: string;
	/** Optional subtitle shown below the title */
	subtitle?: string;
	/** Filter to specific media types */
	allowedTypes?: MediaType[];
	/** Allow selecting multiple files */
	multiSelect?: boolean;
	/** Already selected media (to show as checked) */
	existingMedia?: string[];
}

/**
 * Media file with metadata for display
 */
interface MediaFileItem {
	file: TFile;
	type: MediaType;
	extension: string;
	displayName: string;
	folder: string;
	isSelected: boolean;
}

/**
 * Media Picker Modal
 * Allows users to search and select media files from the vault
 */
export class MediaPickerModal extends Modal {
	private mediaService: MediaService;
	private plugin: CanvasRootsPlugin | null;
	private onSelect: (files: TFile[]) => void;
	private options: MediaPickerOptions;

	private searchQuery: string = '';
	private filterType: MediaFilterType = 'all';
	private sortOption: SortOption = 'modified';

	private allMedia: MediaFileItem[] = [];
	private filteredMedia: MediaFileItem[] = [];
	private selectedFiles: Set<string> = new Set();

	private searchInput!: HTMLInputElement;
	private resultsContainer!: HTMLElement;
	private selectionCountEl?: HTMLElement;
	private folderConfigContainer: HTMLElement | null = null;
	private pendingFileList: FileList | null = null;

	constructor(
		app: App,
		mediaService: MediaService,
		onSelect: (files: TFile[]) => void,
		options?: MediaPickerOptions,
		plugin?: CanvasRootsPlugin
	) {
		super(app);
		this.mediaService = mediaService;
		this.plugin = plugin || null;
		this.onSelect = onSelect;
		this.options = options || {};

		// Pre-select existing media
		if (this.options.existingMedia) {
			for (const ref of this.options.existingMedia) {
				// Extract path from wikilink if needed
				const path = this.mediaService.wikilinkToPath(ref);
				this.selectedFiles.add(path);
			}
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-media-picker-modal');

		this.loadMediaFiles();
		this.createModalContent();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load all media files from the vault
	 */
	private loadMediaFiles(): void {
		this.allMedia = [];
		const files = this.app.vault.getFiles();

		for (const file of files) {
			const ext = '.' + file.extension.toLowerCase();

			// Check if it's a media file
			if (!ALL_MEDIA_EXTENSIONS.includes(ext)) {
				continue;
			}

			// Apply media folder filter
			if (!this.mediaService.isInMediaFolders(file.path)) {
				continue;
			}

			const type = this.mediaService.getMediaType(ext);

			// Filter by allowed types if specified
			if (this.options.allowedTypes && !this.options.allowedTypes.includes(type)) {
				continue;
			}

			const folder = file.parent?.path || '/';

			this.allMedia.push({
				file,
				type,
				extension: ext,
				displayName: file.name,
				folder,
				isSelected: this.selectedFiles.has(file.path)
			});
		}

		// Initial sort
		this.sortMedia();
		this.filteredMedia = [...this.allMedia];
	}

	/**
	 * Sort media based on current sort option
	 */
	private sortMedia(): void {
		switch (this.sortOption) {
			case 'name-asc':
				this.allMedia.sort((a, b) => a.displayName.localeCompare(b.displayName));
				break;
			case 'name-desc':
				this.allMedia.sort((a, b) => b.displayName.localeCompare(a.displayName));
				break;
			case 'modified':
				this.allMedia.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				break;
			case 'size':
				this.allMedia.sort((a, b) => b.file.stat.size - a.file.stat.size);
				break;
		}
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
		setIcon(icon, 'image');
		titleSection.appendText(this.options.title || 'Select media');

		// Optional subtitle
		if (this.options.subtitle) {
			header.createDiv({
				cls: 'crc-picker-subtitle',
				text: this.options.subtitle
			});
		}

		// Search section
		const searchSection = contentEl.createDiv({ cls: 'crc-picker-search' });

		// "Upload files..." button (shown at top, only if plugin is available)
		if (this.plugin) {
			const uploadBtn = searchSection.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-picker-upload-btn'
			});
			const uploadIcon = uploadBtn.createSpan({ cls: 'crc-btn-icon' });
			setIcon(uploadIcon, 'upload');
			uploadBtn.appendText(' Upload files...');

			uploadBtn.addEventListener('click', () => {
				this.openUploadDialog();
			});
		}

		this.searchInput = searchSection.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Search media files...'
			}
		});

		this.searchInput.addEventListener('input', () => {
			this.searchQuery = this.searchInput.value.toLowerCase();
			this.filterMedia();
		});

		// Auto-focus search input
		setTimeout(() => this.searchInput.focus(), 50);

		// Filters row
		const filtersRow = contentEl.createDiv({ cls: 'crc-picker-filters' });

		// Type filter
		const typeFilter = filtersRow.createDiv({ cls: 'crc-picker-filter' });
		typeFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Type:' });
		const typeSelect = typeFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });

		const typeOptions: Array<{ value: MediaFilterType; label: string }> = [
			{ value: 'all', label: 'All media' },
			{ value: 'image', label: 'Images' },
			{ value: 'video', label: 'Videos' },
			{ value: 'audio', label: 'Audio' },
			{ value: 'document', label: 'Documents' }
		];

		typeOptions.forEach(opt => {
			typeSelect.createEl('option', { value: opt.value, text: opt.label });
		});

		typeSelect.addEventListener('change', () => {
			this.filterType = typeSelect.value as MediaFilterType;
			this.filterMedia();
		});

		// Sort filter
		const sortFilter = filtersRow.createDiv({ cls: 'crc-picker-filter' });
		sortFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Sort:' });
		const sortSelect = sortFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'modified', label: 'Recently modified' },
			{ value: 'name-asc', label: 'Name (A-Z)' },
			{ value: 'name-desc', label: 'Name (Z-A)' },
			{ value: 'size', label: 'File size' }
		];

		sortOptions.forEach(opt => {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.sortOption) {
				option.selected = true;
			}
		});

		sortSelect.addEventListener('change', () => {
			this.sortOption = sortSelect.value as SortOption;
			this.sortMedia();
			this.filteredMedia = [...this.allMedia];
			this.filterMedia();
		});

		// Results container
		this.resultsContainer = contentEl.createDiv({ cls: 'crc-picker-results crc-media-picker-results' });

		// Footer with selection count and confirm button
		const footer = contentEl.createDiv({ cls: 'crc-picker-footer crc-picker-footer--spaced' });

		this.selectionCountEl = footer.createDiv({ cls: 'crc-picker-selection-count' });
		this.updateSelectionCount();

		const footerButtons = footer.createDiv({ cls: 'crc-picker-footer__buttons' });

		const confirmBtn = footerButtons.createEl('button', {
			cls: 'mod-cta',
			text: this.options.multiSelect ? 'Add selected' : 'Select'
		});

		confirmBtn.addEventListener('click', () => {
			this.confirmSelection();
		});

		// Render results
		this.renderResults();
	}

	/**
	 * Filter media based on search query and type filter
	 */
	private filterMedia(): void {
		this.filteredMedia = this.allMedia.filter(item => {
			// Type filter
			if (this.filterType !== 'all' && item.type !== this.filterType) {
				return false;
			}

			// Search query filter
			if (this.searchQuery) {
				const matchesSearch =
					item.displayName.toLowerCase().includes(this.searchQuery) ||
					item.folder.toLowerCase().includes(this.searchQuery);
				if (!matchesSearch) return false;
			}

			return true;
		});

		this.renderResults();
	}

	/**
	 * Render the filtered results
	 */
	private renderResults(): void {
		this.resultsContainer.empty();

		if (this.filteredMedia.length === 0) {
			const emptyState = this.resultsContainer.createDiv({ cls: 'crc-picker-empty' });
			const emptyIcon = emptyState.createSpan();
			setIcon(emptyIcon, 'search');
			emptyState.createEl('p', { text: 'No media files found' });
			emptyState.createEl('p', {
				text: this.allMedia.length === 0
					? 'Add media files to your vault to link them'
					: 'Try a different search term or filter',
				cls: 'crc-text-muted'
			});
			return;
		}

		// Create grid of media items
		const grid = this.resultsContainer.createDiv({ cls: 'crc-media-picker-grid' });

		for (const item of this.filteredMedia) {
			this.renderMediaItem(grid, item);
		}
	}

	/**
	 * Render a single media item
	 */
	private renderMediaItem(container: HTMLElement, item: MediaFileItem): void {
		const isSelected = this.selectedFiles.has(item.file.path);

		const card = container.createDiv({
			cls: `crc-media-picker-item ${isSelected ? 'crc-media-picker-item--selected' : ''}`
		});

		// Thumbnail area
		const thumbnail = card.createDiv({ cls: 'crc-media-picker-item__thumbnail' });

		if (item.type === 'image') {
			// Show image thumbnail
			const imgUrl = this.app.vault.getResourcePath(item.file);
			const img = thumbnail.createEl('img', {
				attr: {
					src: imgUrl,
					alt: item.displayName,
					loading: 'lazy'
				}
			});
			img.onerror = () => {
				img.remove();
				this.renderPlaceholderIcon(thumbnail, item.type);
			};
		} else if (item.type === 'video') {
			// Show video icon with play indicator
			this.renderPlaceholderIcon(thumbnail, 'video');
		} else {
			// Show type-appropriate icon
			this.renderPlaceholderIcon(thumbnail, item.type);
		}

		// Selection checkbox overlay
		if (this.options.multiSelect) {
			const checkbox = card.createDiv({ cls: 'crc-media-picker-item__checkbox' });
			if (isSelected) {
				setIcon(checkbox, 'check');
			}
		}

		// Info section
		const info = card.createDiv({ cls: 'crc-media-picker-item__info' });
		info.createDiv({
			cls: 'crc-media-picker-item__name',
			text: item.displayName,
			attr: { title: item.file.path }
		});

		const meta = info.createDiv({ cls: 'crc-media-picker-item__meta' });
		meta.createSpan({ text: this.formatFileSize(item.file.stat.size) });
		meta.createSpan({ text: ' · ' });
		meta.createSpan({ text: item.extension.toUpperCase().slice(1) });

		// Click handler
		card.addEventListener('click', () => {
			if (this.options.multiSelect) {
				this.toggleSelection(item);
				card.toggleClass('crc-media-picker-item--selected', this.selectedFiles.has(item.file.path));

				// Update checkbox
				const checkbox = card.querySelector('.crc-media-picker-item__checkbox');
				if (checkbox) {
					checkbox.empty();
					if (this.selectedFiles.has(item.file.path)) {
						setIcon(checkbox as HTMLElement, 'check');
					}
				}

				this.updateSelectionCount();
			} else {
				// Single select mode - immediately confirm
				this.selectedFiles.clear();
				this.selectedFiles.add(item.file.path);
				this.confirmSelection();
			}
		});
	}

	/**
	 * Render placeholder icon for non-image media
	 */
	private renderPlaceholderIcon(container: HTMLElement, type: MediaType | 'video'): void {
		const iconName = this.getIconForType(type);
		const iconEl = container.createDiv({ cls: 'crc-media-picker-item__icon' });
		setIcon(iconEl, iconName);
	}

	/**
	 * Get icon name for media type
	 */
	private getIconForType(type: MediaType | 'video'): string {
		switch (type) {
			case 'image': return 'image';
			case 'video': return 'video';
			case 'audio': return 'music';
			case 'pdf': return 'file-text';
			case 'document': return 'file-text';
			default: return 'file';
		}
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	/**
	 * Toggle selection of a media item
	 */
	private toggleSelection(item: MediaFileItem): void {
		if (this.selectedFiles.has(item.file.path)) {
			this.selectedFiles.delete(item.file.path);
		} else {
			this.selectedFiles.add(item.file.path);
		}
	}

	/**
	 * Update the selection count display
	 */
	private updateSelectionCount(): void {
		if (!this.selectionCountEl) return;

		const count = this.selectedFiles.size;
		if (this.options.multiSelect) {
			this.selectionCountEl.setText(`${count} file${count !== 1 ? 's' : ''} selected`);
		} else {
			this.selectionCountEl.setText('');
		}
	}

	/**
	 * Confirm the selection and close the modal
	 */
	private confirmSelection(): void {
		const selectedFiles: TFile[] = [];

		for (const path of this.selectedFiles) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				selectedFiles.push(file);
			}
		}

		if (selectedFiles.length > 0) {
			this.onSelect(selectedFiles);
		}

		this.close();
	}

	/**
	 * Open file upload dialog
	 */
	private openUploadDialog(): void {
		if (!this.plugin) return;

		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.accept = ALL_MEDIA_EXTENSIONS.join(',');

		input.addEventListener('change', () => {
			if (input.files && input.files.length > 0) {
				void this.handleFileUpload(input.files);
			}
		});

		input.click();
	}

	/**
	 * Handle file upload
	 */
	private async handleFileUpload(fileList: FileList): Promise<void> {
		if (!this.plugin) return;

		const folder = this.plugin.settings.mediaFolders[0];
		if (!folder) {
			// Store pending files and show folder config
			this.pendingFileList = fileList;
			this.showFolderConfigSection();
			return;
		}

		await this.performFileUpload(fileList, folder);
	}

	/**
	 * Perform the actual file upload
	 */
	private async performFileUpload(fileList: FileList, folder: string): Promise<void> {
		// Ensure folder exists
		await this.ensureFolderExists(folder);

		const uploadedPaths: string[] = [];

		for (let i = 0; i < fileList.length; i++) {
			const file = fileList[i];
			const ext = '.' + file.name.split('.').pop()?.toLowerCase();

			// Validate file type
			if (!ALL_MEDIA_EXTENSIONS.includes(ext)) {
				new Notice(`Unsupported file type: ${file.name}`);
				continue;
			}

			try {
				const finalPath = await this.uploadFile(file, folder);
				if (finalPath) {
					uploadedPaths.push(finalPath);
				}
			} catch (error) {
				console.error('Error uploading file:', error);
				new Notice(`Failed to upload ${file.name}`);
			}
		}

		if (uploadedPaths.length > 0) {
			new Notice(`Uploaded ${uploadedPaths.length} file${uploadedPaths.length > 1 ? 's' : ''} to ${folder}`);

			// Reload media files and auto-select newly uploaded files
			this.loadMediaFiles();

			// Auto-select the uploaded files
			for (const path of uploadedPaths) {
				this.selectedFiles.add(path);
			}

			// Update the display
			this.filterMedia();
		}
	}

	/**
	 * Show inline folder configuration section
	 */
	private showFolderConfigSection(): void {
		// Remove existing folder config if any
		this.folderConfigContainer?.remove();

		// Create folder config container above the results
		this.folderConfigContainer = this.resultsContainer.createDiv({ cls: 'crc-folder-config-section' });
		this.resultsContainer.insertBefore(this.folderConfigContainer, this.resultsContainer.firstChild);

		// Warning icon and title
		const header = this.folderConfigContainer.createDiv({ cls: 'crc-folder-config-header' });
		const headerIcon = header.createSpan({ cls: 'crc-folder-config-icon' });
		setIcon(headerIcon, 'folder-cog');
		header.createSpan({ text: 'Configure Media Folder', cls: 'crc-folder-config-title' });

		// Description
		this.folderConfigContainer.createEl('p', {
			text: 'No media folder is configured. Enter a folder path to store uploaded media files.',
			cls: 'crc-folder-config-desc'
		});

		// Folder input with suggest
		const inputRow = this.folderConfigContainer.createDiv({ cls: 'crc-folder-config-input-row' });

		const inputWrapper = inputRow.createDiv({ cls: 'crc-folder-config-input-wrapper' });
		const textComponent = new TextComponent(inputWrapper);
		textComponent.setPlaceholder('e.g., Media or Attachments/Media');
		textComponent.inputEl.addClass('crc-folder-config-input');

		let selectedFolder = '';

		// Add folder suggest
		new FolderSuggest(this.app, textComponent, (value) => {
			selectedFolder = value;
		});

		// Also update on manual input
		textComponent.onChange((value) => {
			selectedFolder = value;
		});

		// Set folder button
		const setFolderBtn = inputRow.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Set folder'
		});

		setFolderBtn.addEventListener('click', () => {
			void (async () => {
				const folderPath = selectedFolder.trim() || textComponent.getValue().trim();

				if (!folderPath) {
					new Notice('Please enter a folder path');
					return;
				}

				// Save the folder to settings
				this.plugin!.settings.mediaFolders = [folderPath];
				this.plugin!.settings.enableMediaFolderFilter = true;
				await this.plugin!.saveSettings();

				// Remove the config section
				this.folderConfigContainer?.remove();
				this.folderConfigContainer = null;

				// Proceed with pending upload if any
				if (this.pendingFileList) {
					const fileList = this.pendingFileList;
					this.pendingFileList = null;
					await this.performFileUpload(fileList, folderPath);
				}

				// Reload media files to show the new folder's contents
				this.loadMediaFiles();
				this.filterMedia();
			})();
		});

		// Focus the input
		textComponent.inputEl.focus();
	}

	/**
	 * Upload a single file
	 */
	private async uploadFile(file: File, folder: string): Promise<string | null> {
		// Read file as ArrayBuffer
		const arrayBuffer = await file.arrayBuffer();

		// Generate unique filename if needed
		let fileName = file.name;
		let finalPath = normalizePath(`${folder}/${fileName}`);

		// Handle collision with auto-rename
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const nameParts = file.name.split('.');
			const ext = nameParts.pop();
			const baseName = nameParts.join('.');
			fileName = `${baseName} ${counter}.${ext}`;
			finalPath = normalizePath(`${folder}/${fileName}`);
			counter++;
		}

		// Create file
		await this.app.vault.createBinary(finalPath, arrayBuffer);

		return finalPath;
	}

	/**
	 * Ensure folder exists, create if needed
	 */
	private async ensureFolderExists(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		}
	}
}
