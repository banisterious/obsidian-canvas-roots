/**
 * Proof Summary Service
 *
 * Manages proof summary notes - creating, parsing, querying, and analyzing
 * proof arguments that document the reasoning chain for genealogical conclusions.
 *
 * Proof summaries follow the Genealogical Proof Standard (GPS) methodology.
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	ProofSummaryNote,
	ProofSummaryFrontmatter,
	ProofEvidence,
	ProofStatus,
	ProofConfidence,
	PersonProofSummary,
	SourceConflict
} from '../types/proof-types';
import type { FactKey, SourceNote, SourceQuality } from '../types/source-types';
import { FACT_KEYS, getSourceQuality } from '../types/source-types';
import { SourceService } from './source-service';
import { generateCrId } from '../../core/uuid';

/**
 * Service for managing proof summary notes
 */
export class ProofSummaryService {
	private app: App;
	private settings: CanvasRootsSettings;
	private sourceService: SourceService;
	private proofCache: Map<string, ProofSummaryNote> = new Map();
	private cacheValid = false;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
		this.sourceService = new SourceService(app, settings);
	}

	/**
	 * Update settings reference (called when settings change)
	 */
	updateSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
		this.sourceService.updateSettings(settings);
		this.invalidateCache();
	}

	/**
	 * Invalidate the proof cache
	 */
	invalidateCache(): void {
		this.cacheValid = false;
		this.proofCache.clear();
	}

	// ============ Query Methods ============

	/**
	 * Get all proof summary notes in the vault
	 */
	getAllProofs(): ProofSummaryNote[] {
		if (!this.cacheValid) {
			this.loadProofCache();
		}
		return Array.from(this.proofCache.values());
	}

	/**
	 * Get a proof summary by cr_id
	 */
	getProofById(crId: string): ProofSummaryNote | undefined {
		if (!this.cacheValid) {
			this.loadProofCache();
		}
		return this.proofCache.get(crId);
	}

	/**
	 * Get a proof summary by file path
	 */
	getProofByPath(filePath: string): ProofSummaryNote | undefined {
		if (!this.cacheValid) {
			this.loadProofCache();
		}
		return Array.from(this.proofCache.values()).find(p => p.filePath === filePath);
	}

	/**
	 * Get all proofs for a specific person
	 */
	getProofsForPerson(personCrId: string): ProofSummaryNote[] {
		const proofs = this.getAllProofs();
		return proofs.filter(p => this.extractCrIdFromWikilink(p.subjectPerson) === personCrId);
	}

	/**
	 * Get all proofs for a specific fact type
	 */
	getProofsForFactType(factType: FactKey): ProofSummaryNote[] {
		const proofs = this.getAllProofs();
		return proofs.filter(p => p.factType === factType);
	}

	/**
	 * Get proofs by status
	 */
	getProofsByStatus(status: ProofStatus): ProofSummaryNote[] {
		const proofs = this.getAllProofs();
		return proofs.filter(p => p.status === status);
	}

	/**
	 * Get proofs by confidence level
	 */
	getProofsByConfidence(confidence: ProofConfidence): ProofSummaryNote[] {
		const proofs = this.getAllProofs();
		return proofs.filter(p => p.confidence === confidence);
	}

	/**
	 * Get proofs that need review
	 */
	getProofsNeedingReview(): ProofSummaryNote[] {
		const proofs = this.getAllProofs();
		return proofs.filter(p => p.status === 'needs_review' || p.status === 'conflicted');
	}

	/**
	 * Get proof summary for a specific person and fact
	 */
	getProofForPersonFact(personCrId: string, factType: FactKey): ProofSummaryNote | undefined {
		const proofs = this.getProofsForPerson(personCrId);
		return proofs.find(p => p.factType === factType);
	}

	// ============ Person Summary Methods ============

	/**
	 * Get a summary of all proofs for a person
	 */
	getPersonProofSummary(personCrId: string, personName: string): PersonProofSummary {
		const proofs = this.getProofsForPerson(personCrId);

		const summary: PersonProofSummary = {
			personCrId,
			personName,
			totalProofs: proofs.length,
			byStatus: {
				draft: 0,
				complete: 0,
				needs_review: 0,
				conflicted: 0
			},
			byConfidence: {
				proven: 0,
				probable: 0,
				possible: 0,
				disproven: 0
			},
			provenFacts: [],
			conflictedFacts: []
		};

		for (const proof of proofs) {
			summary.byStatus[proof.status]++;
			summary.byConfidence[proof.confidence]++;

			if (proof.confidence === 'proven') {
				summary.provenFacts.push(proof.factType);
			}
			if (proof.status === 'conflicted') {
				summary.conflictedFacts.push(proof.factType);
			}
		}

		return summary;
	}

	// ============ Conflict Detection Methods ============

	/**
	 * Detect conflicts between sources for a person's fact
	 * This is a simplified conflict detection - looks for sources with different claims
	 */
	detectConflicts(personCrId: string, factType: FactKey): SourceConflict | null {
		// Get the proof for this person/fact if it exists
		const proof = this.getProofForPersonFact(personCrId, factType);

		if (!proof || proof.evidence.length < 2) {
			return null;
		}

		// Check if any evidence items conflict
		const conflictingEvidence = proof.evidence.filter(e => e.supports === 'conflicts');

		if (conflictingEvidence.length === 0) {
			return null;
		}

		// Build conflict object
		const conflictingSources: SourceConflict['conflictingSources'] = [];

		for (const evidence of proof.evidence) {
			const sourceNote = this.findSourceByWikilink(evidence.source);
			const quality: SourceQuality = sourceNote ? getSourceQuality(sourceNote) : 'secondary';

			conflictingSources.push({
				source: evidence.source,
				claim: evidence.information,
				quality
			});
		}

		return {
			factType,
			personCrId,
			conflictingSources,
			resolved: proof.status === 'complete',
			resolutionProof: proof.status === 'complete' ? `[[${proof.filePath}]]` : undefined
		};
	}

	/**
	 * Find all conflicts across all people
	 */
	findAllConflicts(): SourceConflict[] {
		const conflicts: SourceConflict[] = [];
		const proofs = this.getAllProofs();

		for (const proof of proofs) {
			if (proof.status === 'conflicted') {
				const personCrId = this.extractCrIdFromWikilink(proof.subjectPerson);
				if (personCrId) {
					const conflict = this.detectConflicts(personCrId, proof.factType);
					if (conflict) {
						conflicts.push(conflict);
					}
				}
			}
		}

		return conflicts;
	}

	// ============ CRUD Methods ============

	/**
	 * Create a new proof summary note
	 */
	async createProof(data: {
		title: string;
		subjectPerson: string; // Wikilink to person note
		factType: FactKey;
		conclusion: string;
		status?: ProofStatus;
		confidence?: ProofConfidence;
		evidence?: ProofEvidence[];
		dependsOn?: string[];
	}): Promise<TFile> {
		const crId = generateCrId();

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'type: proof_summary',
			`cr_id: ${crId}`,
			`title: "${data.title.replace(/"/g, '\\"')}"`,
			`subject_person: "${data.subjectPerson}"`,
			`fact_type: ${data.factType}`,
			`conclusion: "${data.conclusion.replace(/"/g, '\\"')}"`,
			`status: ${data.status || 'draft'}`,
			`confidence: ${data.confidence || 'possible'}`,
			`date_written: ${new Date().toISOString().split('T')[0]}`
		];

		// Add evidence array
		if (data.evidence && data.evidence.length > 0) {
			frontmatterLines.push('evidence:');
			for (const ev of data.evidence) {
				frontmatterLines.push(`  - source: "${ev.source}"`);
				frontmatterLines.push(`    information: "${ev.information.replace(/"/g, '\\"')}"`);
				frontmatterLines.push(`    supports: ${ev.supports}`);
				if (ev.notes) {
					frontmatterLines.push(`    notes: "${ev.notes.replace(/"/g, '\\"')}"`);
				}
			}
		} else {
			frontmatterLines.push('evidence: []');
		}

		// Add dependencies
		if (data.dependsOn && data.dependsOn.length > 0) {
			frontmatterLines.push('depends_on:');
			for (const dep of data.dependsOn) {
				frontmatterLines.push(`  - "${dep}"`);
			}
		}

		frontmatterLines.push('---');

		// Build note body
		const body = this.getProofSummaryTemplate(data.title, data.factType);
		const content = frontmatterLines.join('\n') + '\n\n' + body;

		// Create file
		const fileName = this.slugify(data.title) + '.md';
		const folder = this.getProofsFolder();
		const filePath = normalizePath(`${folder}/${fileName}`);

		// Ensure folder exists
		await this.ensureFolderExists(folder);

		// Create the file
		const file = await this.app.vault.create(filePath, content);

		// Invalidate cache
		this.invalidateCache();

		return file;
	}

	/**
	 * Update a proof summary's frontmatter
	 */
	async updateProof(file: TFile, data: {
		title?: string;
		conclusion?: string;
		status?: ProofStatus;
		confidence?: ProofConfidence;
		evidence?: ProofEvidence[];
		dependsOn?: string[];
	}): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (data.title !== undefined) {
				frontmatter.title = data.title;
			}
			if (data.conclusion !== undefined) {
				frontmatter.conclusion = data.conclusion;
			}
			if (data.status !== undefined) {
				frontmatter.status = data.status;
			}
			if (data.confidence !== undefined) {
				frontmatter.confidence = data.confidence;
			}
			if (data.evidence !== undefined) {
				frontmatter.evidence = data.evidence;
			}
			if (data.dependsOn !== undefined) {
				frontmatter.depends_on = data.dependsOn;
			}

			// Update review date when status changes to complete or needs_review
			if (data.status === 'complete' || data.status === 'needs_review') {
				frontmatter.date_reviewed = new Date().toISOString().split('T')[0];
			}
		});

		this.invalidateCache();
	}

	/**
	 * Add evidence to a proof summary
	 */
	async addEvidence(file: TFile, evidence: ProofEvidence): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (!Array.isArray(frontmatter.evidence)) {
				frontmatter.evidence = [];
			}
			frontmatter.evidence.push(evidence);
		});

		this.invalidateCache();
	}

	/**
	 * Remove evidence from a proof summary by source wikilink
	 */
	async removeEvidence(file: TFile, sourceWikilink: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (Array.isArray(frontmatter.evidence)) {
				frontmatter.evidence = frontmatter.evidence.filter(
					(e: ProofEvidence) => e.source !== sourceWikilink
				);
			}
		});

		this.invalidateCache();
	}

	// ============ Parsing Methods ============

	/**
	 * Parse a file into a ProofSummaryNote object
	 */
	parseProofNote(file: TFile, frontmatter: Record<string, unknown>): ProofSummaryNote | null {
		// Must have type: proof_summary
		if (frontmatter.type !== 'proof_summary') {
			return null;
		}

		// Must have required fields
		const crId = frontmatter.cr_id as string;
		const title = frontmatter.title as string;
		const subjectPerson = frontmatter.subject_person as string;
		const factType = frontmatter.fact_type as FactKey;
		const conclusion = frontmatter.conclusion as string;
		const status = frontmatter.status as ProofStatus;
		const confidence = frontmatter.confidence as ProofConfidence;

		if (!crId || !title || !subjectPerson || !factType || !conclusion) {
			return null;
		}

		// Validate factType is a known fact key
		if (!FACT_KEYS.includes(factType)) {
			return null;
		}

		// Parse evidence array
		const evidence: ProofEvidence[] = [];
		if (Array.isArray(frontmatter.evidence)) {
			for (const ev of frontmatter.evidence) {
				if (typeof ev === 'object' && ev !== null) {
					const evidenceItem: ProofEvidence = {
						source: String(ev.source || ''),
						information: String(ev.information || ''),
						supports: this.parseSupportsValue(ev.supports)
					};
					if (ev.notes) {
						evidenceItem.notes = String(ev.notes);
					}
					evidence.push(evidenceItem);
				}
			}
		}

		// Parse depends_on array
		const dependsOn: string[] = [];
		if (Array.isArray(frontmatter.depends_on)) {
			for (const dep of frontmatter.depends_on) {
				if (typeof dep === 'string') {
					dependsOn.push(dep);
				}
			}
		}

		return {
			filePath: file.path,
			crId,
			title,
			subjectPerson,
			factType,
			conclusion,
			status: this.parseStatus(status),
			confidence: this.parseConfidence(confidence),
			evidence,
			dependsOn,
			dateWritten: frontmatter.date_written as string | undefined,
			dateReviewed: frontmatter.date_reviewed as string | undefined
		};
	}

	// ============ Private Helper Methods ============

	/**
	 * Load all proof notes into the cache
	 */
	private loadProofCache(): void {
		this.proofCache.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const proof = this.parseProofNote(file, cache.frontmatter);
			if (proof) {
				this.proofCache.set(proof.crId, proof);
			}
		}

		this.cacheValid = true;
	}

	/**
	 * Get the folder path for proof summaries
	 */
	private getProofsFolder(): string {
		// Store proofs in a subfolder of sources
		return normalizePath(`${this.settings.sourcesFolder}/Proofs`);
	}

	/**
	 * Ensure a folder exists
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}

	/**
	 * Convert title to URL-safe filename
	 */
	private slugify(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.substring(0, 100);
	}

	/**
	 * Parse a status value, defaulting to 'draft'
	 */
	private parseStatus(value: unknown): ProofStatus {
		const valid: ProofStatus[] = ['draft', 'complete', 'needs_review', 'conflicted'];
		if (typeof value === 'string' && valid.includes(value as ProofStatus)) {
			return value as ProofStatus;
		}
		return 'draft';
	}

	/**
	 * Parse a confidence value, defaulting to 'possible'
	 */
	private parseConfidence(value: unknown): ProofConfidence {
		const valid: ProofConfidence[] = ['proven', 'probable', 'possible', 'disproven'];
		if (typeof value === 'string' && valid.includes(value as ProofConfidence)) {
			return value as ProofConfidence;
		}
		return 'possible';
	}

	/**
	 * Parse supports value for evidence
	 */
	private parseSupportsValue(value: unknown): ProofEvidence['supports'] {
		const valid: ProofEvidence['supports'][] = ['strongly', 'moderately', 'weakly', 'conflicts'];
		if (typeof value === 'string' && valid.includes(value as ProofEvidence['supports'])) {
			return value as ProofEvidence['supports'];
		}
		return 'moderately';
	}

	/**
	 * Extract cr_id from a wikilink [[PersonName]] or from cr_id directly
	 */
	private extractCrIdFromWikilink(wikilink: string): string | null {
		// If it's already a cr_id (no brackets), return as-is
		if (!wikilink.includes('[[')) {
			return wikilink;
		}

		// Extract note name from wikilink: [[Note]] or [[Note|Alias]]
		const match = wikilink.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
		if (!match) return null;

		const noteName = match[1];

		// Find the file and get its cr_id
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const basename = file.basename;
			if (basename === noteName) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.cr_id) {
					return cache.frontmatter.cr_id as string;
				}
			}
		}

		return null;
	}

	/**
	 * Find a source note by wikilink
	 */
	private findSourceByWikilink(wikilink: string): SourceNote | undefined {
		// Extract note name from wikilink
		const match = wikilink.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
		if (!match) return undefined;

		const noteName = match[1];
		const sources = this.sourceService.getAllSources();

		// Try to match by filename
		return sources.find(s => {
			const fileName = s.filePath.split('/').pop()?.replace('.md', '');
			return fileName === noteName || s.title === noteName;
		});
	}

	/**
	 * Get the template for a new proof summary note
	 */
	private getProofSummaryTemplate(title: string, factType: FactKey): string {
		return `# ${title}

## Research Question

What evidence supports the conclusion about this person's ${factType.replace(/_/g, ' ')}?

## Analysis

*Document your analysis of the evidence here. Explain how you weighed the evidence, resolved any conflicts, and arrived at your conclusion.*

## Conclusion

*State your final conclusion and the confidence level.*

## Notes

*Additional notes, future research suggestions, or related questions.*
`;
	}
}
