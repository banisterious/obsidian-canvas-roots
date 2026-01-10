/**
 * Modal for flattening nested YAML properties in Charted Roots notes
 * Converts nested structures like coordinates: { lat, long } to flat properties
 * like coordinates_lat, coordinates_long
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { detectNoteType } from '../utils/note-type-detection';

/**
 * Definition of a nested property that can be flattened
 */
interface NestedPropertyDefinition {
	/** The nested property name (e.g., 'coordinates') */
	nestedName: string;
	/** The child properties to flatten */
	children: string[];
	/** Display name for the UI */
	displayName: string;
	/** Description of what this property contains */
	description: string;
}

/**
 * A file that has nested properties to flatten
 */
interface FileWithNestedProperties {
	file: TFile;
	/** Which nested properties this file has */
	nestedProperties: string[];
}

/**
 * Summary of what was found during scanning
 */
interface ScanSummary {
	/** Total files scanned */
	totalScanned: number;
	/** Files with nested properties, grouped by property name */
	byProperty: Map<string, FileWithNestedProperties[]>;
}

/**
 * Known nested properties that can be flattened
 */
const NESTED_PROPERTY_DEFINITIONS: NestedPropertyDefinition[] = [
	{
		nestedName: 'coordinates',
		children: ['lat', 'long'],
		displayName: 'Geographic coordinates',
		description: 'coordinates: { lat, long } → coordinates_lat, coordinates_long'
	},
	{
		nestedName: 'custom_coordinates',
		children: ['x', 'y', 'map'],
		displayName: 'Custom map coordinates',
		description: 'custom_coordinates: { x, y, map } → custom_coordinates_x, custom_coordinates_y, custom_coordinates_map'
	}
];

/**
 * Options for the flatten modal
 */
export interface FlattenNestedPropertiesModalOptions {
	/** Callback when flattening is complete */
	onComplete?: (flattened: number) => void;
}

/**
 * Modal for finding and flattening nested properties
 */
export class FlattenNestedPropertiesModal extends Modal {
	private options: FlattenNestedPropertiesModalOptions;
	private scanSummary: ScanSummary | null = null;
	private selectedProperties: Set<string> = new Set();
	private isScanning = false;
	private isApplying = false;

	// UI elements
	private contentContainer: HTMLElement | null = null;
	private scanButton: HTMLButtonElement | null = null;
	private applyButton: HTMLButtonElement | null = null;
	private progressContainer: HTMLElement | null = null;
	private resultsContainer: HTMLElement | null = null;

	constructor(app: App, options: FlattenNestedPropertiesModalOptions = {}) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('cr-flatten-nested-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('layers', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Flatten nested properties');

		// Description
		const description = contentEl.createDiv({ cls: 'crc-modal-description' });
		description.createEl('p', {
			text: 'Scans Charted Roots notes for nested YAML properties and converts them to flat properties. ' +
				'This ensures compatibility with Obsidian\'s metadata system and Dataview queries.'
		});

		// Content container
		this.contentContainer = contentEl.createDiv({ cls: 'cr-flatten-content' });

		// Property definitions section
		const propertiesSection = this.contentContainer.createDiv({ cls: 'cr-flatten-properties-section' });
		propertiesSection.createEl('h3', { text: 'Properties to check' });

		for (const def of NESTED_PROPERTY_DEFINITIONS) {
			new Setting(propertiesSection)
				.setName(def.displayName)
				.setDesc(def.description)
				.addToggle(toggle => toggle
					.setValue(true)
					.onChange(value => {
						if (value) {
							this.selectedProperties.add(def.nestedName);
						} else {
							this.selectedProperties.delete(def.nestedName);
						}
						// Reset scan results when selection changes
						this.scanSummary = null;
						this.updateResultsDisplay();
					})
				);

			// Start with all selected
			this.selectedProperties.add(def.nestedName);
		}

		// Scan button
		const scanButtonContainer = this.contentContainer.createDiv({ cls: 'cr-flatten-scan-container' });
		this.scanButton = scanButtonContainer.createEl('button', {
			text: 'Scan for nested properties',
			cls: 'mod-cta'
		});
		this.scanButton.addEventListener('click', () => void this.runScan());

		// Progress container (hidden initially)
		this.progressContainer = this.contentContainer.createDiv({ cls: 'cr-flatten-progress crc-hidden' });

		// Results container
		this.resultsContainer = this.contentContainer.createDiv({ cls: 'cr-flatten-results' });

		// Backup warning
		const warning = this.contentContainer.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Footer with apply button
		const footer = contentEl.createDiv({ cls: 'crc-modal-footer' });
		this.applyButton = footer.createEl('button', {
			text: 'Flatten selected',
			cls: 'mod-cta'
		});
		this.applyButton.disabled = true;
		this.applyButton.addEventListener('click', () => void this.applyFlattening());

