/**
 * Media Manage Modal
 *
 * Allows users to view, reorder, and remove media linked to an entity.
 * The first item in the list is used as the thumbnail.
 * Supports drag-and-drop reordering.
 */

import { App, Modal, TFile, setIcon, Notice } from 'obsidian';
import { MediaService, MediaItem } from '../media-service';

/**
 * Options for the media manage modal
 */
export interface MediaManageOptions {
	/** Entity display name (for title) */
	entityName: string;
	/** Entity type (person, place, event, organization) */
	entityType: string;
}

/**
 * Media Manage Modal
 * Allows users to reorder and remove media from an entity
 */
export class MediaManageModal extends Modal {
	private mediaService: MediaService;
	private entityFile: TFile;
	private options: MediaManageOptions;
	private onSave: (mediaRefs: string[]) => Promise<void>;
	private onAddMedia: () => void;

	private mediaItems: MediaItem[] = [];
	private mediaRefs: string[] = [];
	private listContainer!: HTMLElement;
	private draggedItem: HTMLElement | null = null;
	private draggedIndex: number = -1;

	constructor(
		app: App,
		mediaService: MediaService,
		entityFile: TFile,
		mediaRefs: string[],
		onSave: (mediaRefs: string[]) => Promise<void>,
		onAddMedia: () => void,
		options: MediaManageOptions
	) {
		super(app);
		this.mediaService = mediaService;
		this.entityFile = entityFile;
		this.mediaRefs = [...mediaRefs];
		this.onSave = onSave;
		this.onAddMedia = onAddMedia;
		this.options = options;

		// Resolve media items
		this.mediaItems = this.mediaService.resolveMediaItems(this.mediaRefs);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-media-manage-modal');

		this.createModalContent();
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
		setIcon(icon, 'image');
		titleSection.appendText('Manage media');

		header.createDiv({
			cls: 'crc-picker-subtitle',
			text: `${this.options.entityName} (${this.options.entityType})`
		});

		// Instructions
		const instructions = contentEl.createDiv({ cls: 'crc-media-manage-instructions' });
		instructions.createEl('p', {
			text: 'Drag items to reorder. The first item is used as the thumbnail.',
			cls: 'crc-text-muted'
		});

		// Add media button
		const addBtnContainer = contentEl.createDiv({ cls: 'crc-media-manage-add' });
		const addBtn = addBtnContainer.createEl('button', {
			cls: 'mod-cta',
			text: 'Add media'
		});
		const addIcon = addBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(addIcon, 'plus');
		addBtn.prepend(addIcon);

		addBtn.addEventListener('click', () => {
			this.close();
			this.onAddMedia();
		});

		// Media list container
		this.listContainer = contentEl.createDiv({ cls: 'crc-media-manage-list' });

		if (this.mediaItems.length === 0) {
			this.renderEmptyState();
		} else {
			this.renderMediaList();
		}

		// Footer with save/cancel buttons
		const footer = contentEl.createDiv({ cls: 'crc-picker-footer' });

		const cancelBtn = footer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const saveBtn = footer.createEl('button', {
			cls: 'mod-cta',
			text: 'Save changes'
		});
		saveBtn.addEventListener('click', () => {
			void this.saveChanges();
		});
	}

	/**
	 * Render empty state
	 */
	private renderEmptyState(): void {
		const emptyState = this.listContainer.createDiv({ cls: 'crc-picker-empty' });
		const emptyIcon = emptyState.createSpan();
		setIcon(emptyIcon, 'image');
		emptyState.createEl('p', { text: 'No media linked' });
		emptyState.createEl('p', {
			text: 'Click "Add media" to link files to this entity',
			cls: 'crc-text-muted'
		});
	}

	/**
	 * Render the media list with drag-and-drop support
	 */
	private renderMediaList(): void {
		this.listContainer.empty();

		this.mediaItems.forEach((item, index) => {
			const row = this.createMediaRow(item, index);
			this.listContainer.appendChild(row);
		});
	}

	/**
	 * Create a media row element
	 */
	private createMediaRow(item: MediaItem, index: number): HTMLElement {
		const row = document.createElement('div');
		row.className = 'crc-media-manage-row';
		row.dataset.index = index.toString();
		row.draggable = true;

		// Drag handle
		const dragHandle = row.createDiv({ cls: 'crc-media-manage-row__handle' });
		setIcon(dragHandle, 'grip-vertical');

		// Thumbnail
		const thumbnail = row.createDiv({ cls: 'crc-media-manage-row__thumbnail' });

		if (item.type === 'image' && item.file) {
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
				this.renderThumbnailIcon(thumbnail, item.type);
			};
		} else {
			this.renderThumbnailIcon(thumbnail, item.type);
		}

