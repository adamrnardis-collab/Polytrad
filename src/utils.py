"""
Utility Module
==============

Common utilities for the ClimateEnzyme pipeline including
FASTA handling, report generation, and visualization helpers.
"""

import json
import re
from pathlib import Path
from typing import Optional, Iterator
from dataclasses import dataclass
from datetime import datetime


@dataclass
class FastaRecord:
    """Simple FASTA record."""
    id: str
    description: str
    sequence: str

    @property
    def length(self) -> int:
        return len(self.sequence)

    def to_fasta(self, line_width: int = 80) -> str:
        """Convert to FASTA format string."""
        header = f">{self.id} {self.description}".strip()
        wrapped = '\n'.join(
            self.sequence[i:i+line_width]
            for i in range(0, len(self.sequence), line_width)
        )
        return f"{header}\n{wrapped}"


class FastaHandler:
    """
    Handles reading and writing FASTA files.

    Supports standard FASTA format with multiple sequences.
    """

    @staticmethod
    def read(filepath: str) -> list[FastaRecord]:
        """
        Read FASTA file and return list of records.

        Args:
            filepath: Path to FASTA file

        Returns:
            List of FastaRecord objects
        """
        records = []
        current_id = ""
        current_desc = ""
        current_seq = []

        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('>'):
                    # Save previous record
                    if current_id:
                        records.append(FastaRecord(
                            id=current_id,
                            description=current_desc,
                            sequence=''.join(current_seq)
                        ))
                    # Parse new header
                    parts = line[1:].split(None, 1)
                    current_id = parts[0] if parts else ""
                    current_desc = parts[1] if len(parts) > 1 else ""
                    current_seq = []
                elif line:
                    current_seq.append(line)

        # Don't forget last record
        if current_id:
            records.append(FastaRecord(
                id=current_id,
                description=current_desc,
                sequence=''.join(current_seq)
            ))

        return records

    @staticmethod
    def write(records: list[FastaRecord], filepath: str, line_width: int = 80) -> None:
        """
        Write records to FASTA file.

        Args:
            records: List of FastaRecord objects
            filepath: Output file path
            line_width: Maximum line width for sequences
        """
        with open(filepath, 'w') as f:
            for record in records:
                f.write(record.to_fasta(line_width) + '\n')

    @staticmethod
    def iterate(filepath: str) -> Iterator[FastaRecord]:
        """
        Memory-efficient iterator over FASTA file.

        Yields one record at a time without loading entire file.
        """
        current_id = ""
        current_desc = ""
        current_seq = []

        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('>'):
                    if current_id:
                        yield FastaRecord(
                            id=current_id,
                            description=current_desc,
                            sequence=''.join(current_seq)
                        )
                    parts = line[1:].split(None, 1)
                    current_id = parts[0] if parts else ""
                    current_desc = parts[1] if len(parts) > 1 else ""
                    current_seq = []
                elif line:
                    current_seq.append(line)

        if current_id:
            yield FastaRecord(
                id=current_id,
                description=current_desc,
                sequence=''.join(current_seq)
            )


class ReportGenerator:
    """
    Generates various reports from pipeline results.

    Creates Markdown, HTML, and JSON summaries suitable for
    publication and sharing.
    """

    def __init__(self, output_dir: str = "results"):
        """
        Initialize report generator.

        Args:
            output_dir: Directory for output files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_pipeline_summary(
        self,
        mining_stats: dict,
        prediction_stats: dict,
        analysis_stats: dict,
        ranking_stats: dict
    ) -> Path:
        """
        Generate complete pipeline summary report.

        Args:
            mining_stats: Statistics from sequence mining
            prediction_stats: Statistics from structure prediction
            analysis_stats: Statistics from structure analysis
            ranking_stats: Statistics from ranking

        Returns:
            Path to generated report
        """
        report = f"""# ClimateEnzyme Pipeline Summary Report

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

---

## Overview

This pipeline identifies and ranks PET-degrading enzyme candidates for
experimental validation. Target application: enzymatic degradation of
polyethylene terephthalate (PET) plastic pollution.

