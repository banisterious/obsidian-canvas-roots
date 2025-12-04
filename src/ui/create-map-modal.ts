/**
 * Create/Edit Map Modal
 * Modal for creating and editing custom map notes for fictional/historical worlds
 */

import { App, Modal, Setting, TFile, Notice, normalizePath } from 'obsidian';
import { createLucideIcon } from './lucide-icons';

/**
 * Data structure for map note frontmatter
 */
interface MapData {
	mapId: string;
	name: string;
	universe: string;
	imagePath: string;
	coordinateSystem: 'geographic' | 'pixel';
	// Geographic bounds (for geographic mode)
	boundsNorth?: number;
	boundsSouth?: number;
	boundsEast?: number;
	boundsWest?: number;
	// Image dimensions (for pixel mode)
	imageWidth?: number;
	imageHeight?: number;
	// Optional
	defaultZoom?: number;
	centerLat?: number;
	centerLng?: number;
}

/**
 * Generate a URL-friendly map ID from a name
 */
function generateMapId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '') // Remove special characters
		.replace(/\s+/g, '-')          // Replace spaces with hyphens
		.replace(/-+/g, '-')           // Collapse multiple hyphens
		.trim();
}

/**
 * Parse map data from frontmatter
 */
function parseMapDataFromFrontmatter(frontmatter: Record<string, unknown>): MapData {
	const coordinateSystem = frontmatter.coordinate_system === 'pixel' ? 'pixel' : 'geographic';

	// Parse bounds - support both flat and nested formats
	let boundsNorth: number | undefined;
	let boundsSouth: number | undefined;
	let boundsEast: number | undefined;
	let boundsWest: number | undefined;

	if (typeof frontmatter.bounds_north === 'number') {
		boundsNorth = frontmatter.bounds_north;
		boundsSouth = frontmatter.bounds_south as number | undefined;
		boundsEast = frontmatter.bounds_east as number | undefined;
		boundsWest = frontmatter.bounds_west as number | undefined;
	} else if (frontmatter.bounds && typeof frontmatter.bounds === 'object') {
		const bounds = frontmatter.bounds as Record<string, unknown>;
		boundsNorth = bounds.north as number | undefined;
		boundsSouth = bounds.south as number | undefined;
		boundsEast = bounds.east as number | undefined;
		boundsWest = bounds.west as number | undefined;
	}

	return {
		mapId: String(frontmatter.map_id || ''),
		name: String(frontmatter.name || ''),
		universe: String(frontmatter.universe || ''),
		imagePath: String(frontmatter.image || ''),
		coordinateSystem,
		boundsNorth,
		boundsSouth,
		boundsEast,
		boundsWest,
		imageWidth: typeof frontmatter.image_width === 'number' ? frontmatter.image_width : undefined,
		imageHeight: typeof frontmatter.image_height === 'number' ? frontmatter.image_height : undefined,
		defaultZoom: typeof frontmatter.default_zoom === 'number' ? frontmatter.default_zoom : undefined
	};
}

/**
 * Modal for creating and editing custom map notes
 */
export class CreateMapModal extends Modal {
	private mapData: MapData;
	private directory: string;
	private onCreated?: (file: TFile) => void;
	private onUpdated?: (file: TFile) => void;

	// Edit mode properties
	private editMode: boolean = false;
	private editingFile?: TFile;

	// UI elements for dynamic updates
	private boundsSection?: HTMLElement;
	private dimensionsSection?: HTMLElement;
	private mapIdInput?: HTMLInputElement;
	private imagePathInput?: HTMLInputElement;
	private directorySettingEl?: HTMLElement;