		footer.createEl('button', { text: 'Close' })
			.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Scan all Charted Roots notes for nested properties
	 */
	private runScan(): void {
		if (this.isScanning || this.selectedProperties.size === 0) {
			return;
		}

		this.isScanning = true;
		this.updateButtonStates();

		// Show progress
		if (this.progressContainer) {
			this.progressContainer.removeClass('crc-hidden');
			this.progressContainer.empty();
			this.progressContainer.createEl('p', { text: 'Scanning notes...' });
		}

		try {
			const summary = this.scanForNestedProperties();
			this.scanSummary = summary;
			this.updateResultsDisplay();
		} catch (error) {
			console.error('Error scanning for nested properties:', error);
			new Notice('Error scanning notes. Check console for details.');
		} finally {
			this.isScanning = false;
			this.updateButtonStates();
			if (this.progressContainer) {
				this.progressContainer.addClass('crc-hidden');
			}
		}
	}

	/**
	 * Scan notes and return summary
	 */
	private scanForNestedProperties(): ScanSummary {
		const byProperty = new Map<string, FileWithNestedProperties[]>();
		let totalScanned = 0;

		// Initialize maps for selected properties
		for (const propName of this.selectedProperties) {
			byProperty.set(propName, []);
		}

		// Get all markdown files
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Get frontmatter from cache
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			// Check if it's a Charted Roots note
			const noteType = detectNoteType(frontmatter, cache);
			if (!noteType) {
				continue;
			}

			totalScanned++;

			if (!frontmatter) {
				continue;
			}

			const nestedPropsInFile: string[] = [];

			// Check each selected property
			for (const propName of this.selectedProperties) {
				// Check if the nested property exists and is an object (not flat)
				if (
					frontmatter[propName] !== undefined &&
					typeof frontmatter[propName] === 'object' &&
					frontmatter[propName] !== null &&
					!Array.isArray(frontmatter[propName])
				) {
					nestedPropsInFile.push(propName);
				}
			}

			// Add to results if any nested properties found
			if (nestedPropsInFile.length > 0) {
				const fileInfo: FileWithNestedProperties = {
					file,
					nestedProperties: nestedPropsInFile
				};

				for (const propName of nestedPropsInFile) {
					byProperty.get(propName)?.push(fileInfo);
				}
			}
		}

