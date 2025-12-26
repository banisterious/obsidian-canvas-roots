/**
 * Create Place Modal
 * Simple modal for creating new place notes
 */

import { App, Modal, Setting, TFile, Notice, normalizePath } from 'obsidian';
import { createPlaceNote, updatePlaceNote, PlaceData } from '../core/place-note-writer';
import { PlaceCategory, PlaceType, PlaceNode, KNOWN_PLACE_TYPES } from '../models/place';
import { createLucideIcon } from './lucide-icons';
import { FamilyGraphService } from '../core/family-graph';
import { PlaceGraphService } from '../core/place-graph';
import { getDefaultPlaceCategory, CanvasRootsSettings } from '../settings';
import { GeocodingService } from '../maps/services/geocoding-service';
import type CanvasRootsPlugin from '../../main';
import { ModalStatePersistence, renderResumePromptBanner } from './modal-state-persistence';

/**
 * Parent place option for dropdown
 */
interface ParentPlaceOption {
	id: string;
	name: string;
	path: string; // Hierarchy path like "England → UK"
	placeType?: string; // The place type for filtering
}

/**
 * Hierarchy ordering for place types (smaller number = higher in hierarchy)
 */
const PLACE_TYPE_HIERARCHY: Record<string, number> = {
	planet: 0,
	continent: 1,
	country: 2,
	state: 3,
	province: 3,
	region: 4,
	county: 5,
	district: 6,
	city: 7,
	town: 8,
	village: 9,
	parish: 10,
	estate: 11,
	castle: 11,
	church: 12,
	cemetery: 12,
	other: 99
};

/**
 * Suggest a parent place type based on the child's type
 * Returns the most likely parent type in the hierarchy
 */
function suggestParentType(childType?: string): PlaceType | undefined {
	if (!childType) return 'country';

	const suggestions: Record<string, PlaceType> = {
		city: 'state',
		town: 'county',
		village: 'county',
		parish: 'county',
		county: 'state',
		district: 'city',
		state: 'country',
		province: 'country',
		region: 'country',
		country: 'continent',
		continent: 'planet',
		castle: 'county',
		estate: 'county',
		church: 'city',
		cemetery: 'city'
	};

	return suggestions[childType] || 'country';
}

/**
 * Form data structure for persistence
 */
interface PlaceFormData {
	name: string;
	placeCategory?: PlaceCategory;
	placeType?: string;
	universe?: string;
	parentPlaceId?: string;
	parentPlace?: string;
	aliases?: string[];
	collection?: string;
	coordinates?: { lat: number; long: number };
	directory?: string;
}

/**
 * Modal for creating or editing place notes
 */
export class CreatePlaceModal extends Modal {
	private placeData: PlaceData;
	private directory: string;
	private onCreated?: (file: TFile) => void;
	private onUpdated?: (file: TFile) => void;
	private familyGraph?: FamilyGraphService;
	private placeGraph?: PlaceGraphService;
	private existingCollections: string[] = [];
	private parentPlaceOptions: Map<string, ParentPlaceOption[]> = new Map();
	private allParentOptions: ParentPlaceOption[] = []; // Flat list for filtering
	private coordSectionEl?: HTMLElement;
	private parentPlaceSettingEl?: HTMLElement;
	private parentDropdownEl?: HTMLSelectElement;
	private latInputEl?: HTMLInputElement;
	private longInputEl?: HTMLInputElement;
	private customTypeInputEl?: HTMLInputElement;
	private typeDropdownEl?: HTMLSelectElement;

	// Edit mode properties
	private editMode: boolean = false;
	private editingFile?: TFile;
	private editingPlaceId?: string;

	// Track custom parent place for auto-creation
	private pendingParentPlace?: string;

	// Pre-set values for new modals (e.g., when creating parent from child)
	private initialPlaceType?: PlaceType;

	// Settings for default category
	private settings?: CanvasRootsSettings;

