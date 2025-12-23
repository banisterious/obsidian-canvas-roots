/**
 * Dynamic Content Module
 *
 * Provides code block processors for rendering live, computed content
 * within person notes.
 */

export { DynamicContentService } from './services/dynamic-content-service';
export type { DynamicBlockConfig, DynamicBlockContext, DynamicBlockType } from './services/dynamic-content-service';

export { TimelineProcessor } from './processors/timeline-processor';
export { TimelineRenderer } from './renderers/timeline-renderer';

export { RelationshipsProcessor } from './processors/relationships-processor';
export { RelationshipsRenderer } from './renderers/relationships-renderer';

export { MediaProcessor } from './processors/media-processor';
export { MediaRenderer } from './renderers/media-renderer';
