/**
 * Create/Edit Proof Summary Modal
 *
 * Modal for creating and editing proof summary notes that document
 * the reasoning chain for genealogical conclusions.
 */

import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import { createLucideIcon } from '../../ui/lucide-icons';
import { ProofSummaryService } from '../services/proof-summary-service';
import { SourcePickerModal } from './source-picker-modal';
import {
	PROOF_STATUS_LABELS,
	PROOF_CONFIDENCE_LABELS,
	EVIDENCE_SUPPORT_LABELS
} from '../types/proof-types';
import type {
	ProofStatus,
	ProofConfidence,
	ProofEvidence,
	ProofSummaryNote
} from '../types/proof-types';
import type { FactKey } from '../types/source-types';
import { FACT_KEYS, FACT_KEY_LABELS } from '../types/source-types';
import type CanvasRootsPlugin from '../../../main';

/**
 * Options for the proof modal
 */
export interface ProofModalOptions {
	/** Pre-fill with a subject person (wikilink) */
	subjectPerson?: string;
	/** Pre-fill with a fact type */
	factType?: FactKey;
	/** Callback on successful creation */
	onSuccess?: (file: TFile) => void;
	/** Callback on successful update */
	onUpdated?: (file: TFile) => void;
	/** Edit mode: existing proof note to edit */
	editProof?: ProofSummaryNote;
	/** Edit mode: file being edited */
	editFile?: TFile;
}

/**
 * Modal for creating or editing a proof summary note
 */