	// State persistence
	private plugin?: CanvasRootsPlugin;
	private persistence?: ModalStatePersistence<PlaceFormData>;
	private savedSuccessfully: boolean = false;
	private resumeBanner?: HTMLElement;

	constructor(
		app: App,
		options?: {
			directory?: string;
			initialName?: string;
			initialPlaceType?: PlaceType;
			initialCollection?: string;
			onCreated?: (file: TFile) => void;
			onUpdated?: (file: TFile) => void;
			familyGraph?: FamilyGraphService;
			placeGraph?: PlaceGraphService;
			settings?: CanvasRootsSettings;
			// Edit mode options
			editPlace?: PlaceNode;
			editFile?: TFile;
			// Plugin reference for state persistence
			plugin?: CanvasRootsPlugin;
		}
	) {
		super(app);
		this.directory = options?.directory || '';
		this.onCreated = options?.onCreated;
		this.onUpdated = options?.onUpdated;
		this.familyGraph = options?.familyGraph;
		this.placeGraph = options?.placeGraph;
		this.initialPlaceType = options?.initialPlaceType;
		this.settings = options?.settings;
		this.plugin = options?.plugin;

		// Set up persistence (only in create mode)
		if (this.plugin && !options?.editPlace) {
			this.persistence = new ModalStatePersistence<PlaceFormData>(this.plugin, 'place');
		}

		// Check for edit mode
		if (options?.editPlace && options?.editFile) {
			this.editMode = true;
			this.editingFile = options.editFile;
			this.editingPlaceId = options.editPlace.id;
			// Populate placeData from the existing place
			this.placeData = this.placeNodeToPlaceData(options.editPlace);
			// Get directory from file path
			const pathParts = options.editFile.path.split('/');
			pathParts.pop(); // Remove filename
			this.directory = pathParts.join('/');
		} else {
			// Determine default category based on settings, folder, and collection
			const defaultCategory = this.settings
				? getDefaultPlaceCategory(this.settings, {
					folder: this.directory,
					collection: options?.initialCollection
				})
				: 'real';

			this.placeData = {
				name: options?.initialName || '',
				placeType: options?.initialPlaceType,
				placeCategory: defaultCategory,
				collection: options?.initialCollection
			};
		}

		// Gather existing collections from both person notes and place notes
		this.loadExistingCollections();
		// Build parent place options for dropdown
		this.loadParentPlaceOptions();
	}

	/**
	 * Convert a PlaceNode to PlaceData for editing
	 */
	private placeNodeToPlaceData(place: PlaceNode): PlaceData {
		return {
			name: place.name,
			crId: place.id,
			aliases: place.aliases.length > 0 ? [...place.aliases] : undefined,
			placeCategory: place.category,
			placeType: place.placeType,
			universe: place.universe,
			parentPlaceId: place.parentId,
			parentPlace: place.parentId ? this.getParentPlaceName(place.parentId) : undefined,
			coordinates: place.coordinates ? { ...place.coordinates } : undefined,
			customCoordinates: place.customCoordinates ? { ...place.customCoordinates } : undefined,
			collection: place.collection
		};
	}

	/**
	 * Get parent place name from ID
	 */
	private getParentPlaceName(parentId: string): string | undefined {
		if (!this.placeGraph) return undefined;
		const parent = this.placeGraph.getPlaceByCrId(parentId);
		return parent?.name;
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
		this.allParentOptions = [];

		if (!this.placeGraph) return;

		const allPlaces = this.placeGraph.getAllPlaces();

		// Group by place type
		for (const place of allPlaces) {
			const rawType = place.placeType || 'other';
			const type = this.formatPlaceType(rawType);

			if (!this.parentPlaceOptions.has(type)) {
				this.parentPlaceOptions.set(type, []);
			}

			// Build hierarchy path
			const path = this.buildHierarchyPath(place);

			const option: ParentPlaceOption = {
				id: place.id,
				name: place.name,
				path,
				placeType: rawType
			};

			this.parentPlaceOptions.get(type)!.push(option);
			this.allParentOptions.push(option);
		}

		// Sort each group alphabetically by name
		for (const options of this.parentPlaceOptions.values()) {
			options.sort((a, b) => a.name.localeCompare(b.name));
		}

		// Sort flat list alphabetically
		this.allParentOptions.sort((a, b) => a.name.localeCompare(b.name));

		// Auto-populate parent place based on folder structure (for new places)
		if (!this.editMode && !this.placeData.parentPlaceId) {
			const suggestedParent = this.suggestParentFromFolder();
			if (suggestedParent) {
				this.placeData.parentPlaceId = suggestedParent.id;
				this.placeData.parentPlace = suggestedParent.name;
			}
		}
	}

