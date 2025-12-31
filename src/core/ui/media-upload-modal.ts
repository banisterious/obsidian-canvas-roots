/**
 * Media Upload Modal
 *
 * Simple standalone modal for uploading media files to the vault.
 * Accessed from Dashboard → Media → Upload Media tile.
 *
 * Features:
 * - Drag-and-drop file upload with browse fallback
 * - Multiple file selection
 * - Upload to mediaFolders[0] with read-only destination display
 * - Auto-rename collision handling
 * - File type validation
 */

import { App, Modal, Notice, normalizePath, TextComponent } from 'obsidian';
import { setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, PDF_EXTENSIONS, DOCUMENT_EXTENSIONS } from '../media-service';
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
 * File info for upload queue
 */
interface UploadFile {
	file: File;
	displayName: string;
	size: number;
	sizeText: string;
	extension: string;
}

/**
 * Media Upload Modal
 */
export class MediaUploadModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private uploadFiles: UploadFile[] = [];
	private dropZone: HTMLElement | null = null;
	private filesListContainer: HTMLElement | null = null;
	private uploadButton: HTMLButtonElement | null = null;
	private folderConfigContainer: HTMLElement | null = null;
	private bodyEl: HTMLElement | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-media-upload-modal');

		this.renderContent();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.uploadFiles = [];
	}

	/**
	 * Render modal content
	 */
	private renderContent(): void {
		const { contentEl } = this;

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const headerIcon = header.createDiv({ cls: 'crc-modal-header-icon' });
		setIcon(headerIcon, 'upload');
		header.createEl('h2', { text: 'Upload Media' });

		this.bodyEl = contentEl.createDiv({ cls: 'crc-modal-body' });
		const body = this.bodyEl;

		// Drop zone
		this.dropZone = body.createDiv({ cls: 'crc-upload-drop-zone' });
		const dropIcon = this.dropZone.createDiv({ cls: 'crc-upload-drop-icon' });
		setIcon(dropIcon, 'folder-open');
		this.dropZone.createDiv({ cls: 'crc-upload-drop-text', text: 'Drag files here or click to browse' });
		this.dropZone.createDiv({ cls: 'crc-upload-drop-hint', text: 'Supports images, videos, audio, PDFs, and documents' });

		// Browse button
		const browseBtn = this.dropZone.createEl('button', { cls: 'crc-btn crc-btn--secondary crc-upload-browse-btn' });
		const browseIcon = browseBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(browseIcon, 'file-plus');
		browseBtn.appendText(' Browse Files');

		// Drag and drop handlers
		this.setupDragAndDrop();

		// Click to browse
		this.dropZone.addEventListener('click', (e) => {
			if (e.target === browseBtn || browseBtn.contains(e.target as Node)) {
				return; // Let button handle its own click
			}
			this.openFileBrowser();
		});

		browseBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.openFileBrowser();
		});

		// Destination info
		const destInfo = body.createDiv({ cls: 'crc-upload-destination' });
		destInfo.createDiv({ cls: 'crc-upload-destination-label', text: 'Files will be uploaded to:' });
		destInfo.createDiv({ cls: 'crc-upload-destination-path', text: this.getUploadDestination() });
		destInfo.createDiv({ cls: 'crc-upload-destination-hint', text: 'This is your first configured media folder. You can move files to other locations later using Obsidian\'s file explorer.' });

		// Files list
		const filesSection = body.createDiv({ cls: 'crc-upload-files-section' });
		filesSection.createDiv({ cls: 'crc-upload-files-header', text: 'Files to upload' });
		this.filesListContainer = filesSection.createDiv({ cls: 'crc-upload-files-list' });

		this.renderFilesList();

		// Footer
		const footer = contentEl.createDiv({ cls: 'crc-modal-footer' });
		const footerInfo = footer.createDiv({ cls: 'crc-modal-footer-info', text: 'No files selected' });

		const footerActions = footer.createDiv({ cls: 'crc-modal-footer-actions' });

		const cancelBtn = footerActions.createEl('button', { cls: 'crc-btn crc-btn--secondary', text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		this.uploadButton = footerActions.createEl('button', { cls: 'crc-btn crc-btn--primary', text: 'Upload' });
		this.uploadButton.disabled = true;
		this.uploadButton.addEventListener('click', () => { void this.handleUpload(); });

		// Update footer info when files change
		this.updateFooterInfo(footerInfo);
	}

	/**
	 * Setup drag and drop handlers
	 */
	private setupDragAndDrop(): void {
		if (!this.dropZone) return;

		this.dropZone.addEventListener('dragover', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.dropZone?.addClass('crc-upload-drop-zone--active');
		});

		this.dropZone.addEventListener('dragleave', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			// Only remove if we're actually leaving the drop zone
			const relatedTarget = e.relatedTarget as HTMLElement;
			if (!this.dropZone?.contains(relatedTarget)) {
				this.dropZone?.removeClass('crc-upload-drop-zone--active');
			}
		});

		this.dropZone.addEventListener('drop', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.dropZone?.removeClass('crc-upload-drop-zone--active');

			if (e.dataTransfer?.files) {
				this.handleFiles(e.dataTransfer.files);
			}
		});
	}

	/**
	 * Open file browser dialog
	 */
	private openFileBrowser(): void {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.accept = ALL_MEDIA_EXTENSIONS.join(',');

		input.addEventListener('change', () => {
			if (input.files) {
				this.handleFiles(input.files);
			}
		});

		input.click();
	}

	/**
	 * Handle selected files
	 */
	private handleFiles(fileList: FileList): void {
		for (let i = 0; i < fileList.length; i++) {
			const file = fileList[i];
			const ext = '.' + file.name.split('.').pop()?.toLowerCase();

			// Validate file type
			if (!ALL_MEDIA_EXTENSIONS.includes(ext)) {
				new Notice(`Unsupported file type: ${file.name}`);
				continue;
			}

			// Check if already added
			if (this.uploadFiles.some(f => f.displayName === file.name)) {
				continue;
			}

			// Add to queue
			this.uploadFiles.push({
				file,
				displayName: file.name,
				size: file.size,
				sizeText: this.formatFileSize(file.size),
				extension: ext
			});
		}

		this.renderFilesList();
		this.updateUploadButton();
	}

	/**
	 * Render the files list
	 */
	private renderFilesList(): void {
		if (!this.filesListContainer) return;

		this.filesListContainer.empty();

		if (this.uploadFiles.length === 0) {
			this.filesListContainer.createDiv({ cls: 'crc-upload-files-empty', text: 'No files selected' });
			return;
		}

		this.uploadFiles.forEach((uploadFile, index) => {
			const fileItem = this.filesListContainer!.createDiv({ cls: 'crc-upload-file-item' });

			const fileIcon = fileItem.createDiv({ cls: 'crc-upload-file-icon' });
			setIcon(fileIcon, this.getFileIcon(uploadFile.extension));

			const fileInfo = fileItem.createDiv({ cls: 'crc-upload-file-info' });
			fileInfo.createDiv({ cls: 'crc-upload-file-name', text: uploadFile.displayName });
			fileInfo.createDiv({ cls: 'crc-upload-file-meta', text: `${uploadFile.extension.toUpperCase().slice(1)} · ${uploadFile.sizeText}` });

			const removeBtn = fileItem.createEl('button', { cls: 'crc-upload-file-remove' });
			setIcon(removeBtn, 'x');
			removeBtn.addEventListener('click', () => {
				this.uploadFiles.splice(index, 1);
				this.renderFilesList();
				this.updateUploadButton();
			});
		});
	}

	/**
	 * Update upload button state
	 */
	private updateUploadButton(): void {
		if (this.uploadButton) {
			this.uploadButton.disabled = this.uploadFiles.length === 0;
		}
	}

	/**
	 * Update footer info text
	 */
	private updateFooterInfo(footerInfo: HTMLElement): void {
		const updateText = () => {
			const count = this.uploadFiles.length;
			if (count === 0) {
				footerInfo.textContent = 'No files selected';
			} else if (count === 1) {
				footerInfo.textContent = '1 file selected';
			} else {
				footerInfo.textContent = `${count} files selected`;
			}
		};

		updateText();

		// Re-update on interval to catch changes
		const interval = setInterval(updateText, 500);
		this.containerEl.addEventListener('remove', () => clearInterval(interval));
	}

	/**
	 * Handle upload
	 */
	private async handleUpload(): Promise<void> {
		const destination = this.getUploadFolder();

		if (!destination) {
			this.showFolderConfigSection();
			return;
		}

		await this.performUpload(destination);
	}

	/**
	 * Perform the actual upload to a destination folder
	 */
	private async performUpload(destination: string): Promise<void> {
		// Ensure folder exists
		await this.ensureFolderExists(destination);

		let uploadedCount = 0;

		for (const uploadFile of this.uploadFiles) {
			try {
				const finalPath = await this.uploadFile(uploadFile, destination);
				if (finalPath) {
					uploadedCount++;
				}
			} catch (error) {
				console.error('Error uploading file:', error);
				new Notice(`Failed to upload ${uploadFile.displayName}`);
			}
		}

		if (uploadedCount > 0) {
			new Notice(`Uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''} to ${destination}`);
			this.close();
		}
	}

	/**
	 * Show inline folder configuration section
	 */
	private showFolderConfigSection(): void {
		if (!this.bodyEl) return;

		// Remove existing folder config if any
		this.folderConfigContainer?.remove();

		// Create folder config container at the top of the body
		this.folderConfigContainer = this.bodyEl.createDiv({ cls: 'crc-folder-config-section' });
		this.bodyEl.insertBefore(this.folderConfigContainer, this.bodyEl.firstChild);

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
				this.plugin.settings.mediaFolders = [folderPath];
				this.plugin.settings.enableMediaFolderFilter = true;
				await this.plugin.saveSettings();

				// Remove the config section
				this.folderConfigContainer?.remove();
				this.folderConfigContainer = null;

				// Update the destination display
				this.updateDestinationDisplay();

				// Proceed with upload
				await this.performUpload(folderPath);
			})();
		});

		// Focus the input
		textComponent.inputEl.focus();
	}

	/**
	 * Update the destination display after folder is configured
	 */
	private updateDestinationDisplay(): void {
		const destPath = this.contentEl.querySelector('.crc-upload-destination-path');
		if (destPath) {
			destPath.textContent = this.getUploadDestination();
		}
	}

	/**
	 * Upload a single file
	 */
	private async uploadFile(uploadFile: UploadFile, folder: string): Promise<string | null> {
		// Read file as ArrayBuffer
		const arrayBuffer = await uploadFile.file.arrayBuffer();

		// Generate unique filename if needed
		let fileName = uploadFile.displayName;
		let finalPath = normalizePath(`${folder}/${fileName}`);

		// Handle collision with auto-rename
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const nameParts = uploadFile.displayName.split('.');
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

	/**
	 * Get upload destination folder path
	 */
	private getUploadFolder(): string | null {
		const { mediaFolders } = this.plugin.settings;
		if (mediaFolders.length === 0) {
			return null;
		}
		return mediaFolders[0];
	}

	/**
	 * Get upload destination display name
	 */
	private getUploadDestination(): string {
		const folder = this.getUploadFolder();
		if (!folder) {
			return 'Not configured';
		}
		return folder;
	}

	/**
	 * Get icon for file type
	 */
	private getFileIcon(extension: string): string {
		if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
		if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
		if (AUDIO_EXTENSIONS.includes(extension)) return 'music';
		if (PDF_EXTENSIONS.includes(extension)) return 'file-text';
		if (DOCUMENT_EXTENSIONS.includes(extension)) return 'file-text';
		return 'file';
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
}