	constructor(
		app: App,
		options?: {
			directory?: string;
			onCreated?: (file: TFile) => void;
			onUpdated?: (file: TFile) => void;
			// Edit mode options
			editFile?: TFile;
			editFrontmatter?: Record<string, unknown>;
		}
	) {
		super(app);
		this.directory = options?.directory || '';
		this.onCreated = options?.onCreated;
		this.onUpdated = options?.onUpdated;

		// Check for edit mode
		if (options?.editFile && options?.editFrontmatter) {
			this.editMode = true;
			this.editingFile = options.editFile;
			this.mapData = parseMapDataFromFrontmatter(options.editFrontmatter);
			// Get directory from file path
			const pathParts = options.editFile.path.split('/');
			pathParts.pop(); // Remove filename
			this.directory = pathParts.join('/');
		} else {
			// Initialize with defaults for create mode
			this.mapData = {
				mapId: '',
				name: '',
				universe: '',
				imagePath: '',
				coordinateSystem: 'geographic',
				boundsNorth: 100,
				boundsSouth: -100,
				boundsEast: 100,
				boundsWest: -100,
				defaultZoom: 2
			};
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-create-map-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('globe', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText(this.editMode ? 'Edit custom map' : 'Create custom map');

		// Description
		contentEl.createEl('p', {
			text: this.editMode
				? 'Edit the map configuration. Changes will be saved to the frontmatter.'
				: 'Create a map note for a fictional world or historical map. Custom maps can be used in the map view to display places from your universe.',
			cls: 'crc-modal-description'
		});

		// Form container
		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Name (required)
		new Setting(form)
			.setName('Name')
			.setDesc('Display name for the map')
			.addText(text => text
				.setPlaceholder('e.g., Middle-earth, Westeros')
				.setValue(this.mapData.name)
				.onChange(value => {
					this.mapData.name = value;
					// Auto-generate map ID from name (only in create mode if not manually edited)
					if (!this.editMode && this.mapIdInput && !this.mapIdInput.dataset.manuallyEdited) {
						const generatedId = generateMapId(value);
						this.mapData.mapId = generatedId;
						this.mapIdInput.value = generatedId;
					}
				}));

		// Map ID (required, auto-generated in create mode)
		new Setting(form)
			.setName('Map ID')
			.setDesc(this.editMode
				? 'Unique identifier (changing this may break references)'
				: 'Unique identifier (auto-generated from name, or enter custom)')
			.addText(text => {
				this.mapIdInput = text.inputEl;
				text.setPlaceholder('e.g., middle-earth')
					.setValue(this.mapData.mapId)
					.onChange(value => {
						this.mapData.mapId = value;
						// Mark as manually edited to prevent auto-overwrite
						if (this.mapIdInput) {
							this.mapIdInput.dataset.manuallyEdited = 'true';
						}
					});
			});

		// In edit mode, mark the map ID as already manually set
		if (this.editMode && this.mapIdInput) {
			this.mapIdInput.dataset.manuallyEdited = 'true';
		}

		// Universe (required)
		new Setting(form)
			.setName('Universe')
			.setDesc('The fictional world or setting this map belongs to')
			.addText(text => text
				.setPlaceholder('e.g., tolkien, westeros, star-wars')
				.setValue(this.mapData.universe)
				.onChange(value => {
					this.mapData.universe = value;
				}));

		// Image path (required)
		const imagePathSetting = new Setting(form)
			.setName('Image path')
			.setDesc('Path to the map image file in your vault');

		imagePathSetting.addText(text => {
			this.imagePathInput = text.inputEl;
			text.setPlaceholder('e.g., assets/maps/middle-earth.jpg')
				.setValue(this.mapData.imagePath)
				.onChange(value => {
					this.mapData.imagePath = value;
				});
		});

		imagePathSetting.addButton(btn => {
			btn.setButtonText('Browse')
				.onClick(() => {
					this.browseForImage();
				});
		});

		// Coordinate system
		new Setting(form)
			.setName('Coordinate system')
			.setDesc('Geographic uses lat/lng coordinates; Pixel uses image coordinates')
			.addDropdown(dropdown => dropdown
				.addOption('geographic', 'Geographic (lat/lng)')
				.addOption('pixel', 'Pixel (image coordinates)')
				.setValue(this.mapData.coordinateSystem)
				.onChange(value => {
					this.mapData.coordinateSystem = value as 'geographic' | 'pixel';
					this.updateCoordinateSystemVisibility();
				}));

		// Bounds section (for geographic mode)
		this.boundsSection = form.createDiv({ cls: 'crc-bounds-section' });

		const boundsHeader = new Setting(this.boundsSection)
			.setName('Map bounds')
			.setDesc('Define the coordinate boundaries of your map image');
		boundsHeader.settingEl.addClass('crc-section-header');

		const boundsGrid = this.boundsSection.createDiv({ cls: 'crc-bounds-grid' });

		// North
		new Setting(boundsGrid)
			.setName('North')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(this.mapData.boundsNorth?.toString() || '')
				.onChange(value => {
					this.mapData.boundsNorth = parseFloat(value) || undefined;
				}));

		// South
		new Setting(boundsGrid)
			.setName('South')
			.addText(text => text
				.setPlaceholder('-100')
				.setValue(this.mapData.boundsSouth?.toString() || '')
				.onChange(value => {
					this.mapData.boundsSouth = parseFloat(value) || undefined;
				}));

		// East
		new Setting(boundsGrid)
			.setName('East')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(this.mapData.boundsEast?.toString() || '')
				.onChange(value => {
					this.mapData.boundsEast = parseFloat(value) || undefined;
				}));

		// West
		new Setting(boundsGrid)
			.setName('West')
			.addText(text => text
				.setPlaceholder('-100')
				.setValue(this.mapData.boundsWest?.toString() || '')
				.onChange(value => {
					this.mapData.boundsWest = parseFloat(value) || undefined;
				}));

		// Image dimensions section (for pixel mode)
		this.dimensionsSection = form.createDiv({ cls: 'crc-dimensions-section' });

		const dimsHeader = new Setting(this.dimensionsSection)
			.setName('Image dimensions')
			.setDesc('Dimensions of the map image (optional, auto-detected if not specified)');
		dimsHeader.settingEl.addClass('crc-section-header');

		const dimsGrid = this.dimensionsSection.createDiv({ cls: 'crc-dims-grid' });

		new Setting(dimsGrid)
			.setName('Width')
			.addText(text => text
				.setPlaceholder('e.g., 2048')
				.setValue(this.mapData.imageWidth?.toString() || '')
				.onChange(value => {
					this.mapData.imageWidth = parseInt(value) || undefined;
				}));

		new Setting(dimsGrid)
			.setName('Height')
			.addText(text => text
				.setPlaceholder('e.g., 1536')
				.setValue(this.mapData.imageHeight?.toString() || '')
				.onChange(value => {
					this.mapData.imageHeight = parseInt(value) || undefined;
				}));

		// Default zoom
		new Setting(form)
			.setName('Default zoom')
			.setDesc('Initial zoom level when opening the map (typically 0-5)')
			.addText(text => text
				.setPlaceholder('2')
				.setValue(this.mapData.defaultZoom?.toString() || '')
				.onChange(value => {
					this.mapData.defaultZoom = parseInt(value) || undefined;
				}));

		// Directory setting (only show in create mode)
		if (!this.editMode) {
			const dirSetting = new Setting(form)
				.setName('Directory')
				.setDesc('Where to create the map note')
				.addText(text => text
					.setPlaceholder('e.g., Maps')
					.setValue(this.directory)
					.onChange(value => {
						this.directory = value;
					}));
			this.directorySettingEl = dirSetting.settingEl;
		}

		// Set initial visibility based on coordinate system
		this.updateCoordinateSystemVisibility();

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const submitBtn = buttonContainer.createEl('button', {
			text: this.editMode ? 'Save changes' : 'Create map',
			cls: 'crc-btn crc-btn--primary'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updateMap();
			} else {
				void this.createMap();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Update visibility of bounds vs dimensions sections based on coordinate system
	 */
	private updateCoordinateSystemVisibility(): void {
		if (this.boundsSection && this.dimensionsSection) {
			if (this.mapData.coordinateSystem === 'geographic') {
				this.boundsSection.removeClass('crc-hidden');
				this.dimensionsSection.addClass('crc-hidden');
			} else {
				this.boundsSection.addClass('crc-hidden');
				this.dimensionsSection.removeClass('crc-hidden');
			}
		}
	}

	/**
	 * Browse for an image file in the vault
	 */
	private browseForImage(): void {
		// Get all image files in the vault
		const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
		const allFiles = this.app.vault.getFiles();
		const imageFiles = allFiles.filter(f =>
			imageExtensions.includes(f.extension.toLowerCase())
		);

		if (imageFiles.length === 0) {
			new Notice('No image files found in vault');
			return;
		}

		// Create a simple file picker modal
		const picker = new ImagePickerModal(this.app, imageFiles, (selectedPath) => {
			this.mapData.imagePath = selectedPath;
			if (this.imagePathInput) {
				this.imagePathInput.value = selectedPath;
			}
		});
		picker.open();
	}

	/**
	 * Validate required fields
	 */
	private validate(): boolean {
		if (!this.mapData.name.trim()) {
			new Notice('Please enter a name for the map');
			return false;
		}

		if (!this.mapData.mapId.trim()) {
			new Notice('Please enter a map ID');
			return false;
		}

		if (!this.mapData.universe.trim()) {
			new Notice('Please enter a universe/world name');
			return false;
		}

		if (!this.mapData.imagePath.trim()) {
			new Notice('Please specify an image path');
			return false;
		}

		// Validate bounds for geographic mode
		if (this.mapData.coordinateSystem === 'geographic') {
			if (
				this.mapData.boundsNorth === undefined ||
				this.mapData.boundsSouth === undefined ||
				this.mapData.boundsEast === undefined ||
				this.mapData.boundsWest === undefined
			) {
				new Notice('Please specify all four boundary values (north, south, east, west)');
				return false;
			}
		}

		return true;
	}

	/**
	 * Create a new map note
	 */
	private async createMap(): Promise<void> {
		if (!this.validate()) return;

		try {
			// Ensure directory exists
			if (this.directory) {
				const normalizedDir = normalizePath(this.directory);
				const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
				if (!folder) {
					await this.app.vault.createFolder(normalizedDir);
				}
			}

			// Generate frontmatter
			const frontmatter = this.generateFrontmatter();

			// Create filename from name
			const filename = this.mapData.name.replace(/[\\/:*?"<>|]/g, '-') + '.md';
			const filepath = this.directory
				? normalizePath(`${this.directory}/${filename}`)
				: filename;

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(filepath);
			if (existingFile) {
				new Notice(`A file already exists at ${filepath}`);
				return;
			}

			// Create the note content
			const content = `---\n${frontmatter}---\n\n# ${this.mapData.name}\n\nThis is a custom map for the ${this.mapData.universe} universe.\n`;

			const file = await this.app.vault.create(filepath, content);

			new Notice(`Created map note: ${file.basename}`);

			if (this.onCreated) {
				this.onCreated(file);
			}

			// Open the file
			await this.app.workspace.getLeaf(false).openFile(file);

			this.close();
		} catch (error) {
			console.error('Failed to create map note:', error);
			new Notice(`Failed to create map note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Update an existing map note
	 */
	private async updateMap(): Promise<void> {
		if (!this.validate()) return;

		if (!this.editingFile) {
			new Notice('No file to update');
			return;
		}

		try {
			// Read the current file content
			const content = await this.app.vault.read(this.editingFile);

			// Find and replace frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				new Notice('Could not find frontmatter in file');
				return;
			}

			const newFrontmatter = this.generateFrontmatter();
			const newContent = content.replace(
				/^---\n[\s\S]*?\n---/,
				`---\n${newFrontmatter}---`
			);

			await this.app.vault.modify(this.editingFile, newContent);

			new Notice(`Updated map note: ${this.editingFile.basename}`);

			if (this.onUpdated) {
				this.onUpdated(this.editingFile);
			}

			this.close();
		} catch (error) {
			console.error('Failed to update map note:', error);
			new Notice(`Failed to update map note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Generate YAML frontmatter for the map note
	 */
	private generateFrontmatter(): string {
		const lines: string[] = [
			'type: map',
			`map_id: ${this.mapData.mapId}`,
			`name: ${this.mapData.name}`,
			`universe: ${this.mapData.universe}`,
			`image: ${this.mapData.imagePath}`,
			`coordinate_system: ${this.mapData.coordinateSystem}`
		];

		if (this.mapData.coordinateSystem === 'geographic') {
			// Add bounds using nested format for readability
			lines.push('bounds:');
			lines.push(`  north: ${this.mapData.boundsNorth}`);
			lines.push(`  south: ${this.mapData.boundsSouth}`);
			lines.push(`  east: ${this.mapData.boundsEast}`);
			lines.push(`  west: ${this.mapData.boundsWest}`);
		} else {
			// Add image dimensions if specified
			if (this.mapData.imageWidth !== undefined) {
				lines.push(`image_width: ${this.mapData.imageWidth}`);
			}
			if (this.mapData.imageHeight !== undefined) {
				lines.push(`image_height: ${this.mapData.imageHeight}`);
			}
		}

		if (this.mapData.defaultZoom !== undefined) {
			lines.push(`default_zoom: ${this.mapData.defaultZoom}`);
		}

		return lines.join('\n') + '\n';
	}
}

/**
 * Simple image picker modal
 */
class ImagePickerModal extends Modal {
	private files: TFile[];
	private onSelect: (path: string) => void;
	private searchInput?: HTMLInputElement;
	private listContainer?: HTMLElement;

	constructor(app: App, files: TFile[], onSelect: (path: string) => void) {
		super(app);
		this.files = files;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-image-picker-modal');

		// Header
		contentEl.createEl('h3', { text: 'Select map image' });

		// Search input
		const searchContainer = contentEl.createDiv({ cls: 'crc-search-container' });
		this.searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search images...',
			cls: 'crc-search-input'
		});
		this.searchInput.addEventListener('input', () => this.filterFiles());

		// File list
		this.listContainer = contentEl.createDiv({ cls: 'crc-file-list' });
		this.renderFiles(this.files);

		// Focus search
		this.searchInput.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private filterFiles(): void {
		const query = this.searchInput?.value.toLowerCase() || '';
		const filtered = this.files.filter(f =>
			f.path.toLowerCase().includes(query) ||
			f.basename.toLowerCase().includes(query)
		);
		this.renderFiles(filtered);
	}

	private renderFiles(files: TFile[]): void {
		if (!this.listContainer) return;
		this.listContainer.empty();

		if (files.length === 0) {
			this.listContainer.createEl('p', {
				text: 'No matching images found',
				cls: 'crc-no-results'
			});
			return;
		}

		// Group by folder
		const byFolder = new Map<string, TFile[]>();
		for (const file of files) {
			const folder = file.parent?.path || '/';
			if (!byFolder.has(folder)) {
				byFolder.set(folder, []);
			}
			byFolder.get(folder)!.push(file);
		}

		// Render grouped
		for (const [folder, folderFiles] of byFolder.entries()) {
			if (byFolder.size > 1) {
				this.listContainer.createEl('div', {
					text: folder || 'Root',
					cls: 'crc-folder-header'
				});
			}

			for (const file of folderFiles) {
				const item = this.listContainer.createDiv({ cls: 'crc-file-item' });
				item.createSpan({ text: file.basename, cls: 'crc-file-name' });
				item.createSpan({ text: file.extension, cls: 'crc-file-ext' });

				item.addEventListener('click', () => {
					this.onSelect(file.path);
					this.close();
				});
			}
		}
	}
}
