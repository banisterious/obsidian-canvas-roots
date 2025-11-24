import { Plugin, Notice, TFile, TFolder, Menu, Platform, Modal, EventRef } from 'obsidian';
import { CanvasRootsSettings, DEFAULT_SETTINGS, CanvasRootsSettingTab } from './src/settings';
import { ControlCenterModal } from './src/ui/control-center';
import { RegenerateOptionsModal } from './src/ui/regenerate-options-modal';
import { TreeStatisticsModal } from './src/ui/tree-statistics-modal';
import { PersonPickerModal } from './src/ui/person-picker';
import { RelationshipManager } from './src/core/relationship-manager';
import { RelationshipValidator } from './src/core/relationship-validator';
import { ValidationResultsModal } from './src/ui/validation-results-modal';
import { FindOnCanvasModal } from './src/ui/find-on-canvas-modal';
import { FolderScanModal } from './src/ui/folder-scan-modal';
import { LoggerFactory, getLogger } from './src/core/logging';
import { FamilyGraphService } from './src/core/family-graph';
import { CanvasGenerator } from './src/core/canvas-generator';
import { BASE_TEMPLATE } from './src/constants/base-template';
import { ExcalidrawExporter } from './src/excalidraw/excalidraw-exporter';
import { BidirectionalLinker } from './src/core/bidirectional-linker';
import { generateCrId } from './src/core/uuid';

const logger = getLogger('CanvasRootsPlugin');

export default class CanvasRootsPlugin extends Plugin {
	settings: CanvasRootsSettings;
	private fileModifyEventRef: EventRef | null = null;
	private bidirectionalLinker: BidirectionalLinker | null = null;

	async onload() {
		console.log('Loading Canvas Roots plugin');

		await this.loadSettings();

		// Initialize logger with saved log level
		LoggerFactory.setLogLevel(this.settings.logLevel);

		// Run migration for property rename (collection_name -> group_name)
		this.migrateCollectionNameToGroupName();

		// Add settings tab
		this.addSettingTab(new CanvasRootsSettingTab(this.app, this));

		// Add ribbon icon for Control Center
		this.addRibbonIcon('users', 'Open Canvas Roots Control Center', () => {
			new ControlCenterModal(this.app, this).open();
		});

		// Add command: Open Control Center
		this.addCommand({
			id: 'open-control-center',
			name: 'Open control center',
			callback: () => {
				new ControlCenterModal(this.app, this).open();
			}
		});

		// Add command: Generate Tree for Current Note
		this.addCommand({
			id: 'generate-tree-for-current-note',
			name: 'Generate tree for current note',
			callback: () => {
				this.generateTreeForCurrentNote();
			}
		});

		// Add command: Regenerate Canvas
		this.addCommand({
			id: 'regenerate-canvas',
			name: 'Regenerate canvas',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();

				if (!activeFile || activeFile.extension !== 'canvas') {
					new Notice('No active canvas. Please open a canvas file first.');
					return;
				}

				// Show options modal
				new RegenerateOptionsModal(this.app, this, activeFile).open();
			}
		});

		// Add command: Create Person Note
		this.addCommand({
			id: 'create-person-note',
			name: 'Create person note',
			callback: () => {
				this.createPersonNote();
			}
		});

		// Add command: Generate All Trees (for multi-family vaults)
		this.addCommand({
			id: 'generate-all-trees',
			name: 'Generate all trees',
			callback: () => {
				this.generateAllTrees();
			}
		});

		// Add command: Create Base Template
		this.addCommand({
			id: 'create-base-template',
			name: 'Create Base template',
			callback: () => {
				this.createBaseTemplate();
			}
		});

		// Add context menu items for person notes, canvas files, and folders
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				// Only show submenus on desktop (mobile doesn't support them)
				const useSubmenu = Platform.isDesktop && !Platform.isMobile;

