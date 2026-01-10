/**
 * Privacy Notice Modal
 *
 * Shows a first-run notice when living persons are detected after import.
 * Helps users discover privacy protection features.
 */

import { App, Modal } from 'obsidian';
import { createLucideIcon, type LucideIconName } from './lucide-icons';

/**
 * User decision from the privacy notice
 */
export type PrivacyNoticeDecision = 'configure' | 'later' | 'dismiss';

/**
 * Modal to inform users about privacy protection features
 */
export class PrivacyNoticeModal extends Modal {
	private livingCount: number;
	private resolvePromise: ((decision: PrivacyNoticeDecision) => void) | null = null;

	constructor(app: App, livingCount: number) {
		super(app);
		this.livingCount = livingCount;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-privacy-notice-modal');

		// Header with info icon
		const header = contentEl.createDiv({ cls: 'cr-privacy-notice__header' });
		const iconContainer = header.createDiv({ cls: 'cr-privacy-notice__icon' });
		const infoIcon = createLucideIcon('shield-check', 32);
		infoIcon.addClass('cr-icon--info');
		iconContainer.appendChild(infoIcon);

		header.createEl('h2', {
			text: 'Privacy Protection Available',
			cls: 'cr-privacy-notice__title'
		});

		// Description
		const description = contentEl.createDiv({ cls: 'cr-privacy-notice__description' });
		description.createEl('p', {
			text: `Charted Roots detected ${this.livingCount} ${this.livingCount === 1 ? 'person' : 'people'} who may be living.`
		});
		description.createEl('p', {
			text: 'Privacy protection can hide or anonymize living persons in exports to protect their personal information.'
		});

		// Features list
		const featuresList = contentEl.createDiv({ cls: 'cr-privacy-notice__features' });
		const features: Array<{ icon: LucideIconName; text: string }> = [
			{ icon: 'eye-off', text: 'Exclude or redact living persons from exports' },
			{ icon: 'lock', text: 'Mark sensitive fields as private' },
			{ icon: 'user', text: 'Override living status per person' }
		];

		for (const feature of features) {
			const featureRow = featuresList.createDiv({ cls: 'cr-privacy-notice__feature' });
			const featureIcon = createLucideIcon(feature.icon, 16);
			featureRow.appendChild(featureIcon);
			featureRow.createEl('span', { text: feature.text });
		}

		// Button container
		const buttonContainer = contentEl.createDiv({ cls: 'cr-privacy-notice__buttons' });

		// Configure button (primary)
		const configureBtn = buttonContainer.createEl('button', {
			text: 'Configure Privacy Settings',
			cls: 'mod-cta'
		});
		configureBtn.addEventListener('click', () => {
			this.resolve('configure');
		});

		// Later button
		const laterBtn = buttonContainer.createEl('button', {
			text: 'Remind Me Later'
		});
		laterBtn.addEventListener('click', () => {
			this.resolve('later');
		});

		// Dismiss button
		const dismissBtn = buttonContainer.createEl('button', {
			text: "Don't Show Again",
			cls: 'mod-muted'
		});
		dismissBtn.addEventListener('click', () => {
			this.resolve('dismiss');
		});

		// Focus the primary action
		configureBtn.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// If modal was closed without explicit decision, treat as "later"
		if (this.resolvePromise) {
			this.resolvePromise('later');
			this.resolvePromise = null;
		}
	}

	/**
	 * Show the modal and wait for user decision
	 */
	async waitForDecision(): Promise<PrivacyNoticeDecision> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	/**
	 * Resolve with a decision and close
	 */
	private resolve(decision: PrivacyNoticeDecision): void {
		if (this.resolvePromise) {
			this.resolvePromise(decision);
			this.resolvePromise = null;
		}
		this.close();
	}
}