---

## Stage 1: Sequence Mining

**Source:** UniProt database
**Target families:** PETases, MHETases, Cutinases

| Metric | Value |
|--------|-------|
| Sequences retrieved | {mining_stats.get('total', 'N/A')} |
| Reviewed (Swiss-Prot) | {mining_stats.get('reviewed', 'N/A')} |
| Unreviewed (TrEMBL) | {mining_stats.get('unreviewed', 'N/A')} |
| Unique organisms | {mining_stats.get('unique_organisms', 'N/A')} |
| Length range | {mining_stats.get('length_min', 'N/A')}-{mining_stats.get('length_max', 'N/A')} aa |

---

## Stage 2: Structure Prediction

**Method:** ColabFold (AlphaFold2)

| Metric | Value |
|--------|-------|
| Structures predicted | {prediction_stats.get('total_predicted', 'N/A')} |
| High confidence (pLDDT>70) | {prediction_stats.get('high_confidence', 'N/A')} |
| Mean pLDDT | {prediction_stats.get('mean_plddt', 'N/A'):.1f} |
| Predictions with disorder | {prediction_stats.get('with_disorder', 'N/A')} |

---

## Stage 3: Structure Analysis

**Tools:** fpocket, sequence analysis

| Metric | Value |
|--------|-------|
| Structures analyzed | {analysis_stats.get('total_analyzed', 'N/A')} |
| With druggable pockets | {analysis_stats.get('with_pockets', 'N/A')} |
| Predicted soluble | {analysis_stats.get('predicted_soluble', 'N/A')} |
| Catalytic sites identified | {analysis_stats.get('with_catalytic', 'N/A')} |

---

## Stage 4: Ranking

**Top candidates:** {ranking_stats.get('top_count', 'N/A')}

### Scoring Weights

| Factor | Weight |
|--------|--------|
| Structural confidence | 30% |
| Active site accessibility | 25% |
| Predicted stability | 20% |
| Novelty | 15% |
| Solubility | 10% |

### Results Summary

- **Total ranked:** {ranking_stats.get('total_ranked', 'N/A')}
- **Passed all filters:** {ranking_stats.get('passed_filters', 'N/A')}
- **Top score:** {ranking_stats.get('top_score', 'N/A'):.3f}
- **Score range:** {ranking_stats.get('score_min', 'N/A'):.3f} - {ranking_stats.get('score_max', 'N/A'):.3f}

---

## Output Files

| File | Description |
|------|-------------|
| `data/sequences/pet_enzyme_candidates.fasta` | Input sequences |
| `data/structures/*.pdb` | Predicted structures |
| `results/ranked_candidates.csv` | Ranking results |
| `results/ranking_report.html` | Interactive report |

---

## Reproducibility

This pipeline uses:
- Python 3.10+
- ColabFold for structure prediction
- Open-source tools for analysis

All code is available under MIT license.

---

*ClimateEnzyme Discovery Pipeline v1.0*
"""
        output_path = self.output_dir / "pipeline_summary.md"
        with open(output_path, 'w') as f:
            f.write(report)

        print(f"Generated summary report: {output_path}")
        return output_path

    def generate_methods_section(self) -> Path:
        """
        Generate methods section suitable for publication.

        Returns:
            Path to generated methods file
        """
        methods = """# Methods

## Sequence Mining