	/**
	 * Suggest a parent place based on the folder structure.
	 * Looks at the directory path and tries to match folder names to existing places.
	 *
	 * For example, if creating a place in "Places/USA/California/",
	 * it will try to match "California" or "USA" to existing place notes.
	 *
	 * Returns the most specific (deepest) match in the folder hierarchy.
	 */
	private suggestParentFromFolder(): ParentPlaceOption | undefined {
		if (!this.directory || this.allParentOptions.length === 0) {
			return undefined;
		}

		// Split directory path into parts
		const folderParts = this.directory.split('/').filter(p => p.trim() !== '');

		// Try each folder from most specific (deepest) to least specific
		// Skip the last part if it matches the place name being created
		for (let i = folderParts.length - 1; i >= 0; i--) {
			const folderName = folderParts[i].toLowerCase().trim();

			// Skip generic folder names
			if (['places', 'locations', 'geography', 'canvas-roots', 'canvas roots'].includes(folderName)) {
				continue;
			}

			// Skip if this folder name matches the place being created
			if (this.placeData.name &&
				folderName === this.placeData.name.toLowerCase().trim()) {
				continue;
			}

			// Find a matching place by name (case-insensitive)
			const match = this.allParentOptions.find(opt =>
				opt.name.toLowerCase() === folderName
			);

			if (match) {
				return match;
			}
		}

		return undefined;
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
			planet: 'Planets',
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
		titleContainer.appendText(this.editMode ? 'Edit place note' : 'Create place note');

		// Check for persisted state (only in create mode)
		if (this.persistence && !this.editMode) {
			const existingState = this.persistence.getValidState();
			if (existingState) {
				const timeAgo = this.persistence.getTimeAgoString(existingState);
				this.resumeBanner = renderResumePromptBanner(
					contentEl,
					timeAgo,
					() => {
						// Discard - clear state and remove banner
						void this.persistence?.clear();
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
					},
					() => {
						// Restore - populate form with saved data
						this.restoreFromPersistedState(existingState.formData as unknown as PlaceFormData);
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
						// Re-render form with restored data
						contentEl.empty();
						this.onOpen();
					}
				);
			}
		}

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
		const typeSetting = new Setting(form)
			.setName('Type')
			.setDesc('Type of place in the hierarchy');

		typeSetting.addDropdown(dropdown => {
			this.typeDropdownEl = dropdown.selectEl;
			dropdown
				.addOption('', '(Select type)')
				.addOption('planet', 'Planet')
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
				.addOption('__custom__', 'Other...');

			// Check if initial value is a known type or custom
			const initialType = this.placeData.placeType;
			const isCustomType = initialType && !KNOWN_PLACE_TYPES.includes(initialType as typeof KNOWN_PLACE_TYPES[number]);

			if (isCustomType) {
				dropdown.setValue('__custom__');
			} else {
				dropdown.setValue(initialType || '');
			}

			dropdown.onChange(value => {
				if (value === '__custom__') {
					// Show custom type input
					if (this.customTypeInputEl) {
						this.customTypeInputEl.removeClass('cr-hidden');
						this.customTypeInputEl.focus();
					}
					// Keep the previous custom value or clear
					if (!isCustomType) {
						this.placeData.placeType = undefined;
					}
				} else {
					// Hide custom input and use selected value
					if (this.customTypeInputEl) {
						this.customTypeInputEl.addClass('cr-hidden');
						this.customTypeInputEl.value = '';
					}
					this.placeData.placeType = value || undefined;
				}
				// Update parent place dropdown to filter by hierarchy
				this.updateParentPlaceDropdown();
			});
		});

		// Add text input for custom type (hidden by default unless editing a custom type)
		typeSetting.addText(text => {
			this.customTypeInputEl = text.inputEl;
			text.setPlaceholder('Enter custom type (e.g., galaxy, star-system)')
				.onChange(value => {
					// Store custom type as-is, lowercase for consistency
					const customType = value.trim().toLowerCase().replace(/\s+/g, '-');
					this.placeData.placeType = customType || undefined;
					// Update parent place dropdown
					this.updateParentPlaceDropdown();
				});

			// Show input if editing a custom type
			const initialType = this.placeData.placeType;
			const isCustomType = initialType && !KNOWN_PLACE_TYPES.includes(initialType as typeof KNOWN_PLACE_TYPES[number]);

			if (isCustomType) {
				text.setValue(initialType);
				text.inputEl.removeClass('cr-hidden');
			} else {
				text.inputEl.addClass('cr-hidden');
			}
			text.inputEl.addClass('crc-input--inline');
		});

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
		this.parentPlaceSettingEl = parentPlaceSetting.settingEl;

		if (this.parentPlaceOptions.size > 0) {
			let customParentInput: HTMLInputElement | null = null;

			parentPlaceSetting.addDropdown(dropdown => {
				this.parentDropdownEl = dropdown.selectEl;
				this.populateParentDropdown(dropdown.selectEl, this.placeData.placeType);

				// Set initial value if editing and has parent
				if (this.placeData.parentPlaceId) {
					dropdown.setValue(this.placeData.parentPlaceId);
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
							customParentInput.removeClass('cr-hidden');
							customParentInput.focus();
						}
						this.placeData.parentPlaceId = undefined;
						this.placeData.parentPlace = undefined;
					} else if (value) {
						// Hide custom input and use selected place
						if (customParentInput) {
							customParentInput.addClass('cr-hidden');
							customParentInput.value = '';
						}
						const selectedPlace = this.findPlaceById(value);
						this.placeData.parentPlaceId = value;
						this.placeData.parentPlace = selectedPlace?.name;
					} else {
						// No parent
						if (customParentInput) {
							customParentInput.addClass('cr-hidden');
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
						// Track for potential auto-creation
						this.pendingParentPlace = value?.trim() || undefined;
					});
				text.inputEl.addClass('cr-hidden');
				text.inputEl.addClass('crc-input--inline');
			});
		} else {
			// No existing places, just show text input
			parentPlaceSetting.addText(text => text
				.setPlaceholder('e.g., England or [[England]]')
				.setValue(this.placeData.parentPlace || '')
				.onChange(value => {
					this.placeData.parentPlace = value || undefined;
					// Track for potential auto-creation
					this.pendingParentPlace = value?.trim() || undefined;
				}));
		}

