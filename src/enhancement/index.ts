/**
 * Data Enhancement Pass
 *
 * Tools for upgrading existing vaults by creating missing linked entities
 * from existing person note data.
 */

// Services
export { PlaceGeneratorService, DEFAULT_PLACE_GENERATOR_OPTIONS } from './services/place-generator';
export type {
	PlaceGeneratorOptions,
	PlaceGeneratorResult,
	SinglePlaceResult,
	FoundPlace,
	PlaceNoteInfo
} from './services/place-generator';

// UI
export { PlaceGeneratorModal } from './ui/place-generator-modal';
export type { PlaceGeneratorModalOptions } from './ui/place-generator-modal';
