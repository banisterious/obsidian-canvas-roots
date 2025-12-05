/**
 * Proof Summary Types for Evidence Documentation
 *
 * A proof summary documents the reasoning chain for a genealogical conclusion.
 * It follows the Genealogical Proof Standard (GPS) methodology by:
 * - Linking multiple sources as evidence
 * - Documenting how evidence supports or conflicts with a conclusion
 * - Recording the researcher's reasoning and analysis
 *
 * Proof summaries are stored as markdown notes with `type: proof_summary` frontmatter.
 */

import type { FactKey, SourceQuality } from './source-types';

/**
 * Status of a proof summary
 */
export type ProofStatus = 'draft' | 'complete' | 'needs_review' | 'conflicted';

/**
 * Confidence level in the conclusion
 */
export type ProofConfidence = 'proven' | 'probable' | 'possible' | 'disproven';

/**
 * A single piece of evidence cited in the proof
 */
export interface ProofEvidence {
	/** Wikilink to the source note */
	source: string;
	/** What this source says (the information) */
	information: string;
	/** How well does this support the conclusion? */
	supports: 'strongly' | 'moderately' | 'weakly' | 'conflicts';
	/** Optional notes about this evidence */
	notes?: string;
}

/**
 * Proof summary note frontmatter
 */
export interface ProofSummaryFrontmatter {
	type: 'proof_summary';
	cr_id: string;
	/** Title of the proof summary */
	title: string;
	/** The person this proof is about */
	subject_person: string; // Wikilink to person note
	/** Which fact this proof addresses */
	fact_type: FactKey;
	/** The conclusion being proven */
	conclusion: string;
	/** Status of the proof */
	status: ProofStatus;
	/** Confidence level in the conclusion */
	confidence: ProofConfidence;
	/** Evidence cited (array of source wikilinks with annotations) */
	evidence: ProofEvidence[];
	/** Other proofs that this one depends on */
	depends_on?: string[]; // Wikilinks to other proof_summary notes
	/** Date the proof was written */
	date_written?: string;
	/** Date the proof was last reviewed */
	date_reviewed?: string;
}

/**
 * Parsed proof summary note
 */
export interface ProofSummaryNote {
	/** File path in vault */
	filePath: string;
	/** Unique identifier */
	crId: string;
	/** Title of the proof */
	title: string;
	/** Subject person's cr_id or name */
	subjectPerson: string;
	/** Which fact this proof addresses */
	factType: FactKey;
	/** The conclusion being proven */
	conclusion: string;
	/** Status of the proof */
	status: ProofStatus;
	/** Confidence level */
	confidence: ProofConfidence;
	/** Evidence items */
	evidence: ProofEvidence[];
	/** Dependencies on other proofs */
	dependsOn: string[];
	/** Date written */
	dateWritten?: string;
	/** Date reviewed */
	dateReviewed?: string;
}

/**
 * Summary of proofs for a person
 */
export interface PersonProofSummary {
	/** Person's cr_id */
	personCrId: string;
	/** Person's name */
	personName: string;
	/** Total number of proof summaries */
	totalProofs: number;
	/** Proofs by status */
	byStatus: Record<ProofStatus, number>;
	/** Proofs by confidence */
	byConfidence: Record<ProofConfidence, number>;
	/** Facts that have proofs */
	provenFacts: FactKey[];
	/** Facts with conflicting evidence */
	conflictedFacts: FactKey[];
}

/**
 * Conflict between sources
 */
export interface SourceConflict {
	/** The fact in question */
	factType: FactKey;
	/** Person the conflict is about */
	personCrId: string;
	/** Sources that conflict */
	conflictingSources: Array<{
		source: string; // Wikilink
		claim: string; // What this source claims
		quality: SourceQuality;
	}>;
	/** Whether this conflict has been resolved */
	resolved: boolean;
	/** Link to proof summary resolving this conflict */
	resolutionProof?: string; // Wikilink
}

/**
 * Status labels for UI display
 */
export const PROOF_STATUS_LABELS: Record<ProofStatus, { label: string; description: string }> = {
	draft: {
		label: 'Draft',
		description: 'Proof summary is being written'
	},
	complete: {
		label: 'Complete',
		description: 'Proof summary is finished and reviewed'
	},
	needs_review: {
		label: 'Needs review',
		description: 'Proof summary needs to be reviewed or updated'
	},
	conflicted: {
		label: 'Conflicted',
		description: 'Evidence conflicts have not been resolved'
	}
};

/**
 * Confidence labels for UI display
 */
export const PROOF_CONFIDENCE_LABELS: Record<ProofConfidence, { label: string; description: string }> = {
	proven: {
		label: 'Proven',
		description: 'Conclusion is supported by preponderance of evidence'
	},
	probable: {
		label: 'Probable',
		description: 'Conclusion is likely but not definitively proven'
	},
	possible: {
		label: 'Possible',
		description: 'Conclusion is plausible but more evidence needed'
	},
	disproven: {
		label: 'Disproven',
		description: 'Evidence indicates the conclusion is false'
	}
};

/**
 * Evidence support labels for UI display
 */
export const EVIDENCE_SUPPORT_LABELS: Record<ProofEvidence['supports'], { label: string; color: string }> = {
	strongly: {
		label: 'Strongly supports',
		color: 'var(--color-green)'
	},
	moderately: {
		label: 'Moderately supports',
		color: 'var(--color-cyan)'
	},
	weakly: {
		label: 'Weakly supports',
		color: 'var(--color-orange)'
	},
	conflicts: {
		label: 'Conflicts with',
		color: 'var(--color-red)'
	}
};

/**
 * Create an empty proof summary
 */
export function createEmptyProofSummary(
	crId: string,
	subjectPerson: string,
	factType: FactKey
): Omit<ProofSummaryNote, 'filePath'> {
	return {
		crId,
		title: '',
		subjectPerson,
		factType,
		conclusion: '',
		status: 'draft',
		confidence: 'possible',
		evidence: [],
		dependsOn: []
	};
}