				// Canvas files: Regenerate canvas
				if (file instanceof TFile && file.extension === 'canvas') {
					menu.addSeparator();

					if (useSubmenu) {
						menu.addItem((item) => {
							const submenu: Menu = item
								.setTitle('Canvas Roots')
								.setIcon('git-fork')
								.setSubmenu();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Regenerate canvas')
									.setIcon('refresh-cw')
									.onClick(async () => {
										// Open the canvas file first
										const leaf = this.app.workspace.getLeaf(false);
										await leaf.openFile(file);

										// Give canvas a moment to load
										await new Promise(resolve => setTimeout(resolve, 100));

										// Show options modal
										new RegenerateOptionsModal(this.app, this, file).open();
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Show tree statistics')
									.setIcon('bar-chart')
									.onClick(async () => {
										new TreeStatisticsModal(this.app, file).open();
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Customize canvas styles')
									.setIcon('layout')
									.onClick(async () => {
										const { CanvasStyleModal } = await import('./src/ui/canvas-style-modal');
										new CanvasStyleModal(this.app, this, file).open();
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Export to Excalidraw')
									.setIcon('pencil')
									.onClick(async () => {
										await this.exportCanvasToExcalidraw(file);
									});
							});

							submenu.addSeparator();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('More options...')
									.setIcon('settings')
									.onClick(() => {
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('tree-generation');
									});
							});
						});
					} else {
						// Mobile: flat menu with prefix
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Regenerate canvas')
								.setIcon('refresh-cw')
								.onClick(async () => {
									const leaf = this.app.workspace.getLeaf(false);
									await leaf.openFile(file);
									await new Promise(resolve => setTimeout(resolve, 100));
									new RegenerateOptionsModal(this.app, this, file).open();
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Show tree statistics')
								.setIcon('bar-chart')
								.onClick(async () => {
									new TreeStatisticsModal(this.app, file).open();
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Customize canvas styles')
								.setIcon('layout')
								.onClick(async () => {
									const { CanvasStyleModal } = await import('./src/ui/canvas-style-modal');
									new CanvasStyleModal(this.app, this, file).open();
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export to Excalidraw')
								.setIcon('pencil')
								.onClick(async () => {
									await this.exportCanvasToExcalidraw(file);
								});
						});
					}
				}

				// Person notes: Generate family tree
				if (file instanceof TFile && file.extension === 'md') {
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter?.cr_id) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('git-fork')
									.setSubmenu();

								// Generate tree submenu
								const generateTreeSubmenu = submenu.addItem((subItem) => {
									return subItem
										.setTitle('Generate tree')
										.setIcon('git-fork')
										.setSubmenu();
								});

								generateTreeSubmenu.addItem((genItem) => {
									genItem
										.setTitle('Generate Canvas tree')
										.setIcon('layout')
										.onClick(async () => {
											const modal = new ControlCenterModal(this.app, this);
											await modal.openWithPerson(file);
										});
								});

								generateTreeSubmenu.addItem((genItem) => {
									genItem
										.setTitle('Generate Excalidraw tree')
										.setIcon('pencil')
										.onClick(async () => {
											await this.generateExcalidrawTreeForPerson(file);
										});
								});

								submenu.addSeparator();

								submenu.addItem((subItem) => {
									subItem
										.setTitle('More options...')
										.setIcon('settings')
										.onClick(async () => {
											const modal = new ControlCenterModal(this.app, this);
											await modal.openWithPerson(file);
										});
								});

								submenu.addSeparator();

								// Add relationship submenu
								const relationshipSubmenu = submenu.addItem((subItem) => {
									return subItem
										.setTitle('Add relationship...')
										.setIcon('user-plus')
										.setSubmenu();
								});

								relationshipSubmenu.addItem((relItem) => {
									relItem
										.setTitle('Add parent')
										.setIcon('user')
										.onClick(() => {
											const picker = new PersonPickerModal(this.app, async (selectedPerson) => {
												const relationshipMgr = new RelationshipManager(this.app);

												// Ask which parent type
												const parentType = await this.promptParentType();
												if (parentType) {
													await relationshipMgr.addParentRelationship(
														file,
														selectedPerson.file,
														parentType
													);
												}
											});
											picker.open();
										});
								});

								relationshipSubmenu.addItem((relItem) => {
									relItem
										.setTitle('Add spouse')
										.setIcon('heart')
										.onClick(() => {
											const picker = new PersonPickerModal(this.app, async (selectedPerson) => {
												const relationshipMgr = new RelationshipManager(this.app);
												await relationshipMgr.addSpouseRelationship(file, selectedPerson.file);
											});
											picker.open();
										});
								});

								relationshipSubmenu.addItem((relItem) => {
									relItem
										.setTitle('Add child')
										.setIcon('baby')
										.onClick(() => {
											const picker = new PersonPickerModal(this.app, async (selectedPerson) => {
												const relationshipMgr = new RelationshipManager(this.app);
												await relationshipMgr.addChildRelationship(file, selectedPerson.file);
											});
											picker.open();
										});
								});

								// Validate relationships
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Validate relationships')
										.setIcon('shield-check')
										.onClick(async () => {
											const validator = new RelationshipValidator(this.app);
											const result = await validator.validatePersonNote(file);
											new ValidationResultsModal(this.app, result).open();
										});
								});

								// Find on canvas
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Find on canvas')
										.setIcon('search')
										.onClick(async () => {
											const cache = this.app.metadataCache.getFileCache(file);
											const crId = cache?.frontmatter?.cr_id;
											const personName = cache?.frontmatter?.name || file.basename;
											if (crId) {
												new FindOnCanvasModal(this.app, personName, crId).open();
											}
										});
								});

								// Set group name
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Set group name')
										.setIcon('tag')
										.onClick(async () => {
											await this.promptSetCollectionName(file);
										});
								});