		// Info section
		const info = row.createDiv({ cls: 'crc-media-manage-row__info' });
		info.createDiv({
			cls: 'crc-media-manage-row__name',
			text: item.displayName,
			attr: { title: item.mediaRef }
		});

		const meta = info.createDiv({ cls: 'crc-media-manage-row__meta' });
		meta.createSpan({ text: item.extension.toUpperCase().slice(1) });

		if (!item.file) {
			const missingBadge = meta.createSpan({ cls: 'crc-badge crc-badge--warning' });
			setIcon(missingBadge, 'alert-triangle');
			missingBadge.appendText(' File not found');
		}

		// Thumbnail badge for first item
		if (index === 0) {
			const thumbBadge = info.createDiv({ cls: 'crc-badge crc-badge--primary' });
			thumbBadge.setText('Thumbnail');
		}

		// Remove button
		const removeBtn = row.createDiv({ cls: 'crc-media-manage-row__remove' });
		setIcon(removeBtn, 'x');
		removeBtn.setAttribute('aria-label', 'Remove media');

		removeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.removeMediaItem(index);
		});

		// Drag events
		row.addEventListener('dragstart', (e) => this.handleDragStart(e, row, index));
		row.addEventListener('dragend', () => this.handleDragEnd());
		row.addEventListener('dragover', (e) => this.handleDragOver(e));
		row.addEventListener('dragenter', (e) => this.handleDragEnter(e, row));
		row.addEventListener('dragleave', (e) => this.handleDragLeave(e, row));
		row.addEventListener('drop', (e) => this.handleDrop(e, index));

		return row;
	}

	/**
	 * Render thumbnail icon for non-image media
	 */
	private renderThumbnailIcon(container: HTMLElement, type: string): void {
		const iconName = this.getIconForType(type);
		const iconEl = container.createDiv({ cls: 'crc-media-manage-row__icon' });
		setIcon(iconEl, iconName);
	}

	/**
	 * Get icon name for media type
	 */
	private getIconForType(type: string): string {
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
	 * Remove a media item at the given index
	 */
	private removeMediaItem(index: number): void {
		this.mediaRefs.splice(index, 1);
		this.mediaItems.splice(index, 1);
		this.renderMediaList();

		if (this.mediaItems.length === 0) {
			this.renderEmptyState();
		}
	}

	// Drag and drop handlers

	private handleDragStart(e: DragEvent, row: HTMLElement, index: number): void {
		this.draggedItem = row;
		this.draggedIndex = index;
		row.addClass('crc-media-manage-row--dragging');

		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
	}

	private handleDragEnd(): void {
		if (this.draggedItem) {
			this.draggedItem.removeClass('crc-media-manage-row--dragging');
		}
		this.draggedItem = null;
		this.draggedIndex = -1;

		// Remove all drag-over indicators
		const rows = this.listContainer.querySelectorAll('.crc-media-manage-row');
		rows.forEach(row => {
			row.removeClass('crc-media-manage-row--drag-over');
		});
	}

	private handleDragOver(e: DragEvent): void {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	private handleDragEnter(e: DragEvent, row: HTMLElement): void {
		e.preventDefault();
		if (row !== this.draggedItem) {
			row.addClass('crc-media-manage-row--drag-over');
		}
	}

	private handleDragLeave(e: DragEvent, row: HTMLElement): void {
		// Only remove class if we're actually leaving the row
		const relatedTarget = e.relatedTarget as HTMLElement;
		if (!row.contains(relatedTarget)) {
			row.removeClass('crc-media-manage-row--drag-over');
		}
	}

	private handleDrop(e: DragEvent, targetIndex: number): void {
		e.preventDefault();

		if (this.draggedIndex === -1 || this.draggedIndex === targetIndex) {
			return;
		}

		// Reorder arrays
		const [movedRef] = this.mediaRefs.splice(this.draggedIndex, 1);
		const [movedItem] = this.mediaItems.splice(this.draggedIndex, 1);

		this.mediaRefs.splice(targetIndex, 0, movedRef);
		this.mediaItems.splice(targetIndex, 0, movedItem);

		// Re-render the list
		this.renderMediaList();
	}

	/**
	 * Save changes to the entity's media property
	 */
	private async saveChanges(): Promise<void> {
		try {
			await this.onSave(this.mediaRefs);
			new Notice('Media updated');
			this.close();
		} catch (error) {
			console.error('Error saving media:', error);
			new Notice('Failed to save media changes');
		}
	}
}