		return { totalScanned, byProperty };
	}

	/**
	 * Update the results display based on scan summary
	 */
	private updateResultsDisplay(): void {
		if (!this.resultsContainer) return;

		this.resultsContainer.empty();

		if (!this.scanSummary) {
			this.resultsContainer.createEl('p', {
				text: 'Click "Scan for nested properties" to find notes that need flattening.',
				cls: 'crc-text--muted'
			});
			return;
		}

		const { totalScanned, byProperty } = this.scanSummary;

		// Summary header
		const summaryHeader = this.resultsContainer.createDiv({ cls: 'cr-flatten-summary-header' });
		summaryHeader.createEl('p', {
			text: `Scanned ${totalScanned} Charted Roots notes.`
		});

		// Count total files needing flattening
		const allFilesSet = new Set<string>();
		for (const files of byProperty.values()) {
			for (const f of files) {
				allFilesSet.add(f.file.path);
			}
		}

		if (allFilesSet.size === 0) {
			const successMsg = this.resultsContainer.createDiv({ cls: 'crc-success-callout' });
			const successIcon = createLucideIcon('check-circle', 16);
			successMsg.appendChild(successIcon);
			successMsg.appendText(' All notes already use flat properties. No migration needed.');
			return;
		}

		// Results by property type
		const resultsTable = this.resultsContainer.createDiv({ cls: 'cr-flatten-results-table' });

		for (const [propName, files] of byProperty) {
			if (files.length === 0) continue;

			const def = NESTED_PROPERTY_DEFINITIONS.find(d => d.nestedName === propName);
			const displayName = def?.displayName || propName;

			const row = resultsTable.createDiv({ cls: 'cr-flatten-result-row' });

			const iconEl = createLucideIcon('file-text', 16);
			row.appendChild(iconEl);

			row.createSpan({ text: `${displayName}: ` });
			row.createSpan({
				text: `${files.length} note${files.length === 1 ? '' : 's'}`,
				cls: 'cr-flatten-count'
			});

			// Preview button to show affected files
			const previewBtn = row.createEl('button', {
				text: 'Preview',
				cls: 'cr-flatten-preview-btn'
			});
			previewBtn.addEventListener('click', () => this.showPreview(propName, files));
		}

		// Total summary
		const totalSummary = this.resultsContainer.createDiv({ cls: 'cr-flatten-total' });
		totalSummary.createEl('strong', {
			text: `Total: ${allFilesSet.size} note${allFilesSet.size === 1 ? '' : 's'} to flatten`
		});

		this.updateButtonStates();
	}

	/**
	 * Show a preview of files that will be affected
	 */
	private showPreview(propName: string, files: FileWithNestedProperties[]): void {
		if (!this.resultsContainer) return;

		// Find or create preview container
		let previewContainer = this.resultsContainer.querySelector('.cr-flatten-preview') as HTMLElement;
		if (previewContainer) {
			previewContainer.remove();
		}

		previewContainer = this.resultsContainer.createDiv({ cls: 'cr-flatten-preview' });

		const def = NESTED_PROPERTY_DEFINITIONS.find(d => d.nestedName === propName);
		const displayName = def?.displayName || propName;

		previewContainer.createEl('h4', { text: `Files with nested ${displayName}` });

		const list = previewContainer.createEl('ul', { cls: 'cr-flatten-file-list' });

		// Show up to 20 files
		const maxToShow = 20;
		const filesToShow = files.slice(0, maxToShow);

		for (const fileInfo of filesToShow) {
			const li = list.createEl('li');
			const link = li.createEl('a', {
				text: fileInfo.file.basename,
				cls: 'cr-flatten-file-link'
			});
			link.addEventListener('click', (e) => {
				e.preventDefault();
				void this.app.workspace.openLinkText(fileInfo.file.path, '');
			});
		}

		if (files.length > maxToShow) {
			list.createEl('li', {
				text: `... and ${files.length - maxToShow} more`,
				cls: 'crc-text--muted'
			});
		}

		// Close preview button
		const closeBtn = previewContainer.createEl('button', { text: 'Close preview' });
		closeBtn.addEventListener('click', () => previewContainer.remove());
	}

	/**
	 * Apply flattening to all affected files
	 */
	private async applyFlattening(): Promise<void> {
		if (this.isApplying || !this.scanSummary) {
			return;
		}

		// Collect unique files
		const allFilesMap = new Map<string, FileWithNestedProperties>();
		for (const files of this.scanSummary.byProperty.values()) {
			for (const f of files) {
				allFilesMap.set(f.file.path, f);
			}
		}

		if (allFilesMap.size === 0) {
			new Notice('No files to flatten.');
			return;
		}

		this.isApplying = true;
		this.updateButtonStates();

		// Show progress
		if (this.progressContainer) {
			this.progressContainer.removeClass('crc-hidden');
			this.progressContainer.empty();
		}

		let flattened = 0;
		let errors = 0;
		const total = allFilesMap.size;

		try {
			for (const [path, fileInfo] of allFilesMap) {
				// Update progress
				if (this.progressContainer) {
					this.progressContainer.empty();
					this.progressContainer.createEl('p', {
						text: `Flattening ${flattened + 1} of ${total}...`
					});
					const progressBar = this.progressContainer.createDiv({ cls: 'cr-flatten-progress-bar' });
					const fill = progressBar.createDiv({ cls: 'cr-flatten-progress-fill' });
					fill.setCssStyles({ width: `${((flattened + 1) / total) * 100}%` });
				}

				try {
					await this.flattenFileProperties(fileInfo);
					flattened++;
				} catch (error) {
					console.error(`Error flattening ${path}:`, error);
					errors++;
				}
			}

			// Show completion message
			if (errors === 0) {
				new Notice(`Successfully flattened properties in ${flattened} note${flattened === 1 ? '' : 's'}.`);
			} else {
				new Notice(`Flattened ${flattened} note${flattened === 1 ? '' : 's'} with ${errors} error${errors === 1 ? '' : 's'}. Check console for details.`);
			}

			// Call completion callback
			if (this.options.onComplete) {
				this.options.onComplete(flattened);
			}

			// Re-scan to update display
			this.scanSummary = null;
			this.runScan();

		} finally {
			this.isApplying = false;
			this.updateButtonStates();
			if (this.progressContainer) {
				this.progressContainer.addClass('crc-hidden');
			}
		}
	}

	/**
	 * Flatten nested properties in a single file
	 */
	private async flattenFileProperties(fileInfo: FileWithNestedProperties): Promise<void> {
		const { file, nestedProperties } = fileInfo;

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			for (const propName of nestedProperties) {
				const nestedValue = frontmatter[propName];

				if (
					nestedValue === undefined ||
					typeof nestedValue !== 'object' ||
					nestedValue === null ||
					Array.isArray(nestedValue)
				) {
					continue;
				}

				// Get the definition for this property
				const def = NESTED_PROPERTY_DEFINITIONS.find(d => d.nestedName === propName);
				if (!def) continue;

				// Flatten each child property
				for (const childName of def.children) {
					const childValue = nestedValue[childName];
					if (childValue !== undefined) {
						const flatKey = `${propName}_${childName}`;
						frontmatter[flatKey] = childValue;
					}
				}

				// Remove the nested property
				delete frontmatter[propName];
			}
		});
	}

	/**
	 * Update button states based on current state
	 */
	private updateButtonStates(): void {
		if (this.scanButton) {
			this.scanButton.disabled = this.isScanning || this.isApplying || this.selectedProperties.size === 0;
			this.scanButton.textContent = this.isScanning ? 'Scanning...' : 'Scan for nested properties';
		}

		if (this.applyButton) {
			const hasFilesToFlatten = this.scanSummary &&
				Array.from(this.scanSummary.byProperty.values()).some(files => files.length > 0);

			this.applyButton.disabled = this.isScanning || this.isApplying || !hasFilesToFlatten;
			this.applyButton.textContent = this.isApplying ? 'Flattening...' : 'Flatten selected';
		}
	}
}