export class CreateProofModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private options: ProofModalOptions;
	private proofService: ProofSummaryService;

	// Edit mode state
	private editMode = false;
	private editingFile?: TFile;

	// Form state
	private title = '';
	private subjectPerson = '';
	private factType: FactKey = 'birth_date';
	private conclusion = '';
	private status: ProofStatus = 'draft';
	private confidence: ProofConfidence = 'possible';
	private evidence: ProofEvidence[] = [];

	// UI elements
	private evidenceContainer!: HTMLElement;

	constructor(app: App, plugin: CanvasRootsPlugin, options: ProofModalOptions = {}) {
		super(app);
		this.plugin = plugin;
		this.options = options;
		this.proofService = new ProofSummaryService(app, plugin.settings);

		// Check for edit mode
		if (options.editProof && options.editFile) {
			this.editMode = true;
			this.editingFile = options.editFile;
			const proof = options.editProof;
			this.title = proof.title;
			this.subjectPerson = proof.subjectPerson;
			this.factType = proof.factType;
			this.conclusion = proof.conclusion;
			this.status = proof.status;
			this.confidence = proof.confidence;
			this.evidence = [...proof.evidence]; // Clone array
		} else {
			// Create mode - apply pre-filled values
			if (options.subjectPerson) {
				this.subjectPerson = options.subjectPerson;
			}
			if (options.factType) {
				this.factType = options.factType;
			}
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('cr-create-proof-modal');

		this.createModalContent();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private createModalContent(): void {
		const { contentEl } = this;

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const headerTitle = header.createDiv({ cls: 'crc-modal-header__title' });
		const icon = createLucideIcon(this.editMode ? 'edit' : 'scale', 24);
		headerTitle.appendChild(icon);
		headerTitle.createSpan({ text: this.editMode ? 'Edit proof summary' : 'Create proof summary' });

		// Form container
		const form = contentEl.createDiv({ cls: 'crc-modal-form' });

		// Title
		new Setting(form)
			.setName('Title')
			.setDesc('A descriptive title for this proof summary')
			.addText(text => text
				.setPlaceholder('e.g., Birth date of John Smith')
				.setValue(this.title)
				.onChange(value => { this.title = value; })
			);

		// Subject Person (readonly in edit mode - can't change subject)
		const subjectSetting = new Setting(form)
			.setName('Subject person')
			.setDesc('The person this proof is about (wikilink)')
			.addText(text => {
				text.setPlaceholder('[[Person Name]]')
					.setValue(this.subjectPerson)
					.onChange(value => { this.subjectPerson = value; });
				if (this.editMode) {
					text.inputEl.readOnly = true;
					text.inputEl.addClass('crc-input--readonly');
				}
			});

		if (this.editMode) {
			subjectSetting.setDesc('The person this proof is about (cannot be changed)');
		}

		// Fact Type (readonly in edit mode)
		new Setting(form)
			.setName('Fact type')
			.setDesc(this.editMode ? 'Which fact this proof addresses (cannot be changed)' : 'Which fact this proof addresses')
			.addDropdown(dropdown => {
				for (const key of FACT_KEYS) {
					dropdown.addOption(key, FACT_KEY_LABELS[key]);
				}
				dropdown.setValue(this.factType);
				if (this.editMode) {
					dropdown.setDisabled(true);
				} else {
					dropdown.onChange(value => { this.factType = value as FactKey; });
				}
			});

		// Conclusion
		new Setting(form)
			.setName('Conclusion')
			.setDesc('The conclusion being proven')
			.addTextArea(textarea => textarea
				.setPlaceholder('State the conclusion clearly...')
				.setValue(this.conclusion)
				.onChange(value => { this.conclusion = value; })
			);

		// Status
		new Setting(form)
			.setName('Status')
			.setDesc('Current status of this proof')
			.addDropdown(dropdown => {
				for (const [key, info] of Object.entries(PROOF_STATUS_LABELS)) {
					dropdown.addOption(key, info.label);
				}
				dropdown.setValue(this.status);
				dropdown.onChange(value => { this.status = value as ProofStatus; });
			});

		// Confidence
		new Setting(form)
			.setName('Confidence')
			.setDesc('How confident are you in this conclusion?')
			.addDropdown(dropdown => {
				for (const [key, info] of Object.entries(PROOF_CONFIDENCE_LABELS)) {
					dropdown.addOption(key, info.label);
				}
				dropdown.setValue(this.confidence);
				dropdown.onChange(value => { this.confidence = value as ProofConfidence; });
			});

		// Evidence section
		const evidenceSection = form.createDiv({ cls: 'crc-proof-evidence-section' });
		const evidenceHeader = evidenceSection.createDiv({ cls: 'crc-proof-evidence-header' });
		evidenceHeader.createSpan({ text: 'Evidence' });

		const addEvidenceBtn = evidenceHeader.createEl('button', {
			cls: 'crc-btn crc-btn--small',
			text: 'Add source'
		});
		addEvidenceBtn.addEventListener('click', () => this.addEvidence());

		this.evidenceContainer = evidenceSection.createDiv({ cls: 'crc-proof-evidence-list' });
		this.renderEvidenceList();

		// Actions
		const actions = contentEl.createDiv({ cls: 'crc-modal-actions' });

		const cancelBtn = actions.createEl('button', { cls: 'crc-btn', text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = actions.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: this.editMode ? 'Save changes' : 'Create proof summary'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updateProof();
			} else {
				void this.createProof();
			}
		});
	}

	private renderEvidenceList(): void {
		this.evidenceContainer.empty();

		if (this.evidence.length === 0) {
			this.evidenceContainer.createDiv({
				cls: 'crc-proof-evidence-empty',
				text: 'No evidence added yet. Add sources to support your conclusion.'
			});
			return;
		}

		for (let i = 0; i < this.evidence.length; i++) {
			this.renderEvidenceItem(this.evidence[i], i);
		}
	}

	private renderEvidenceItem(ev: ProofEvidence, index: number): void {
		const item = this.evidenceContainer.createDiv({ cls: 'crc-proof-evidence-item' });

		// Source link
		const sourceRow = item.createDiv({ cls: 'crc-proof-evidence-source' });
		const sourceIcon = createLucideIcon('file-text', 14);
		sourceRow.appendChild(sourceIcon);
		sourceRow.createSpan({ text: ev.source });

		// Remove button
		const removeBtn = sourceRow.createEl('button', {
			cls: 'crc-btn crc-btn--icon crc-btn--danger',
			attr: { 'aria-label': 'Remove evidence' }
		});
		const removeIcon = createLucideIcon('x', 14);
		removeBtn.appendChild(removeIcon);
		removeBtn.addEventListener('click', () => {
			this.evidence.splice(index, 1);
			this.renderEvidenceList();
		});

		// Information field
		const infoRow = item.createDiv({ cls: 'crc-proof-evidence-info' });
		infoRow.createSpan({ cls: 'crc-proof-evidence-label', text: 'Information:' });
		const infoInput = infoRow.createEl('input', {
			type: 'text',
			cls: 'crc-form-input',
			placeholder: 'What does this source say?',
			value: ev.information
		});
		infoInput.addEventListener('input', () => {
			this.evidence[index].information = infoInput.value;
		});

		// Supports dropdown
		const supportsRow = item.createDiv({ cls: 'crc-proof-evidence-supports' });
		supportsRow.createSpan({ cls: 'crc-proof-evidence-label', text: 'Support level:' });
		const supportsSelect = supportsRow.createEl('select', { cls: 'crc-form-select' });

		for (const [key, info] of Object.entries(EVIDENCE_SUPPORT_LABELS)) {
			const option = supportsSelect.createEl('option', {
				value: key,
				text: info.label
			});
			if (key === ev.supports) {
				option.selected = true;
			}
		}

		supportsSelect.addEventListener('change', () => {
			this.evidence[index].supports = supportsSelect.value as ProofEvidence['supports'];
		});

		// Notes field (optional)
		const notesRow = item.createDiv({ cls: 'crc-proof-evidence-notes' });
		notesRow.createSpan({ cls: 'crc-proof-evidence-label', text: 'Notes:' });
		const notesInput = notesRow.createEl('input', {
			type: 'text',
			cls: 'crc-form-input',
			placeholder: 'Optional notes about this evidence',
			value: ev.notes || ''
		});
		notesInput.addEventListener('input', () => {
			this.evidence[index].notes = notesInput.value || undefined;
		});
	}

	private addEvidence(): void {
		new SourcePickerModal(this.app, this.plugin, (source) => {
			// Create wikilink from source file path
			const fileName = source.filePath.split('/').pop()?.replace('.md', '') || source.title;
			const wikilink = `[[${fileName}]]`;

			// Add new evidence item
			this.evidence.push({
				source: wikilink,
				information: '',
				supports: 'moderately'
			});

			this.renderEvidenceList();
		}).open();
	}

	private async createProof(): Promise<void> {
		// Validation
		if (!this.title.trim()) {
			new Notice('Please enter a title for the proof summary.');
			return;
		}

		if (!this.subjectPerson.trim()) {
			new Notice('Please enter the subject person.');
			return;
		}

		if (!this.conclusion.trim()) {
			new Notice('Please enter a conclusion.');
			return;
		}

		try {
			const file = await this.proofService.createProof({
				title: this.title.trim(),
				subjectPerson: this.subjectPerson.trim(),
				factType: this.factType,
				conclusion: this.conclusion.trim(),
				status: this.status,
				confidence: this.confidence,
				evidence: this.evidence
			});

			// Open the new file
			await this.app.workspace.openLinkText(file.path, '', true);

			this.close();

			if (this.options.onSuccess) {
				this.options.onSuccess(file);
			}
		} catch (error) {
			console.error('Failed to create proof summary:', error);
			new Notice('Failed to create proof summary. Check the console for details.');
		}
	}

	private async updateProof(): Promise<void> {
		// Validation
		if (!this.title.trim()) {
			new Notice('Please enter a title for the proof summary.');
			return;
		}

		if (!this.conclusion.trim()) {
			new Notice('Please enter a conclusion.');
			return;
		}

		if (!this.editingFile) {
			new Notice('No file to update.');
			return;
		}

		try {
			await this.proofService.updateProof(this.editingFile, {
				title: this.title.trim(),
				conclusion: this.conclusion.trim(),
				status: this.status,
				confidence: this.confidence,
				evidence: this.evidence
			});

			new Notice(`Updated proof summary: ${this.editingFile.basename}`);

			this.close();

			if (this.options.onUpdated) {
				this.options.onUpdated(this.editingFile);
			}
		} catch (error) {
			console.error('Failed to update proof summary:', error);
			new Notice('Failed to update proof summary. Check the console for details.');
		}
	}
}
