/**
 * Modal State Persistence
 *
 * Reusable utility for persisting form state in create entity modals.
 * Allows users to resume work if a modal is accidentally closed.
 */

import type CanvasRootsPlugin from '../../main';
import type { CanvasRootsSettings, CreateEntityPersistedState } from '../settings';

export type ModalType = 'person' | 'place' | 'event' | 'organization' | 'source';

/**
 * Settings key type for modal state properties
 */
type ModalStateSettingsKey =
	| 'createPersonModalState'
	| 'createPlaceModalState'
	| 'createEventModalState'
	| 'createOrganizationModalState'
	| 'createSourceModalState';

/**
 * Map modal types to their settings keys
 */
const MODAL_SETTINGS_KEYS: Record<ModalType, ModalStateSettingsKey> = {
	person: 'createPersonModalState',
	place: 'createPlaceModalState',
	event: 'createEventModalState',
	organization: 'createOrganizationModalState',
	source: 'createSourceModalState'
};

/**
 * Utility class for persisting modal form state
 *
 * Usage:
 * ```typescript
 * const persistence = new ModalStatePersistence(plugin, 'person');
 *
 * // Check for existing state on modal open
 * const existingState = persistence.getValidState();
 * if (existingState) {
 *   // Show resume prompt
 * }
 *
 * // Persist state on modal close (if not saved)
 * await persistence.persist({ name: 'John', birth_date: '1950' });
 *
 * // Clear state after successful save
 * await persistence.clear();
 * ```
 */
export class ModalStatePersistence<T extends Record<string, unknown>> {
	private plugin: CanvasRootsPlugin;
	private modalType: ModalType;
	private settingsKey: ModalStateSettingsKey;
	private expiryMs: number;

	/**
	 * Create a new persistence helper for a modal type
	 *
	 * @param plugin - The plugin instance
	 * @param modalType - Which modal type this is for
	 * @param expiryMs - How long until state expires (default: 24 hours)
	 */
	constructor(
		plugin: CanvasRootsPlugin,
		modalType: ModalType,
		expiryMs: number = 24 * 60 * 60 * 1000 // 24 hours
	) {
		this.plugin = plugin;
		this.modalType = modalType;
		this.settingsKey = MODAL_SETTINGS_KEYS[modalType];
		this.expiryMs = expiryMs;
	}

	/**
	 * Persist the current form state
	 *
	 * @param formData - The form data to persist
	 */
	async persist(formData: T): Promise<void> {
		const state: CreateEntityPersistedState = {
			modalType: this.modalType,
			formData: formData as Record<string, unknown>,
			savedAt: Date.now()
		};

		(this.plugin.settings as CanvasRootsSettings)[this.settingsKey] = state;
		await this.plugin.saveSettings();
	}

	/**
	 * Get the raw persisted state (without validity check)
	 */
	getRawState(): CreateEntityPersistedState | undefined {
		return (this.plugin.settings as CanvasRootsSettings)[this.settingsKey];
	}

	/**
	 * Get persisted state if it's still valid (not expired)
	 *
	 * @returns The persisted state if valid, null otherwise
	 */
	getValidState(): CreateEntityPersistedState | null {
		const state = this.getRawState();

		if (!state) {
			return null;
		}

		if (!this.isValid(state)) {
			// State is expired, clean it up
			void this.clear();
			return null;
		}

		return state;
	}

	/**
	 * Check if a state is still valid (not expired)
	 *
	 * @param state - The state to check
	 * @returns true if the state is valid
	 */
	isValid(state: CreateEntityPersistedState | null | undefined): boolean {
		if (!state) {
			return false;
		}

		const age = Date.now() - state.savedAt;
		return age < this.expiryMs;
	}

	/**
	 * Clear the persisted state
	 */
	async clear(): Promise<void> {
		(this.plugin.settings as CanvasRootsSettings)[this.settingsKey] = undefined;
		await this.plugin.saveSettings();
	}

	/**
	 * Get a human-readable time string for how long ago the state was saved
	 *
	 * @param state - The persisted state
	 * @returns A string like "5 minutes ago" or "2 hours ago"
	 */
	getTimeAgoString(state: CreateEntityPersistedState): string {
		const ageMs = Date.now() - state.savedAt;
		const minutes = Math.floor(ageMs / (1000 * 60));

		if (minutes < 1) {
			return 'just now';
		} else if (minutes === 1) {
			return '1 minute ago';
		} else if (minutes < 60) {
			return `${minutes} minutes ago`;
		} else {
			const hours = Math.floor(minutes / 60);
			if (hours === 1) {
				return '1 hour ago';
			} else {
				return `${hours} hours ago`;
			}
		}
	}

	/**
	 * Check if there's any form data with actual content
	 * Used to avoid persisting empty forms
	 *
	 * @param formData - The form data to check
	 * @returns true if the form has meaningful data
	 */
	hasContent(formData: T): boolean {
		for (const [, value] of Object.entries(formData)) {
			if (value === null || value === undefined) {
				continue;
			}

			if (typeof value === 'string' && value.trim() !== '') {
				return true;
			}

			if (Array.isArray(value) && value.length > 0) {
				return true;
			}

			if (typeof value === 'object' && Object.keys(value as object).length > 0) {
				return true;
			}
		}

		return false;
	}
}

/**
 * Render a resume prompt banner in a modal
 *
 * @param container - The container element to render into
 * @param timeAgo - Human-readable time string
 * @param onDiscard - Callback when user clicks Discard
 * @param onRestore - Callback when user clicks Restore
 * @returns The banner element (for cleanup if needed)
 */
export function renderResumePromptBanner(
	container: HTMLElement,
	timeAgo: string,
	onDiscard: () => void,
	onRestore: () => void
): HTMLElement {
	const banner = container.createDiv({ cls: 'cr-modal-resume-banner' });

	const messageDiv = banner.createDiv({ cls: 'cr-modal-resume-banner__message' });
	messageDiv.createSpan({ cls: 'cr-modal-resume-banner__icon', text: '⏱️' });
	messageDiv.createSpan({
		cls: 'cr-modal-resume-banner__text',
		text: `Resume previous session? You have unsaved data from ${timeAgo}.`
	});

	const buttonsDiv = banner.createDiv({ cls: 'cr-modal-resume-banner__buttons' });

	const discardBtn = buttonsDiv.createEl('button', {
		cls: 'cr-modal-resume-banner__btn cr-modal-resume-banner__btn--discard',
		text: 'Discard'
	});
	discardBtn.addEventListener('click', (e) => {
		e.preventDefault();
		onDiscard();
	});

	const restoreBtn = buttonsDiv.createEl('button', {
		cls: 'cr-modal-resume-banner__btn cr-modal-resume-banner__btn--restore',
		text: 'Restore'
	});
	restoreBtn.addEventListener('click', (e) => {
		e.preventDefault();
		onRestore();
	});

	return banner;
}