		// Aliases
		new Setting(form)
			.setName('Aliases')
			.setDesc('Alternative names, comma-separated')
			.addText(text => text
				.setPlaceholder('e.g., City of London, Londinium')
				.setValue(this.placeData.aliases?.join(', ') || '')
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
							customInput.removeClass('cr-hidden');
							customInput.focus();
						}
						this.placeData.collection = undefined;
					} else {
						// Hide custom input and use selected value
						if (customInput) {
							customInput.addClass('cr-hidden');
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
				text.inputEl.addClass('cr-hidden');
				text.inputEl.addClass('crc-input--inline');
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

		// Add geocoding lookup button to header
		coordHeader.addButton(btn => {
			btn.setButtonText('Look up')
				.setTooltip('Look up coordinates by place name (uses OpenStreetMap)')
				.onClick(() => {
					void this.lookupCoordinates();
				});
			btn.buttonEl.addClass('crc-coord-lookup-btn');
		});

		const coordInputs = this.coordSectionEl.createDiv({ cls: 'crc-coord-inputs' });

		// Latitude
		const latSetting = new Setting(coordInputs)
			.setName('Latitude')
			.addText(text => {
				this.latInputEl = text.inputEl;
				text.setPlaceholder('-90 to 90')
					.onChange(value => {
						this.updateCoordinates('lat', value);
					});
				// Set initial value if editing
				if (this.placeData.coordinates?.lat !== undefined) {
					text.setValue(this.placeData.coordinates.lat.toString());
				}
			});
		latSetting.settingEl.addClass('crc-coord-input');

		// Longitude
		const longSetting = new Setting(coordInputs)
			.setName('Longitude')
			.addText(text => {
				this.longInputEl = text.inputEl;
				text.setPlaceholder('-180 to 180')
					.onChange(value => {
						this.updateCoordinates('long', value);
					});
				// Set initial value if editing
				if (this.placeData.coordinates?.long !== undefined) {
					text.setValue(this.placeData.coordinates.long.toString());
				}
			});
		longSetting.settingEl.addClass('crc-coord-input');

		// Show/hide coordinates based on category
		this.updateCoordinatesVisibility();

		// Directory setting (only show in create mode)
		if (!this.editMode) {
			new Setting(form)
				.setName('Directory')
				.setDesc('Where to create the place note')
				.addText(text => text
					.setPlaceholder('e.g., Places')
					.setValue(this.directory)
					.onChange(value => {
						this.directory = value;
					}));
		}

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

		const submitBtn = buttonContainer.createEl('button', {
			text: this.editMode ? 'Save changes' : 'Create place',
			cls: 'crc-btn crc-btn--primary'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updatePlace();
			} else {
				void this.createPlace();
			}
		});
	}

	onClose() {
		const { contentEl } = this;

		// Persist state if not saved successfully and we have persistence enabled
		if (this.persistence && !this.editMode && !this.savedSuccessfully) {
			const formData = this.gatherFormData();
			if (this.persistence.hasContent(formData)) {
				void this.persistence.persist(formData);
			}
		}

		contentEl.empty();
	}

	/**
	 * Gather current form data for persistence
	 */
	private gatherFormData(): PlaceFormData {
		return {
			name: this.placeData.name,
			placeCategory: this.placeData.placeCategory,
			placeType: this.placeData.placeType,
			universe: this.placeData.universe,
			parentPlaceId: this.placeData.parentPlaceId,
			parentPlace: this.placeData.parentPlace,
			aliases: this.placeData.aliases,
			collection: this.placeData.collection,
			coordinates: this.placeData.coordinates,
			directory: this.directory
		};
	}

	/**
	 * Restore form state from persisted data
	 */
	private restoreFromPersistedState(formData: PlaceFormData): void {
		this.placeData.name = formData.name || '';
		this.placeData.placeCategory = formData.placeCategory;
		this.placeData.placeType = formData.placeType as PlaceType | undefined;
		this.placeData.universe = formData.universe;
		this.placeData.parentPlaceId = formData.parentPlaceId;
		this.placeData.parentPlace = formData.parentPlace;
		this.placeData.aliases = formData.aliases;
		this.placeData.collection = formData.collection;
		this.placeData.coordinates = formData.coordinates;
		if (formData.directory) {
			this.directory = formData.directory;
		}
	}

	/**
	 * Populate the parent place dropdown with options
	 * Optionally filters by selected place type
	 */
	private populateParentDropdown(selectEl: HTMLSelectElement, filterByType?: string): void {
		// Clear existing options
		selectEl.empty();

		// Add default options
		selectEl.createEl('option', { value: '', text: '(None)' });
		selectEl.createEl('option', { value: '__custom__', text: '+ Enter manually...' });

		// Get filtered options
		const filteredOptions = this.getFilteredParentOptions(filterByType);

		if (filteredOptions.length === 0 && filterByType) {
			// Show message if no valid parents for this type
			const noOptionsEl = selectEl.createEl('option', {
				value: '__no_options__',
				text: `── No valid parent types for ${filterByType} ──`
			});
			noOptionsEl.disabled = true;
			return;
		}

		// Group filtered options by type
		const groupedOptions = new Map<string, ParentPlaceOption[]>();
		for (const opt of filteredOptions) {
			const typeName = this.formatPlaceType(opt.placeType || 'other');
			if (!groupedOptions.has(typeName)) {
				groupedOptions.set(typeName, []);
			}
			groupedOptions.get(typeName)!.push(opt);
		}

		// Add options grouped by type
		for (const [typeName, options] of groupedOptions.entries()) {
			// Add optgroup-like separator
			const groupHeader = selectEl.createEl('option', {
				value: `__group_${typeName}`,
				text: `── ${typeName} ──`
			});
			groupHeader.disabled = true;

			for (const opt of options) {
				// Show hierarchy path in dropdown for context
				const displayName = opt.path !== opt.name
					? `  ${opt.name} (${opt.path})`
					: `  ${opt.name}`;
				selectEl.createEl('option', { value: opt.id, text: displayName });
			}
		}
	}

	/**
	 * Get parent place options filtered by the selected place type
	 * Returns only places that are higher in the hierarchy than the selected type
	 */
	private getFilteredParentOptions(selectedType?: string): ParentPlaceOption[] {
		if (!selectedType) {
			// No type selected, show all options
			return this.allParentOptions;
		}

		const selectedLevel = PLACE_TYPE_HIERARCHY[selectedType] ?? 99;

		// Filter to only show places that are higher in the hierarchy (smaller number)
		// A city (7) can have country (2), state (3), region (4), county (5), district (6) as parents
		// but not another city (7), town (8), village (9), etc.
		return this.allParentOptions.filter(opt => {
			const optLevel = PLACE_TYPE_HIERARCHY[opt.placeType || 'other'] ?? 99;
			return optLevel < selectedLevel;
		});
	}

	/**
	 * Update the parent place dropdown based on selected place type
	 */
	private updateParentPlaceDropdown(): void {
		if (!this.parentDropdownEl) return;

		const selectedType = this.placeData.placeType;
		const currentValue = this.placeData.parentPlaceId || '';

		// Repopulate dropdown with filtered options
		this.populateParentDropdown(this.parentDropdownEl, selectedType);

		// Try to restore the previous selection if it's still valid
		const isValidOption = Array.from(this.parentDropdownEl.options).some(
			opt => opt.value === currentValue && !opt.disabled
		);

		if (isValidOption) {
			this.parentDropdownEl.value = currentValue;
		} else {
			// Clear selection if the previous parent is no longer valid
			this.parentDropdownEl.value = '';
			this.placeData.parentPlaceId = undefined;
			this.placeData.parentPlace = undefined;
		}
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
	 * Look up coordinates using geocoding service (Nominatim)
	 * Uses OpenStreetMap's Nominatim API for free geocoding
	 *
	 * For hierarchical place names (e.g., "Newport, Orleans, Vermont, USA"),
	 * tries multiple search strategies:
	 * 1. Full hierarchical string as-is
	 * 2. First component with remaining parts as context
	 */
	private async lookupCoordinates(): Promise<void> {
		const placeName = this.placeData.name?.trim();

		if (!placeName) {
			new Notice('Please enter a place name first');
			return;
		}

		const geocodingService = new GeocodingService(this.app);
		const isHierarchicalName = placeName.includes(',');

		new Notice(`Looking up coordinates for "${placeName}"...`);

		// Strategy 1: Try the full name as-is (works well for simple names or well-formatted hierarchical names)
		let result = await geocodingService.geocodeSingle(
			placeName,
			isHierarchicalName ? undefined : this.placeData.parentPlace
		);

		// Strategy 2: For hierarchical names, if Strategy 1 failed, try first component + rest as context
		if (!result.success && isHierarchicalName) {
			const parts = placeName.split(',').map(p => p.trim());
			if (parts.length >= 2) {
				const firstPart = parts[0];
				const contextParts = parts.slice(1).join(', ');
				result = await geocodingService.geocodeSingle(firstPart, contextParts);
			}
		}

		if (result.success && result.coordinates) {
			// Update the data model
			this.placeData.coordinates = result.coordinates;

			// Update the input fields
			if (this.latInputEl) {
				this.latInputEl.value = result.coordinates.lat.toFixed(6);
			}
			if (this.longInputEl) {
				this.longInputEl.value = result.coordinates.long.toFixed(6);
			}

			new Notice(`Found: ${result.displayName}\nCoordinates: ${result.coordinates.lat.toFixed(4)}, ${result.coordinates.long.toFixed(4)}`);
		} else {
			new Notice(`No coordinates found for "${placeName}". ${result.error || 'Try a more specific name.'}`);
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
				openAfterCreate: true,
				propertyAliases: this.settings?.propertyAliases || {}
			});

			new Notice(`Created place note: ${file.basename}`);

			// Mark as saved successfully and clear persisted state
			this.savedSuccessfully = true;
			if (this.persistence) {
				void this.persistence.clear();
			}

			if (this.onCreated) {
				this.onCreated(file);
			}

			// Check if we need to create a parent place
			const missingParent = this.checkForMissingParent();

			this.close();

			// Open modal for parent creation if needed
			if (missingParent) {
				this.openParentCreationModal(missingParent);
			}
		} catch (error) {
			console.error('Failed to create place note:', error);
			new Notice(`Failed to create place note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check if the user specified a parent place that doesn't exist
	 * Returns the parent place name if it needs to be created, undefined otherwise
	 */
	private checkForMissingParent(): string | undefined {
		// If user selected an existing parent from dropdown, no need to create
		if (this.placeData.parentPlaceId) {
			return undefined;
		}

		// If no parent was specified, nothing to create
		if (!this.pendingParentPlace) {
			return undefined;
		}

		// Clean up the parent name (remove wikilinks if present)
		const parentName = this.pendingParentPlace
			.replace(/\[\[/g, '')
			.replace(/\]\]/g, '')
			.trim();

		if (!parentName) {
			return undefined;
		}

		// Check if this place already exists
		if (this.placeGraph) {
			const existingPlace = this.placeGraph.getPlaceByName(parentName);
			if (existingPlace) {
				return undefined; // Parent already exists
			}
		}

		return parentName;
	}

	/**
	 * Open a new CreatePlaceModal for the parent place
	 */
	private openParentCreationModal(parentName: string): void {
		// Show notice about the missing parent
		new Notice(`Parent place "${parentName}" doesn't exist. Opening dialog to create it...`);

		// Suggest a type for the parent based on the child's type
		const suggestedType = suggestParentType(this.placeData.placeType);

		// Small delay to let the current modal fully close
		setTimeout(() => {
			new CreatePlaceModal(this.app, {
				directory: this.directory,
				initialName: parentName,
				initialPlaceType: suggestedType,
				familyGraph: this.familyGraph,
				placeGraph: this.placeGraph,
				settings: this.settings,
				plugin: this.plugin,
				onCreated: (file) => {
					new Notice(`Created parent place: ${file.basename}`);
				}
			}).open();
		}, 100);
	}

	/**
	 * Update the existing place note
	 */
	private async updatePlace(): Promise<void> {
		// Validate required fields
		if (!this.placeData.name.trim()) {
			new Notice('Please enter a name for the place');
			return;
		}

		if (!this.editingFile) {
			new Notice('No file to update');
			return;
		}

		try {
			await updatePlaceNote(this.app, this.editingFile, this.placeData);

			new Notice(`Updated place note: ${this.editingFile.basename}`);

			if (this.onUpdated) {
				this.onUpdated(this.editingFile);
			}

			this.close();
		} catch (error) {
			console.error('Failed to update place note:', error);
			new Notice(`Failed to update place note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
