/**
 * Create Place Modal
 * Simple modal for creating new place notes
 */

import { App, Modal, Setting, TFile, Notice, normalizePath } from 'obsidian';
import { createPlaceNote, PlaceData } from '../core/place-note-writer';
import { PlaceCategory, PlaceType, PlaceNode } from '../models/place';
import { createLucideIcon } from './lucide-icons';
import { FamilyGraphService } from '../core/family-graph';
import { PlaceGraphService } from '../core/place-graph';

/**
 * Parent place option for dropdown
 */
interface ParentPlaceOption {
	id: string;
	name: string;
	path: string; // Hierarchy path like "England → UK"
}

/**
 * Modal for creating new place notes
 */
export class CreatePlaceModal extends Modal {
	private placeData: PlaceData;
	private directory: string;
	private onCreated?: (file: TFile) => void;
	private familyGraph?: FamilyGraphService;
	private placeGraph?: PlaceGraphService;
	private existingCollections: string[] = [];
	private parentPlaceOptions: Map<string, ParentPlaceOption[]> = new Map();
	private coordSectionEl?: HTMLElement;

	constructor(
		app: App,
		options?: {
			directory?: string;
			initialName?: string;
			onCreated?: (file: TFile) => void;
			familyGraph?: FamilyGraphService;
			placeGraph?: PlaceGraphService;
		}
	) {
		super(app);
		this.directory = options?.directory || '';
		this.onCreated = options?.onCreated;
		this.familyGraph = options?.familyGraph;
		this.placeGraph = options?.placeGraph;
		this.placeData = {
			name: options?.initialName || ''
		};

		// Gather existing collections from both person notes and place notes
		this.loadExistingCollections();
		// Build parent place options for dropdown
		this.loadParentPlaceOptions();
	}