Protein sequences were retrieved from UniProt (https://www.uniprot.org/)
using programmatic access to the REST API. Queries targeted enzyme
families with known or predicted PET hydrolysis activity:

- PETases (EC 3.1.1.101)
- MHETases (EC 3.1.1.102)
- Cutinases (EC 3.1.1.74)
- Related polyesterases

Sequences were filtered by:
- Length: 150-600 amino acids
- Completeness: No fragment annotations
- Quality: No ambiguous residues (X)

Reference enzymes with experimentally validated PET activity were
included as positive controls (IsPETase, TfCut2, LCC).

## Structure Prediction

Protein structures were predicted using ColabFold v1.5 [1], an
implementation of AlphaFold2 [2] optimized for speed using MMseqs2
for multiple sequence alignment generation.

Prediction parameters:
- Models: 3 (best ranked by pLDDT)
- Recycles: 3
- MSA mode: mmseqs2_uniref_env
- Amber relaxation: enabled

Quality metrics extracted:
- pLDDT (per-residue confidence)
- PAE (predicted aligned error)
- pTM (predicted TM-score)

## Structure Analysis

Binding pockets were detected using fpocket v4.0 [3]. Druggability
scores were calculated based on pocket geometry and physicochemical
properties.

Catalytic residues were identified by:
1. Motif search for known Ser-His-Asp catalytic triads
2. Lipase/esterase consensus patterns
3. Comparison to characterized PETase active sites

Solubility predictions used sequence-based hydrophobicity analysis
and transmembrane helix prediction.

## Ranking

Candidates were scored on a 0-1 scale using weighted factors:
- Structural confidence (30%): pLDDT, PAE, disorder content
- Active site accessibility (25%): Pocket druggability, catalytic residues
- Predicted stability (20%): Length, pI, composition
- Novelty (15%): Sequence divergence from known enzymes
- Solubility (10%): Predicted expression feasibility

## References

1. Mirdita M, et al. ColabFold: Making protein folding accessible to all.
   Nature Methods 19:679-682 (2022)

2. Jumper J, et al. Highly accurate protein structure prediction with
   AlphaFold. Nature 596:583-589 (2021)

3. Le Guilloux V, et al. Fpocket: An open source platform for ligand
   pocket detection. BMC Bioinformatics 10:168 (2009)
"""
        output_path = self.output_dir / "methods.md"
        with open(output_path, 'w') as f:
            f.write(methods)

        print(f"Generated methods section: {output_path}")
        return output_path


def setup_project_structure(base_dir: str = ".") -> dict[str, Path]:
    """
    Create standard project directory structure.

    Args:
        base_dir: Base directory for project

    Returns:
        Dictionary of created directory paths
    """
    base = Path(base_dir)

    directories = {
        "data": base / "data",
        "sequences": base / "data" / "sequences",
        "structures": base / "data" / "structures",
        "analysis": base / "data" / "analysis",
        "results": base / "results",
        "notebooks": base / "notebooks",
        "scripts": base / "scripts",
        "docs": base / "docs",
    }

    for name, path in directories.items():
        path.mkdir(parents=True, exist_ok=True)

    print(f"Created project structure in {base.absolute()}")
    return directories


def validate_sequence(sequence: str) -> tuple[bool, str]:
    """
    Validate protein sequence.

    Args:
        sequence: Amino acid sequence

    Returns:
        Tuple of (is_valid, error_message)
    """
    valid_aa = set("ACDEFGHIKLMNPQRSTVWY")
    sequence = sequence.upper().replace(" ", "").replace("\n", "")

    if not sequence:
        return False, "Empty sequence"

    if len(sequence) < 50:
        return False, f"Sequence too short ({len(sequence)} aa)"

    if len(sequence) > 2000:
        return False, f"Sequence too long ({len(sequence)} aa)"

    invalid_chars = set(sequence) - valid_aa
    if invalid_chars:
        return False, f"Invalid characters: {invalid_chars}"

    return True, ""


def calculate_sequence_identity(seq1: str, seq2: str) -> float:
    """
    Calculate sequence identity between two sequences.

    Uses simple global alignment (for similar length sequences).

    Args:
        seq1: First sequence
        seq2: Second sequence

    Returns:
        Identity as fraction (0-1)
    """
    # Simplified identity calculation
    # For proper alignment, use BioPython or similar

    min_len = min(len(seq1), len(seq2))
    max_len = max(len(seq1), len(seq2))

    if max_len == 0:
        return 0.0

    # Simple position-wise comparison
    matches = sum(1 for a, b in zip(seq1[:min_len], seq2[:min_len]) if a == b)

    return matches / max_len


if __name__ == "__main__":
    # Test utilities
    setup_project_structure()
