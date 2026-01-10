import { App, Modal, TFile } from 'obsidian';
import CanvasRootsPlugin from '../../main';

/**
 * Modal for selecting canvas regeneration options
 */
export class RegenerateOptionsModal extends Modal {
	plugin: CanvasRootsPlugin;
	canvasFile: TFile;
	private directionSelect?: HTMLSelectElement;

	constructor(app: App, plugin: CanvasRootsPlugin, canvasFile: TFile) {
		super(app);
		this.plugin = plugin;
		this.canvasFile = canvasFile;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-regenerate-options-modal');

		// Title
		contentEl.createEl('h2', {
			text: 'Regenerate canvas',
			cls: 'crc-modal-title'
		});

		// Try to read canvas metadata to show original settings
		let originalSettings: string | null = null;
		try {
			const canvasContent = await this.app.vault.read(this.canvasFile);
			const canvasData = JSON.parse(canvasContent);
			const metadata = canvasData.metadata?.frontmatter;

			if ((metadata?.plugin === 'charted-roots' || metadata?.plugin === 'canvas-roots') && metadata.generation) {
				const gen = metadata.generation;
				originalSettings = `Originally generated as "${gen.treeType}" tree from ${gen.rootPersonName} ` +
					`with direction: ${gen.direction}`;
			}
		} catch {
			// Ignore errors - we'll just not show original settings
		}

		// Description
		if (originalSettings) {
			contentEl.createEl('p', {
				text: originalSettings,
				cls: 'crc-text-muted'
			});
			contentEl.createEl('p', {
				text: 'Choose the new layout direction (other settings will be preserved):',
				cls: 'crc-text-muted'
			});
		} else {
			contentEl.createEl('p', {
				text: 'Choose the layout direction for this family tree canvas.',
				cls: 'crc-text-muted'
			});
		}

		// Direction selection
		const directionGroup = contentEl.createDiv({ cls: 'crc-form-group' });
		directionGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Tree direction'
		});

		this.directionSelect = directionGroup.createEl('select', {
			cls: 'crc-form-input'
		});

		[
			{ value: 'vertical', label: 'Vertical (top to bottom)' },
			{ value: 'horizontal', label: 'Horizontal (left to right)' }
		].forEach(option => {
			this.directionSelect!.createEl('option', {
				value: option.value,
				text: option.label
			});
		});

		// Set default to vertical
		this.directionSelect.value = 'vertical';

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const applyBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Regenerate'
		});
		applyBtn.addEventListener('click', () => {
			void (async () => {
				const direction = this.directionSelect!.value as 'vertical' | 'horizontal';
				this.close();
				// Call the plugin's regenerate method with the selected direction
				await this.plugin.regenerateCanvas(this.canvasFile, direction);
			})();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