								// Set collection
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Set collection')
										.setIcon('folder')
										.onClick(async () => {
											await this.promptSetCollection(file);
										});
								});

								// Mark as root person
								submenu.addItem((subItem) => {
									const cache = this.app.metadataCache.getFileCache(file);
									const isRootPerson = cache?.frontmatter?.root_person === true;
									subItem
										.setTitle(isRootPerson ? 'Unmark as root person' : 'Mark as root person')
										.setIcon('crown')
										.onClick(async () => {
											await this.toggleRootPerson(file);
										});
								});
							});
						} else {
							// Mobile: flat menu with prefix
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Generate family tree')
									.setIcon('git-fork')
									.onClick(async () => {
										const modal = new ControlCenterModal(this.app, this);
										await modal.openWithPerson(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add parent')
									.setIcon('user')
									.onClick(() => {
										const picker = new PersonPickerModal(this.app, async (selectedPerson) => {
											const relationshipMgr = new RelationshipManager(this.app);
											const parentType = await this.promptParentType();
											if (parentType) {
												await relationshipMgr.addParentRelationship(
													file,
													selectedPerson.file,
													parentType
												);
											}
										});
										picker.open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add spouse')
									.setIcon('heart')
									.onClick(() => {
										const picker = new PersonPickerModal(this.app, async (selectedPerson) => {
											const relationshipMgr = new RelationshipManager(this.app);
											await relationshipMgr.addSpouseRelationship(file, selectedPerson.file);
										});
										picker.open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add child')
									.setIcon('baby')
									.onClick(() => {
										const picker = new PersonPickerModal(this.app, async (selectedPerson) => {
											const relationshipMgr = new RelationshipManager(this.app);
											await relationshipMgr.addChildRelationship(file, selectedPerson.file);
										});
										picker.open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Validate relationships')
									.setIcon('shield-check')
									.onClick(async () => {
										const validator = new RelationshipValidator(this.app);
										const result = await validator.validatePersonNote(file);
										new ValidationResultsModal(this.app, result).open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Find on canvas')
									.setIcon('search')
									.onClick(async () => {
										const cache = this.app.metadataCache.getFileCache(file);
										const crId = cache?.frontmatter?.cr_id;
										const personName = cache?.frontmatter?.name || file.basename;
										if (crId) {
											new FindOnCanvasModal(this.app, personName, crId).open();
										}
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Set group name')
									.setIcon('tag')
									.onClick(async () => {
										await this.promptSetCollectionName(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Set collection')
									.setIcon('folder')
									.onClick(async () => {
										await this.promptSetCollection(file);
									});
							});

							menu.addItem((item) => {
								const cache = this.app.metadataCache.getFileCache(file);
								const isRootPerson = cache?.frontmatter?.root_person === true;
								item
									.setTitle(isRootPerson ? 'Canvas Roots: Unmark as root person' : 'Canvas Roots: Mark as root person')
									.setIcon('crown')
									.onClick(async () => {
										await this.toggleRootPerson(file);
									});
							});
						}
					}

					// Add essential properties option for ALL markdown files
					// (appears outside the cr_id check so it works on blank notes too)
					const fileCache = this.app.metadataCache.getFileCache(file);
					const frontmatter = fileCache?.frontmatter || {};

					// Check if all essential properties exist
					// Note: Relationships can be stored as wikilinks OR _id properties (dual storage)
					const hasAllProperties =
						frontmatter.cr_id &&
						frontmatter.name &&
						('born' in frontmatter) &&
						('died' in frontmatter) &&
						(('father' in frontmatter) || ('father_id' in frontmatter)) &&
						(('mother' in frontmatter) || ('mother_id' in frontmatter)) &&
						(('spouses' in frontmatter) || ('spouse' in frontmatter) || ('spouse_id' in frontmatter)) &&
						(('children' in frontmatter) || ('children_id' in frontmatter)) &&
						('group_name' in frontmatter);

					// Only show if missing some properties
					if (!hasAllProperties) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential properties')
									.setIcon('file-plus')
									.onClick(async () => {
										await this.addEssentialProperties([file]);
									});
							});
						} else {
							// Mobile
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential properties')
									.setIcon('file-plus')
									.onClick(async () => {
										await this.addEssentialProperties([file]);
									});
							});
						}
					}
				}

				// Folders: Set as people folder
				if (file instanceof TFolder) {
					menu.addSeparator();

					if (useSubmenu) {
						menu.addItem((item) => {
							const submenu: Menu = item
								.setTitle('Canvas Roots')
								.setIcon('git-fork')
								.setSubmenu();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Set as people folder')
									.setIcon('users')
									.onClick(async () => {
										this.settings.peopleFolder = file.path;
										await this.saveSettings();
										new Notice(`People folder set to: ${file.path}`);
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Import GEDCOM to this folder')
									.setIcon('upload')
									.onClick(async () => {
										// Set this folder as the people folder
										this.settings.peopleFolder = file.path;
										await this.saveSettings();

										// Open Control Center to GEDCOM tab
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('gedcom');
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Export GEDCOM from this folder')
									.setIcon('download')
									.onClick(async () => {
										// Set this folder as the people folder temporarily for export
										const originalFolder = this.settings.peopleFolder;
										this.settings.peopleFolder = file.path;

										// Open Control Center to GEDCOM tab
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('gedcom');

										// Restore original folder (without saving)
										this.settings.peopleFolder = originalFolder;
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Scan for relationship issues')
									.setIcon('shield-alert')
									.onClick(async () => {
										new FolderScanModal(this.app, file).open();
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('New base from template')
									.setIcon('table')
									.onClick(async () => {
										await this.createBaseTemplate(file);
									});
							});
						});
					} else {
						// Mobile: flat menu with prefix
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Set as people folder')
								.setIcon('users')
								.onClick(async () => {
									this.settings.peopleFolder = file.path;
									await this.saveSettings();
									new Notice(`People folder set to: ${file.path}`);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Import GEDCOM to this folder')
								.setIcon('upload')
								.onClick(async () => {
									// Set this folder as the people folder
									this.settings.peopleFolder = file.path;
									await this.saveSettings();

									// Open Control Center to GEDCOM tab
									const modal = new ControlCenterModal(this.app, this);
									modal.openToTab('gedcom');
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export GEDCOM from this folder')
								.setIcon('download')
								.onClick(async () => {
									// Set this folder as the people folder temporarily for export
									const originalFolder = this.settings.peopleFolder;
									this.settings.peopleFolder = file.path;

									// Open Control Center to GEDCOM tab
									const modal = new ControlCenterModal(this.app, this);
									modal.openToTab('gedcom');

									// Restore original folder (without saving)
									this.settings.peopleFolder = originalFolder;
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Scan for relationship issues')
								.setIcon('shield-alert')
								.onClick(async () => {
									new FolderScanModal(this.app, file).open();
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: New base from template')
								.setIcon('table')
								.onClick(async () => {
									await this.createBaseTemplate(file);
								});
						});
					}
				}
			})
		);

		// Add context menu for multi-file selections
		this.registerEvent(
			this.app.workspace.on('files-menu', (menu, files) => {
				// Only show for multiple markdown files
				const markdownFiles = files.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];

				if (markdownFiles.length === 0) return;

				// Check if any files are missing essential properties
				let hasMissingProperties = false;
				for (const file of markdownFiles) {
					const fileCache = this.app.metadataCache.getFileCache(file);
					const frontmatter = fileCache?.frontmatter || {};

					// Check if all essential properties exist (accounting for dual storage)
					const hasAllProperties =
						frontmatter.cr_id &&
						frontmatter.name &&
						('born' in frontmatter) &&
						('died' in frontmatter) &&
						(('father' in frontmatter) || ('father_id' in frontmatter)) &&
						(('mother' in frontmatter) || ('mother_id' in frontmatter)) &&
						(('spouses' in frontmatter) || ('spouse' in frontmatter) || ('spouse_id' in frontmatter)) &&
						(('children' in frontmatter) || ('children_id' in frontmatter)) &&
						('group_name' in frontmatter);

					if (!hasAllProperties) {
						hasMissingProperties = true;
						break;
					}
				}

				// Only show menu item if at least one file is missing properties
				if (hasMissingProperties) {
					menu.addSeparator();
					menu.addItem((item) => {
						item
							.setTitle(`Canvas Roots: Add essential properties (${markdownFiles.length} files)`)
							.setIcon('file-plus')
							.onClick(async () => {
								await this.addEssentialProperties(markdownFiles);
							});
					});
				}
			})
		);

		// Register file modification handler for bidirectional sync
		this.registerFileModificationHandler();

		// Initialize bidirectional relationship snapshots
		// This enables deletion detection from the first edit after plugin load
		if (this.settings.enableBidirectionalSync) {
			this.initializeBidirectionalSnapshots();
		}
	}

	/**
	 * Initialize bidirectional relationship snapshots for all person notes
	 * Runs asynchronously after a short delay to avoid blocking plugin startup
	 */
	private initializeBidirectionalSnapshots() {
		// Create the shared bidirectional linker instance
		if (!this.bidirectionalLinker) {
			this.bidirectionalLinker = new BidirectionalLinker(this.app);
		}

		// Run after a 1-second delay to not impact plugin load performance
		setTimeout(async () => {
			try {
				await this.bidirectionalLinker!.initializeSnapshots();
			} catch (error) {
				logger.error('snapshot-init', 'Failed to initialize relationship snapshots', {
					error: error.message
				});
			}
		}, 1000);
	}

	/**
	 * Register event handler for file modifications to auto-sync relationships
	 */
	private registerFileModificationHandler() {
		// Unregister existing handler if present
		if (this.fileModifyEventRef) {
			this.app.metadataCache.offref(this.fileModifyEventRef);
			this.fileModifyEventRef = null;
		}

		// Register new handler if sync is enabled
		if (this.settings.enableBidirectionalSync && this.settings.syncOnFileModify) {
			logger.debug('file-watcher', 'Registering file modification handler for bidirectional sync');

			this.fileModifyEventRef = this.app.metadataCache.on('changed', async (file: TFile) => {
				// Only process markdown files
				if (file.extension !== 'md') {
					return;
				}

				// Only process files with cr_id (person notes)
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter?.cr_id) {
					return;
				}

				logger.debug('file-watcher', 'Person note modified, syncing relationships', {
					file: file.path
				});

				// Sync relationships for this file
				try {
					// Create shared instance if not exists
					if (!this.bidirectionalLinker) {
						this.bidirectionalLinker = new BidirectionalLinker(this.app);
					}
					await this.bidirectionalLinker.syncRelationships(file);
				} catch (error) {
					logger.error('file-watcher', 'Failed to sync relationships on file modify', {
						file: file.path,
						error: error.message
					});
				}
			});

			this.registerEvent(this.fileModifyEventRef);
		}
	}

	async onunload() {
		console.log('Unloading Canvas Roots plugin');

		// Clean up event handlers
		if (this.fileModifyEventRef) {
			this.app.metadataCache.offref(this.fileModifyEventRef);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Prompt user to select parent type (father or mother)
	 * Returns 'father', 'mother', or null if cancelled
	 */
	private async promptParentType(): Promise<'father' | 'mother' | null> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Select parent type');

			modal.contentEl.createEl('p', {
				text: 'Is this person the father or mother?'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
			buttonContainer.style.display = 'flex';
			buttonContainer.style.gap = '8px';
			buttonContainer.style.justifyContent = 'flex-end';
			buttonContainer.style.marginTop = '16px';

			const fatherBtn = buttonContainer.createEl('button', {
				text: 'Father',
				cls: 'mod-cta'
			});
			fatherBtn.addEventListener('click', () => {
				modal.close();
				resolve('father');
			});

			const motherBtn = buttonContainer.createEl('button', {
				text: 'Mother',
				cls: 'mod-cta'
			});
			motherBtn.addEventListener('click', () => {
				modal.close();
				resolve('mother');
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(null);
			});

			modal.open();
		});
	}

	private async promptSetCollectionName(file: TFile): Promise<void> {
		// Get current group_name if it exists
		const cache = this.app.metadataCache.getFileCache(file);
		const currentCollectionName = cache?.frontmatter?.group_name || '';

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Set group name');

			modal.contentEl.createEl('p', {
				text: 'Enter a name for this connected group (family, faction, organization, etc.):'
			});

			const inputContainer = modal.contentEl.createDiv({ cls: 'setting-item-control' });
			const input = inputContainer.createEl('input', {
				type: 'text',
				placeholder: 'e.g., "Smith Family", "House Stark", "The Council"',
				value: currentCollectionName
			});
			input.style.width = '100%';
			input.style.marginTop = '8px';

			const helpText = modal.contentEl.createEl('p', {
				text: 'Leave empty to remove the group name.',
				cls: 'setting-item-description'
			});
			helpText.style.marginTop = '8px';
			helpText.style.fontSize = '0.9em';
			helpText.style.color = 'var(--text-muted)';

			const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
			buttonContainer.style.display = 'flex';
			buttonContainer.style.gap = '8px';
			buttonContainer.style.justifyContent = 'flex-end';
			buttonContainer.style.marginTop = '16px';

			const saveBtn = buttonContainer.createEl('button', {
				text: 'Save',
				cls: 'mod-cta'
			});
			saveBtn.addEventListener('click', async () => {
				const collectionName = input.value.trim();

				// Update or remove group_name in frontmatter
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					if (collectionName) {
						frontmatter.group_name = collectionName;
					} else {
						delete frontmatter.group_name;
					}
				});

				new Notice(collectionName
					? `Group name set to "${collectionName}"`
					: 'Group name removed'
				);

				modal.close();
				resolve();
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve();
			});

			// Allow Enter key to save
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				} else if (e.key === 'Escape') {
					cancelBtn.click();
				}
			});

			modal.open();

			// Focus the input
			setTimeout(() => {
				input.focus();
				input.select();
			}, 50);
		});
	}

	private async promptSetCollection(file: TFile): Promise<void> {
		// Get current collection if it exists
		const cache = this.app.metadataCache.getFileCache(file);
		const currentCollection = cache?.frontmatter?.collection || '';

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Set collection');

			modal.contentEl.createEl('p', {
				text: 'Enter a collection to organize this person (e.g., "Paternal Line", "House Stark", "1800s Branch"):'
			});

			const inputContainer = modal.contentEl.createDiv({ cls: 'setting-item-control' });
			const input = inputContainer.createEl('input', {
				type: 'text',
				placeholder: 'e.g., "Paternal Line", "Maternal Branch"',
				value: currentCollection
			});
			input.style.width = '100%';
			input.style.marginTop = '8px';

			const helpText = modal.contentEl.createEl('p', {
				text: 'Collections let you organize people across family groups. Leave empty to remove.',
				cls: 'setting-item-description'
			});
			helpText.style.marginTop = '8px';
			helpText.style.fontSize = '0.9em';
			helpText.style.color = 'var(--text-muted)';

			const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
			buttonContainer.style.display = 'flex';
			buttonContainer.style.gap = '8px';
			buttonContainer.style.justifyContent = 'flex-end';
			buttonContainer.style.marginTop = '16px';

			const saveBtn = buttonContainer.createEl('button', {
				text: 'Save',
				cls: 'mod-cta'
			});
			saveBtn.addEventListener('click', async () => {
				const collection = input.value.trim();

				// Update or remove collection in frontmatter
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					if (collection) {
						frontmatter.collection = collection;
					} else {
						delete frontmatter.collection;
					}
				});

				new Notice(collection
					? `Collection set to "${collection}"`
					: 'Collection removed'
				);

				modal.close();
				resolve();
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve();
			});

			// Allow Enter key to save
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				} else if (e.key === 'Escape') {
					cancelBtn.click();
				}
			});

			modal.open();

			// Focus the input
			setTimeout(() => {
				input.focus();
				input.select();
			}, 50);
		});
	}

	private async toggleRootPerson(file: TFile): Promise<void> {
		// Get current root_person status
		const cache = this.app.metadataCache.getFileCache(file);
		const isRootPerson = cache?.frontmatter?.root_person === true;

		// Toggle the root_person property
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (isRootPerson) {
				delete frontmatter.root_person;
			} else {
				frontmatter.root_person = true;
			}
		});

		new Notice(isRootPerson
			? 'Unmarked as root person'
			: 'Marked as root person'
		);
	}

	private async generateTreeForCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active note. Please open a person note first.');
			return;
		}

		// Check if the active file is a person note (has cr_id)
		const cache = this.app.metadataCache.getFileCache(activeFile);
		if (!cache?.frontmatter?.cr_id) {
			new Notice('Current note is not a person note (missing cr_id field)');
			return;
		}

		// Open Control Center with this person pre-selected
		const modal = new ControlCenterModal(this.app, this);
		await modal.openWithPerson(activeFile);
	}

	async regenerateCanvas(canvasFile: TFile, direction?: 'vertical' | 'horizontal') {
		try {
			new Notice('Regenerating canvas...');

			// 1. Read current Canvas JSON
			const canvasContent = await this.app.vault.read(canvasFile);
			const canvasData = JSON.parse(canvasContent);

			if (!canvasData.nodes || canvasData.nodes.length === 0) {
				new Notice('Canvas is empty - nothing to regenerate');
				return;
			}

			// 2. Try to read original generation metadata from canvas
			const storedMetadata = canvasData.metadata?.frontmatter;
			const isCanvasRootsTree = storedMetadata?.plugin === 'canvas-roots';

			// 3. Extract person note nodes (file nodes only)
			const personNodes = canvasData.nodes.filter(
				(node: { type: string; file?: string }) =>
					node.type === 'file' && node.file?.endsWith('.md')
			);

			if (personNodes.length === 0) {
				new Notice('No person notes found in canvas');
				return;
			}

			// 4. Determine root person and tree parameters
			let rootCrId: string | undefined;
			let rootPersonName: string | undefined;
			let treeType: 'full' | 'ancestors' | 'descendants' = 'full';
			let maxGenerations: number | undefined;
			let includeSpouses: boolean = true;

			if (isCanvasRootsTree && storedMetadata.generation) {
				// Use stored metadata if available
				rootCrId = storedMetadata.generation.rootCrId;
				rootPersonName = storedMetadata.generation.rootPersonName;
				treeType = storedMetadata.generation.treeType;
				maxGenerations = storedMetadata.generation.maxGenerations || undefined;
				includeSpouses = storedMetadata.generation.includeSpouses;
			} else {
				// Fallback: find first node with cr_id
				for (const node of personNodes) {
					const file = this.app.vault.getAbstractFileByPath(node.file);
					if (file instanceof TFile) {
						const cache = this.app.metadataCache.getFileCache(file);
						if (cache?.frontmatter?.cr_id) {
							rootCrId = cache.frontmatter.cr_id;
							rootPersonName = file.basename;
							break;
						}
					}
				}

				if (!rootCrId || !rootPersonName) {
					new Notice('No person notes with cr_id found in canvas');
					return;
				}

				// Default to full tree for canvases without metadata
				treeType = 'full';
				maxGenerations = undefined;
				includeSpouses = true;
			}

			// Validate we have root person info before proceeding
			if (!rootCrId || !rootPersonName) {
				new Notice('No person notes with cr_id found in canvas');
				return;
			}

			// 5. Build family tree using original parameters
			const graphService = new FamilyGraphService(this.app);
			const familyTree = await graphService.generateTree({
				rootCrId,
				treeType,
				maxGenerations,
				includeSpouses
			});

			if (!familyTree) {
				new Notice('Failed to build family tree from canvas nodes');
				return;
			}

			// 6. Determine layout settings (prefer stored, fall back to current settings)
			const nodeWidth = storedMetadata?.layout?.nodeWidth ?? this.settings.defaultNodeWidth;
			const nodeHeight = storedMetadata?.layout?.nodeHeight ?? this.settings.defaultNodeHeight;
			const nodeSpacingX = storedMetadata?.layout?.nodeSpacingX ?? this.settings.horizontalSpacing;
			const nodeSpacingY = storedMetadata?.layout?.nodeSpacingY ?? this.settings.verticalSpacing;
			const originalDirection = storedMetadata?.generation?.direction ?? 'vertical';

			// 7. Recalculate layout preserving original parameters (except direction if user changed it)
			const canvasGenerator = new CanvasGenerator();

			// Convert plural tree type (from TreeOptions) to singular (for LayoutOptions)
			const layoutTreeType: 'ancestor' | 'descendant' | 'full' =
				treeType === 'ancestors' ? 'ancestor' :
				treeType === 'descendants' ? 'descendant' :
				'full';

			// Preserve style overrides from stored metadata if present
			const styleOverrides = storedMetadata?.styleOverrides;

			const newCanvasData = canvasGenerator.generateCanvas(familyTree, {
				nodeSpacingX,
				nodeSpacingY,
				nodeWidth,
				nodeHeight,
				direction: direction ?? originalDirection,
				treeType: layoutTreeType,
				nodeColorScheme: this.settings.nodeColorScheme,
				showLabels: true,
				useFamilyChartLayout: true,
				parentChildArrowStyle: this.settings.parentChildArrowStyle,
				spouseArrowStyle: this.settings.spouseArrowStyle,
				parentChildEdgeColor: this.settings.parentChildEdgeColor,
				spouseEdgeColor: this.settings.spouseEdgeColor,
				showSpouseEdges: this.settings.showSpouseEdges,
				spouseEdgeLabelFormat: this.settings.spouseEdgeLabelFormat,
				canvasRootsMetadata: {
					plugin: 'canvas-roots',
					generation: {
						rootCrId: rootCrId,
						rootPersonName: rootPersonName,
						treeType: treeType,
						maxGenerations: maxGenerations || 0,
						includeSpouses,
						direction: direction ?? originalDirection,
						timestamp: Date.now()
					},
					layout: {
						nodeWidth,
						nodeHeight,
						nodeSpacingX,
						nodeSpacingY
					},
					// Preserve style overrides during regeneration
					styleOverrides: styleOverrides
				}
			});

			// 6. Update Canvas JSON with new data (preserves any non-person nodes)
			const updatedCanvasData = {
				...canvasData,
				nodes: newCanvasData.nodes,
				edges: newCanvasData.edges,
				metadata: newCanvasData.metadata
			};

			// 7. Format and write back to Canvas file (using same formatting as Control Center)
			const formattedJson = this.formatCanvasJson(updatedCanvasData);
			await this.app.vault.modify(canvasFile, formattedJson);

			new Notice(`Canvas regenerated successfully! (${newCanvasData.nodes.length} people)`);
		} catch (error) {
			console.error('Error regenerating canvas:', error);
			new Notice('Failed to regenerate canvas. Check console for details.');
		}
	}

	/**
	 * Format canvas JSON to match Obsidian's exact format
	 * Uses tabs for structure and compact objects on single lines
	 */
	private formatCanvasJson(data: unknown): string {
		const canvasData = data as {
			nodes: Array<Record<string, unknown>>;
			edges: Array<Record<string, unknown>>;
			metadata?: Record<string, unknown>;
		};

		const lines: string[] = [];
		lines.push('{');

		// Nodes array
		lines.push('\t"nodes":[');
		canvasData.nodes.forEach((node, i) => {
			const isLast = i === canvasData.nodes.length - 1;
			const nodeStr = JSON.stringify(node);
			lines.push(`\t\t${nodeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t],');

		// Edges array
		lines.push('\t"edges":[');
		canvasData.edges.forEach((edge, i) => {
			const isLast = i === canvasData.edges.length - 1;
			const edgeStr = JSON.stringify(edge);
			lines.push(`\t\t${edgeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t],');

		// Metadata
		lines.push('\t"metadata":{');
		lines.push('\t\t"version":"1.0-1.0",');
		const frontmatter = canvasData.metadata?.frontmatter || {};
		lines.push(`\t\t"frontmatter":${JSON.stringify(frontmatter)}`);
		lines.push('\t}');

		lines.push('}');

		return lines.join('\n');
	}

	private createPersonNote() {
		// Open Control Center to the Data Entry tab
		const modal = new ControlCenterModal(this.app, this);
		modal.openToTab('data-entry');
	}

	private async generateAllTrees() {
		new Notice('Finding all family groups...');

		try {
			// Open Control Center to generate all trees
			const modal = new ControlCenterModal(this.app, this);
			await modal.openAndGenerateAllTrees();
		} catch (error) {
			console.error('Error generating all trees:', error);
			new Notice('Failed to generate all trees. Check console for details.');
		}
	}

	private async exportCanvasToExcalidraw(canvasFile: TFile) {
		try {
			new Notice('Exporting to Excalidraw...');

			// Initialize exporter
			const exporter = new ExcalidrawExporter(this.app);

			// Export canvas
			const result = await exporter.exportToExcalidraw({
				canvasFile,
				preserveColors: true,
				fontSize: 16,
				strokeWidth: 2
			});

			if (!result.success) {
				new Notice(`Export failed: ${result.errors.join(', ')}`);
				return;
			}

			// Save Excalidraw file
			const outputPath = `${canvasFile.parent?.path || ''}/${result.fileName}.excalidraw.md`;
			await this.app.vault.create(outputPath, result.excalidrawContent!);

			new Notice(`Exported ${result.elementsExported} elements to ${result.fileName}.excalidraw.md`);

			// Open the newly created file
			const excalidrawFile = this.app.vault.getAbstractFileByPath(outputPath);
			if (excalidrawFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(excalidrawFile);
			}
		} catch (error) {
			console.error('Error exporting to Excalidraw:', error);
			new Notice(`Failed to export to Excalidraw: ${error.message}`);
		}
	}

	/**
	 * Add essential properties to person note(s)
	 * Supports batch operations on multiple files
	 */
	private async addEssentialProperties(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					// Read current file content
					const content = await this.app.vault.read(file);
					const cache = this.app.metadataCache.getFileCache(file);

					// Check if file already has frontmatter
					const hasFrontmatter = content.startsWith('---');
					const existingFrontmatter = cache?.frontmatter || {};

					// Define essential properties
					const essentialProperties: Record<string, any> = {};

					// cr_id: Generate if missing
					if (!existingFrontmatter.cr_id) {
						essentialProperties.cr_id = generateCrId();
					}

					// name: Use filename if missing
					if (!existingFrontmatter.name) {
						essentialProperties.name = file.basename;
					}

					// born: Add as empty if missing
					if (!existingFrontmatter.born) {
						essentialProperties.born = '';
					}

					// died: Add as empty if missing
					if (!existingFrontmatter.died) {
						essentialProperties.died = '';
					}

					// father: Add as empty if missing
					if (!existingFrontmatter.father) {
						essentialProperties.father = '';
					}

					// mother: Add as empty if missing
					if (!existingFrontmatter.mother) {
						essentialProperties.mother = '';
					}

					// spouses: Add as empty array if missing
					if (!existingFrontmatter.spouses) {
						essentialProperties.spouses = [];
					}

					// children: Add as empty array if missing
					if (!existingFrontmatter.children) {
						essentialProperties.children = [];
					}

					// group_name: Add as empty if missing
					if (!existingFrontmatter.group_name) {
						essentialProperties.group_name = '';
					}

					// Skip if no properties to add
					if (Object.keys(essentialProperties).length === 0) {
						skippedCount++;
						continue;
					}

					// Build new frontmatter
					const newFrontmatter = { ...existingFrontmatter, ...essentialProperties };

					// Convert frontmatter to YAML string
					const yamlLines = ['---'];
					for (const [key, value] of Object.entries(newFrontmatter)) {
						if (Array.isArray(value)) {
							if (value.length === 0) {
								yamlLines.push(`${key}: []`);
							} else {
								yamlLines.push(`${key}:`);
								value.forEach(item => yamlLines.push(`  - ${item}`));
							}
						} else if (value === '') {
							yamlLines.push(`${key}: ""`);
						} else {
							yamlLines.push(`${key}: ${value}`);
						}
					}
					yamlLines.push('---');

					// Get body content (everything after frontmatter)
					let bodyContent = '';
					if (hasFrontmatter) {
						const endOfFrontmatter = content.indexOf('---', 3);
						if (endOfFrontmatter !== -1) {
							bodyContent = content.substring(endOfFrontmatter + 3).trim();
						}
					} else {
						bodyContent = content.trim();
					}

					// Construct new file content
					const newContent = yamlLines.join('\n') + '\n\n' + bodyContent;

					// Write back to file
					await this.app.vault.modify(file, newContent);
					processedCount++;

				} catch (error) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added essential properties');
				} else if (skippedCount === 1) {
					new Notice('File already has all essential properties');
				} else {
					new Notice('Failed to add essential properties');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already complete`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Essential properties: ${parts.join(', ')}`);
			}

		} catch (error) {
			console.error('Error adding essential properties:', error);
			new Notice('Failed to add essential properties');
		}
	}

	/**
	 * Generate an Excalidraw tree directly from a person note
	 * Uses default settings for quick generation
	 */
	private async generateExcalidrawTreeForPerson(personFile: TFile) {
		try {
			new Notice('Generating Excalidraw tree...');

			// Get person info from file metadata
			const cache = this.app.metadataCache.getFileCache(personFile);
			if (!cache?.frontmatter?.cr_id) {
				new Notice('Invalid person note: missing cr_id');
				return;
			}

			const rootCrId = cache.frontmatter.cr_id;
			const rootName = cache.frontmatter.name || personFile.basename;

			// Generate tree with default settings
			const graphService = new FamilyGraphService(this.app);
			const familyTree = await graphService.generateTree({
				rootCrId,
				treeType: 'full',
				maxGenerations: 5,
				includeSpouses: true
			});

			if (!familyTree) {
				new Notice('Failed to generate tree: root person not found');
				return;
			}

			// Generate canvas with default options
			const canvasGenerator = new CanvasGenerator();
			const canvasData = canvasGenerator.generateCanvas(familyTree, {
				direction: 'vertical',
				nodeSpacingX: 300,
				nodeSpacingY: 200,
				layoutType: this.settings.defaultLayoutType,
				nodeColorScheme: this.settings.nodeColorScheme,
				showLabels: true,
				useFamilyChartLayout: true,
				parentChildArrowStyle: this.settings.parentChildArrowStyle,
				spouseArrowStyle: this.settings.spouseArrowStyle,
				parentChildEdgeColor: this.settings.parentChildEdgeColor,
				spouseEdgeColor: this.settings.spouseEdgeColor,
				showSpouseEdges: this.settings.showSpouseEdges,
				spouseEdgeLabelFormat: this.settings.spouseEdgeLabelFormat
			});

			// Create temporary canvas file
			const tempCanvasName = `temp-${Date.now()}.canvas`;
			const tempCanvasPath = `${personFile.parent?.path || ''}/${tempCanvasName}`;
			const tempCanvasFile = await this.app.vault.create(tempCanvasPath, JSON.stringify(canvasData, null, '\t'));

			// Export to Excalidraw
			const exporter = new ExcalidrawExporter(this.app);
			const result = await exporter.exportToExcalidraw({
				canvasFile: tempCanvasFile,
				preserveColors: true,
				fontSize: 16,
				strokeWidth: 2
			});

			// Delete temporary canvas file
			await this.app.vault.delete(tempCanvasFile);

			if (!result.success) {
				new Notice(`Export failed: ${result.errors.join(', ')}`);
				return;
			}

			// Save Excalidraw file
			const outputFileName = `Family Tree - ${rootName}.excalidraw.md`;
			const outputPath = `${personFile.parent?.path || ''}/${outputFileName}`;

			// Check if file exists and create unique name if needed
			let finalPath = outputPath;
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(finalPath)) {
				finalPath = `${personFile.parent?.path || ''}/Family Tree - ${rootName} (${counter}).excalidraw.md`;
				counter++;
			}

			await this.app.vault.create(finalPath, result.excalidrawContent!);

			new Notice(`Generated Excalidraw tree with ${result.elementsExported} elements`);

			// Open the newly created file
			const excalidrawFile = this.app.vault.getAbstractFileByPath(finalPath);
			if (excalidrawFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(excalidrawFile);
			}
		} catch (error) {
			console.error('Error generating Excalidraw tree:', error);
			new Notice(`Failed to generate Excalidraw tree: ${error.message}`);
		}
	}

	private async createBaseTemplate(folder?: TFolder) {
		try {
			// Determine the target path
			const folderPath = folder ? folder.path + '/' : '';
			const defaultPath = folderPath + 'family-members.base';

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(defaultPath);
			if (existingFile) {
				new Notice(`Base template already exists at ${defaultPath}`);
				// Open the existing file
				if (existingFile instanceof TFile) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(existingFile);
				}
				return;
			}

			// Create the file with template content
			const file = await this.app.vault.create(defaultPath, BASE_TEMPLATE);

			new Notice('Base template created successfully!');

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error) {
			console.error('Error creating Base template:', error);
			new Notice('Failed to create Base template. Check console for details.');
		}
	}

	/**
	 * Migrate collection_name property to group_name
	 * Runs once on plugin load to ensure all person notes use the new property name
	 */
	private async migrateCollectionNameToGroupName() {
		try {
			const files = this.app.vault.getMarkdownFiles();
			let migratedCount = 0;

			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);

				// Check if this file has collection_name but not group_name
				if (cache?.frontmatter?.collection_name && !cache.frontmatter?.group_name) {
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// Copy collection_name to group_name
						frontmatter.group_name = frontmatter.collection_name;
						// Remove old property
						delete frontmatter.collection_name;
					});
					migratedCount++;
				}
			}

			if (migratedCount > 0) {
				logger.info('migration', `Migrated ${migratedCount} files from collection_name to group_name`);
			}
		} catch (error) {
			logger.error('migration', 'Error during collection_name to group_name migration', error);
		}
	}
}