	/**
	 * Load existing collections from person and place notes
	 */
	private loadExistingCollections(): void {
		const collections = new Set<string>();

		// Get collections from person notes
		if (this.familyGraph) {
			const userCollections = this.familyGraph.getUserCollections();
			for (const coll of userCollections) {
				collections.add(coll.name);
			}
		}

		// Get collections from place notes
		if (this.placeGraph) {
			const stats = this.placeGraph.calculateStatistics();
			for (const collName of Object.keys(stats.byCollection)) {
				collections.add(collName);
			}
		}

		// Sort alphabetically
		this.existingCollections = Array.from(collections).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		);
	}

	/**
	 * Load potential parent places from existing place notes
	 */
	private loadParentPlaceOptions(): void {
		this.parentPlaceOptions.clear();

		if (!this.placeGraph) return;

		const allPlaces = this.placeGraph.getAllPlaces();

		// Group by place type
		for (const place of allPlaces) {
			const type = this.formatPlaceType(place.placeType || 'other');

			if (!this.parentPlaceOptions.has(type)) {
				this.parentPlaceOptions.set(type, []);
			}

			// Build hierarchy path
			const path = this.buildHierarchyPath(place);

			this.parentPlaceOptions.get(type)!.push({
				id: place.id,
				name: place.name,
				path
			});
		}

		// Sort each group alphabetically by name
		for (const options of this.parentPlaceOptions.values()) {
			options.sort((a, b) => a.name.localeCompare(b.name));
		}
	}

	/**
	 * Build hierarchy path string for a place
	 */
	private buildHierarchyPath(place: PlaceNode): string {
		if (!this.placeGraph) return place.name;

		const ancestors = this.placeGraph.getAncestors(place.id);
		if (ancestors.length === 0) return place.name;

		// Show as "Place → Parent → Grandparent"
		const pathParts = [place.name, ...ancestors.map(a => a.name)];
		return pathParts.join(' → ');
	}

	/**
	 * Format place type for display
	 */
	private formatPlaceType(type: string): string {
		const names: Record<string, string> = {
			continent: 'Continents',
			country: 'Countries',
			state: 'States',
			province: 'Provinces',
			region: 'Regions',
			county: 'Counties',
			city: 'Cities',
			town: 'Towns',
			village: 'Villages',
			district: 'Districts',
			parish: 'Parishes',
			castle: 'Castles',
			estate: 'Estates',
			cemetery: 'Cemeteries',
			church: 'Churches',
			other: 'Other'
		};
		return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
	}

	/**
	 * Find a place by ID in the options
	 */
	private findPlaceById(id: string): ParentPlaceOption | undefined {
		for (const options of this.parentPlaceOptions.values()) {
			const found = options.find(opt => opt.id === id);
			if (found) return found;
		}
		return undefined;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-create-place-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('map-pin', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Create place note');

		// Form container
		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Name (required)
		new Setting(form)
			.setName('Name')
			.setDesc('The primary name of the place')
			.addText(text => text
				.setPlaceholder('e.g., London')
				.setValue(this.placeData.name)
				.onChange(value => {
					this.placeData.name = value;
				}));

		// Category
		new Setting(form)
			.setName('Category')
			.setDesc('Classification of the place')
			.addDropdown(dropdown => dropdown
				.addOption('real', 'Real - verified real-world location')
				.addOption('historical', 'Historical - real place that no longer exists')
				.addOption('disputed', 'Disputed - location debated by historians')
				.addOption('legendary', 'Legendary - may have historical basis')
				.addOption('mythological', 'Mythological - place from mythology')
				.addOption('fictional', 'Fictional - invented for a story')
				.setValue(this.placeData.placeCategory || 'real')
				.onChange(value => {
					this.placeData.placeCategory = value as PlaceCategory;
					// Show/hide universe field based on category
					this.updateUniverseVisibility(form);
					// Show/hide coordinates based on category
					this.updateCoordinatesVisibility();
				}));

		// Place type
		new Setting(form)
			.setName('Type')
			.setDesc('Type of place in the hierarchy')
			.addDropdown(dropdown => dropdown
				.addOption('', '(Select type)')
				.addOption('continent', 'Continent')
				.addOption('country', 'Country')
				.addOption('state', 'State')
				.addOption('province', 'Province')
				.addOption('region', 'Region')
				.addOption('county', 'County')
				.addOption('city', 'City')
				.addOption('town', 'Town')
				.addOption('village', 'Village')
				.addOption('district', 'District')
				.addOption('parish', 'Parish')
				.addOption('castle', 'Castle')
				.addOption('estate', 'Estate')
				.addOption('cemetery', 'Cemetery')
				.addOption('church', 'Church')
				.addOption('other', 'Other')
				.setValue(this.placeData.placeType || '')
				.onChange(value => {
					this.placeData.placeType = value as PlaceType || undefined;
				}));

		// Universe (for fictional/mythological/legendary places)
		const universeSetting = new Setting(form)
			.setName('Universe')
			.setDesc('For fictional/mythological places: the world or story it belongs to')
			.addText(text => text
				.setPlaceholder('e.g., Middle-earth, A Song of Ice and Fire')
				.setValue(this.placeData.universe || '')
				.onChange(value => {
					this.placeData.universe = value || undefined;
				}));
		universeSetting.settingEl.addClass('crc-universe-setting');

		// Parent place - dropdown if places exist, text input otherwise
		const parentPlaceSetting = new Setting(form)
			.setName('Parent place')
			.setDesc('The parent location in the hierarchy (e.g., England for London)');

		if (this.parentPlaceOptions.size > 0) {
			let customParentInput: HTMLInputElement | null = null;

			parentPlaceSetting.addDropdown(dropdown => {
				dropdown.addOption('', '(None)');
				dropdown.addOption('__custom__', '+ Enter manually...');

				// Add options grouped by type
				for (const [typeName, options] of this.parentPlaceOptions.entries()) {
					// Add optgroup-like separator
					dropdown.addOption(`__group_${typeName}`, `── ${typeName} ──`);
					for (const opt of options) {
						// Show hierarchy path in dropdown for context
						const displayName = opt.path !== opt.name
							? `  ${opt.name} (${opt.path})`
							: `  ${opt.name}`;
						dropdown.addOption(opt.id, displayName);
					}
				}

				dropdown.onChange(value => {
					if (value.startsWith('__group_')) {
						// Reset if they clicked a group header
						dropdown.setValue(this.placeData.parentPlaceId || '');
						return;
					}
					if (value === '__custom__') {
						// Show custom input
						if (customParentInput) {
							customParentInput.style.display = 'block';
							customParentInput.focus();
						}
						this.placeData.parentPlaceId = undefined;
						this.placeData.parentPlace = undefined;
					} else if (value) {
						// Hide custom input and use selected place
						if (customParentInput) {
							customParentInput.style.display = 'none';
							customParentInput.value = '';
						}
						const selectedPlace = this.findPlaceById(value);
						this.placeData.parentPlaceId = value;
						this.placeData.parentPlace = selectedPlace?.name;
					} else {
						// No parent
						if (customParentInput) {
							customParentInput.style.display = 'none';
							customParentInput.value = '';
						}
						this.placeData.parentPlaceId = undefined;
						this.placeData.parentPlace = undefined;
					}
				});
			});

			// Add text input for manual entry (hidden by default)
			parentPlaceSetting.addText(text => {
				customParentInput = text.inputEl;
				text.setPlaceholder('e.g., England or [[England]]')
					.onChange(value => {
						this.placeData.parentPlace = value || undefined;
						this.placeData.parentPlaceId = undefined; // Clear ID when using manual entry
					});
				text.inputEl.style.display = 'none';
				text.inputEl.style.marginLeft = '8px';
			});
		} else {
			// No existing places, just show text input
			parentPlaceSetting.addText(text => text
				.setPlaceholder('e.g., England or [[England]]')
				.setValue(this.placeData.parentPlace || '')
				.onChange(value => {
					this.placeData.parentPlace = value || undefined;
				}));
		}

		// Aliases
		new Setting(form)
			.setName('Aliases')
			.setDesc('Alternative names, comma-separated')
			.addText(text => text
				.setPlaceholder('e.g., City of London, Londinium')
				.onChange(value => {
					if (value) {
						this.placeData.aliases = value.split(',').map(a => a.trim()).filter(a => a);
					} else {
						this.placeData.aliases = undefined;
					}
				}));

		// Collection - dropdown with existing + text for custom
		const collectionSetting = new Setting(form)
			.setName('Collection')
			.setDesc('User-defined grouping (e.g., "Smith Family" to group with related person notes)');

		if (this.existingCollections.length > 0) {
			// Show dropdown with existing collections + "New collection..." option
			let customInput: HTMLInputElement | null = null;

			collectionSetting.addDropdown(dropdown => {
				dropdown
					.addOption('', '(None)')
					.addOption('__custom__', '+ New collection...');

				for (const coll of this.existingCollections) {
					dropdown.addOption(coll, coll);
				}

				dropdown.setValue(this.placeData.collection || '');
				dropdown.onChange(value => {
					if (value === '__custom__') {
						// Show custom input
						if (customInput) {
							customInput.style.display = 'block';
							customInput.focus();
						}
						this.placeData.collection = undefined;
					} else {
						// Hide custom input and use selected value
						if (customInput) {
							customInput.style.display = 'none';
							customInput.value = '';
						}
						this.placeData.collection = value || undefined;
					}
				});
			});

			// Add text input for custom collection (hidden by default)
			collectionSetting.addText(text => {
				customInput = text.inputEl;
				text.setPlaceholder('Enter new collection name')
					.onChange(value => {
						this.placeData.collection = value || undefined;
					});
				text.inputEl.style.display = 'none';
				text.inputEl.style.marginLeft = '8px';
			});
		} else {
			// No existing collections, just show text input
			collectionSetting.addText(text => text
				.setPlaceholder('e.g., Smith Family')
				.setValue(this.placeData.collection || '')
				.onChange(value => {
					this.placeData.collection = value || undefined;
				}));
		}

		// Coordinates section (for real/historical/disputed places)
		this.coordSectionEl = form.createDiv({ cls: 'crc-coord-section' });

		const coordHeader = new Setting(this.coordSectionEl)
			.setName('Coordinates')
			.setDesc('Real-world coordinates (for real, historical, disputed places)');
		coordHeader.settingEl.addClass('crc-coord-header');

		const coordInputs = this.coordSectionEl.createDiv({ cls: 'crc-coord-inputs' });

		// Latitude
		const latSetting = new Setting(coordInputs)
			.setName('Latitude')
			.addText(text => text
				.setPlaceholder('-90 to 90')
				.onChange(value => {
					this.updateCoordinates('lat', value);
				}));
		latSetting.settingEl.addClass('crc-coord-input');

		// Longitude
		const longSetting = new Setting(coordInputs)
			.setName('Longitude')
			.addText(text => text
				.setPlaceholder('-180 to 180')
				.onChange(value => {
					this.updateCoordinates('long', value);
				}));
		longSetting.settingEl.addClass('crc-coord-input');

		// Show/hide coordinates based on category
		this.updateCoordinatesVisibility();

		// Directory setting
		new Setting(form)
			.setName('Directory')
			.setDesc('Where to create the place note')
			.addText(text => text
				.setPlaceholder('e.g., Places')
				.setValue(this.directory)
				.onChange(value => {
					this.directory = value;
				}));

		// Update universe visibility based on initial category
		this.updateUniverseVisibility(form);

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const createBtn = buttonContainer.createEl('button', {
			text: 'Create place',
			cls: 'crc-btn crc-btn--primary'
		});
		createBtn.addEventListener('click', async () => {
			await this.createPlace();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Update visibility of the universe field based on category
	 */
	private updateUniverseVisibility(form: HTMLElement): void {
		const universeSetting = form.querySelector('.crc-universe-setting');
		if (!universeSetting) return;

		const showUniverse = ['fictional', 'mythological', 'legendary'].includes(
			this.placeData.placeCategory || 'real'
		);

		if (showUniverse) {
			universeSetting.removeClass('crc-hidden');
		} else {
			universeSetting.addClass('crc-hidden');
		}
	}

	/**
	 * Update visibility of coordinates section based on category
	 */
	private updateCoordinatesVisibility(): void {
		if (!this.coordSectionEl) return;

		// Show coordinates for real, historical, disputed places
		const showCoords = ['real', 'historical', 'disputed'].includes(
			this.placeData.placeCategory || 'real'
		);

		if (showCoords) {
			this.coordSectionEl.removeClass('crc-hidden');
		} else {
			this.coordSectionEl.addClass('crc-hidden');
			// Clear coordinates when hiding
			this.placeData.coordinates = undefined;
		}
	}

	/**
	 * Update coordinates from input with validation
	 */
	private updateCoordinates(field: 'lat' | 'long', value: string): void {
		const trimmed = value.trim();

		// Initialize coordinates object if needed
		if (!this.placeData.coordinates) {
			this.placeData.coordinates = { lat: 0, long: 0 };
		}

		if (!trimmed) {
			// Set to 0 if empty (we'll use 0,0 as "not set" indicator)
			if (field === 'lat') {
				this.placeData.coordinates.lat = 0;
			} else {
				this.placeData.coordinates.long = 0;
			}
			// Clear entire object if both are 0
			if (this.placeData.coordinates.lat === 0 && this.placeData.coordinates.long === 0) {
				this.placeData.coordinates = undefined;
			}
			return;
		}

		const num = parseFloat(trimmed);
		if (isNaN(num)) return;

		// Validate ranges
		if (field === 'lat' && (num < -90 || num > 90)) {
			new Notice('Latitude must be between -90 and 90');
			return;
		}
		if (field === 'long' && (num < -180 || num > 180)) {
			new Notice('Longitude must be between -180 and 180');
			return;
		}

		if (field === 'lat') {
			this.placeData.coordinates.lat = num;
		} else {
			this.placeData.coordinates.long = num;
		}
	}

	/**
	 * Create the place note
	 */
	private async createPlace(): Promise<void> {
		// Validate required fields
		if (!this.placeData.name.trim()) {
			new Notice('Please enter a name for the place');
			return;
		}

		try {
			// Ensure directory exists
			if (this.directory) {
				const normalizedDir = normalizePath(this.directory);
				const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
				if (!folder) {
					await this.app.vault.createFolder(normalizedDir);
				}
			}

			const file = await createPlaceNote(this.app, this.placeData, {
				directory: this.directory,
				openAfterCreate: true
			});

			new Notice(`Created place note: ${file.basename}`);

			if (this.onCreated) {
				this.onCreated(file);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create place note:', error);
			new Notice(`Failed to create place note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
