"""
Enzyme Ranking Module
=====================

Ranks enzyme candidates based on multiple criteria for real-world
usefulness in PET degradation applications.

Scoring criteria:
1. Structural confidence (pLDDT, PAE)
2. Active site accessibility
3. Novelty (sequence divergence from known enzymes)
4. Predicted stability
5. Solubility and expressibility

Output:
- CSV with ranked candidates
- HTML/Markdown report
- Visualization images
"""

import csv
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class EnzymeCandidate:
    """Represents a ranked enzyme candidate."""
    sequence_id: str
    accession: str = ""
    organism: str = ""
    sequence: str = ""
    length: int = 0

    # Structural scores
    plddt_mean: float = 0.0
    pae_mean: float = 0.0
    ptm_score: float = 0.0
    disorder_fraction: float = 0.0

    # Functional scores
    active_site_accessibility: float = 0.0
    num_druggable_pockets: int = 0
    catalytic_residues: list[str] = field(default_factory=list)

    # Properties
    is_soluble: bool = True
    molecular_weight: float = 0.0
    isoelectric_point: float = 0.0
    hydrophobicity: float = 0.0

    # Novelty
    similarity_to_reference: float = 0.0
    novelty_score: float = 0.0

    # Final scores
    stability_score: float = 0.0
    overall_score: float = 0.0
    rank: int = 0

    # Notes
    functional_notes: str = ""
    pdb_path: str = ""


@dataclass
class RankingConfig:
    """Configuration for ranking weights."""
    # Weight factors (sum to 1.0)
    weight_structural_confidence: float = 0.30
    weight_active_site: float = 0.25
    weight_novelty: float = 0.15
    weight_stability: float = 0.20
    weight_solubility: float = 0.10

    # Thresholds
    min_plddt: float = 50.0
    min_length: int = 150
    max_length: int = 600
    max_disorder_fraction: float = 0.4

    # Bonus/penalty factors
    bonus_reviewed: float = 0.05
    penalty_membrane: float = 0.10


class EnzymeRanker:
    """
    Ranks enzyme candidates for experimental validation.

    Combines structural predictions, functional analysis, and
    sequence properties into a single ranking score.
    """

    # Reference enzymes for novelty calculation
    REFERENCE_ENZYMES = {
        "A0A0K8P6T7": "IsPETase",
        "A0A0K8P8E7": "IsMHETase",
        "Q6A0I4": "TfCut2",
        "E9LVH8": "LCC",
    }

    def __init__(self, config: Optional[RankingConfig] = None):
        """
        Initialize ranker.

        Args:
            config: Ranking configuration
        """
        self.config = config or RankingConfig()
        self.candidates: list[EnzymeCandidate] = []

    def load_data(
        self,
        sequences_file: str,
        structures_file: str,
        analysis_file: str
    ) -> None:
        """
        Load data from pipeline outputs.

        Args:
            sequences_file: Sequence metadata TSV
            structures_file: Structure predictions summary
            analysis_file: Structure analysis JSON
        """
        # Load sequence metadata
        sequences = {}
        if Path(sequences_file).exists():
            with open(sequences_file, 'r') as f:
                reader = csv.DictReader(f, delimiter='\t')
                for row in reader:
                    sequences[row['accession']] = row

        # Load structure predictions
        structures = {}
        if Path(structures_file).exists():
            with open(structures_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    structures[row['sequence_id']] = row

        # Load structure analysis
        analysis = {}
        if Path(analysis_file).exists():
            with open(analysis_file, 'r') as f:
                data = json.load(f)
                for item in data:
                    analysis[item['sequence_id']] = item

        # Merge data into candidates
        all_ids = set(sequences.keys()) | set(structures.keys()) | set(analysis.keys())

        for seq_id in all_ids:
            seq_data = sequences.get(seq_id, {})
            struct_data = structures.get(seq_id, {})
            anal_data = analysis.get(seq_id, {})

            candidate = EnzymeCandidate(
                sequence_id=seq_id,
                accession=seq_data.get('accession', seq_id),
                organism=seq_data.get('organism', ''),
                length=int(seq_data.get('length', 0)),
                plddt_mean=float(struct_data.get('plddt_mean', 0)),
                pae_mean=float(struct_data.get('pae_mean', 0)) if struct_data.get('pae_mean', 'N/A') != 'N/A' else 0,
                ptm_score=float(struct_data.get('ptm_score', 0)) if struct_data.get('ptm_score', 'N/A') != 'N/A' else 0,
                disorder_fraction=float(struct_data.get('disorder_fraction', 0)),
                active_site_accessibility=float(anal_data.get('active_site_accessibility', 0)),
                num_druggable_pockets=int(anal_data.get('num_druggable_pockets', 0)),
                catalytic_residues=anal_data.get('catalytic_residues', []),
                is_soluble=anal_data.get('is_soluble', True),
                molecular_weight=float(anal_data.get('molecular_weight', 0)),
                isoelectric_point=float(anal_data.get('isoelectric_point', 0)),
                hydrophobicity=float(anal_data.get('hydrophobicity_mean', 0)),
                pdb_path=anal_data.get('pdb_path', '')
            )

            self.candidates.append(candidate)

    def create_candidate(
        self,
        sequence_id: str,
        **kwargs
    ) -> EnzymeCandidate:
        """
        Create a candidate manually with provided data.

        Args:
            sequence_id: Unique identifier
            **kwargs: Candidate attributes

        Returns:
            EnzymeCandidate object
        """
        candidate = EnzymeCandidate(sequence_id=sequence_id, **kwargs)
        self.candidates.append(candidate)
        return candidate

    def calculate_structural_score(self, candidate: EnzymeCandidate) -> float:
        """
        Calculate structural confidence score (0-1).

        Based on pLDDT, PAE, and disorder content.
        """
        # pLDDT component (most important)
        plddt_score = min(candidate.plddt_mean / 100, 1.0)

        # PAE component (lower is better)
        pae_score = max(0, 1 - candidate.pae_mean / 30) if candidate.pae_mean > 0 else 0.5

        # pTM component
        ptm_score = candidate.ptm_score if candidate.ptm_score > 0 else 0.5

        # Disorder penalty
        disorder_penalty = candidate.disorder_fraction * 0.5

        # Combine scores
        structural_score = (
            0.5 * plddt_score +
            0.2 * pae_score +
            0.2 * ptm_score +
            0.1 * (1 - disorder_penalty)
        )

        return min(max(structural_score, 0), 1)

    def calculate_active_site_score(self, candidate: EnzymeCandidate) -> float:
        """
        Calculate active site accessibility score (0-1).

        Based on pocket detection and catalytic residue identification.
        """
        # Base accessibility score
        accessibility = candidate.active_site_accessibility

        # Pocket bonus
        pocket_bonus = min(candidate.num_druggable_pockets * 0.15, 0.3)

        # Catalytic residue bonus
        catalytic_bonus = min(len(candidate.catalytic_residues) * 0.05, 0.2)

        return min(accessibility + pocket_bonus + catalytic_bonus, 1)

    def calculate_novelty_score(self, candidate: EnzymeCandidate) -> float:
        """
        Calculate novelty score (0-1).

        Higher score for enzymes dissimilar to known references.
        """
        # Check if this is a reference enzyme
        if candidate.accession in self.REFERENCE_ENZYMES:
            return 0.3  # Low novelty for known enzymes

        # If similarity data available
        if candidate.similarity_to_reference > 0:
            # Lower similarity = higher novelty
            novelty = 1 - (candidate.similarity_to_reference / 100)
            # But too different might be non-functional
            if novelty > 0.7:
                novelty = 0.7 - (novelty - 0.7) * 0.5

            return novelty

        # Default moderate novelty for unknown
        return 0.6

    def calculate_stability_score(self, candidate: EnzymeCandidate) -> float:
        """
        Calculate predicted stability score (0-1).

        Based on sequence features associated with stability.
        """
        score = 0.5  # Base score

        # Length factor (optimal around 250-400 aa for cutinases)
        if 200 <= candidate.length <= 500:
            length_factor = 0.2
        elif 150 <= candidate.length <= 600:
            length_factor = 0.1
        else:
            length_factor = 0

        # pI factor (stability often better at moderate pI)
        if 5 <= candidate.isoelectric_point <= 8:
            pi_factor = 0.15
        else:
            pi_factor = 0.05

        # Hydrophobicity (moderate is good for soluble enzymes)
        if -1 <= candidate.hydrophobicity <= 0:
            hydro_factor = 0.15
        else:
            hydro_factor = 0.05

        return min(score + length_factor + pi_factor + hydro_factor, 1)

    def calculate_solubility_score(self, candidate: EnzymeCandidate) -> float:
        """
        Calculate solubility/expressibility score (0-1).

        Higher for soluble, well-expressed proteins.
        """
        if not candidate.is_soluble:
            return 0.3  # Membrane proteins harder to work with

        # Base soluble score
        score = 0.7

        # Molecular weight factor (20-50 kDa optimal for expression)
        mw_kda = candidate.molecular_weight / 1000
        if 20 <= mw_kda <= 50:
            score += 0.15
        elif 15 <= mw_kda <= 70:
            score += 0.1

        # Low hydrophobicity bonus
        if candidate.hydrophobicity < 0:
            score += 0.1

        return min(score, 1)

    def rank_candidates(self, verbose: bool = True) -> list[EnzymeCandidate]:
        """
        Calculate scores and rank all candidates.

        Returns:
            Sorted list of candidates (best first)
        """
        if verbose:
            print(f"Ranking {len(self.candidates)} candidates...")

        for candidate in self.candidates:
            # Calculate component scores
            structural = self.calculate_structural_score(candidate)
            active_site = self.calculate_active_site_score(candidate)
            novelty = self.calculate_novelty_score(candidate)
            stability = self.calculate_stability_score(candidate)
            solubility = self.calculate_solubility_score(candidate)

            # Store component scores
            candidate.stability_score = stability
            candidate.novelty_score = novelty

            # Calculate weighted overall score
            candidate.overall_score = (
                self.config.weight_structural_confidence * structural +
                self.config.weight_active_site * active_site +
                self.config.weight_novelty * novelty +
                self.config.weight_stability * stability +
                self.config.weight_solubility * solubility
            )

            # Generate functional notes
            candidate.functional_notes = self._generate_notes(candidate)

        # Filter candidates
        filtered = [c for c in self.candidates if self._passes_thresholds(c)]

        # Sort by overall score (descending)
        filtered.sort(key=lambda x: x.overall_score, reverse=True)

        # Assign ranks
        for i, candidate in enumerate(filtered):
            candidate.rank = i + 1

        if verbose:
            print(f"  {len(filtered)} candidates passed filtering")
            if filtered:
                print(f"  Top score: {filtered[0].overall_score:.3f}")
                print(f"  Median score: {filtered[len(filtered)//2].overall_score:.3f}")

        return filtered

    def _passes_thresholds(self, candidate: EnzymeCandidate) -> bool:
        """Check if candidate passes minimum thresholds."""
        if candidate.plddt_mean < self.config.min_plddt:
            return False
        if candidate.length < self.config.min_length:
            return False
        if candidate.length > self.config.max_length:
            return False
        if candidate.disorder_fraction > self.config.max_disorder_fraction:
            return False
        return True

    def _generate_notes(self, candidate: EnzymeCandidate) -> str:
        """Generate human-readable functional notes."""
        notes = []

        # Structural confidence
        if candidate.plddt_mean >= 90:
            notes.append("Very high confidence structure")
        elif candidate.plddt_mean >= 70:
            notes.append("Good confidence structure")
        elif candidate.plddt_mean >= 50:
            notes.append("Moderate confidence structure")

        # Active site
        if candidate.num_druggable_pockets >= 2:
            notes.append("Multiple potential binding sites")
        elif candidate.num_druggable_pockets == 1:
            notes.append("Clear active site detected")

        # Catalytic features
        if candidate.catalytic_residues:
            notes.append(f"Catalytic residues: {', '.join(candidate.catalytic_residues[:3])}")

        # Solubility
        if candidate.is_soluble:
            notes.append("Predicted soluble (easier expression)")
        else:
            notes.append("May require membrane expression system")

        # Novelty
        if candidate.accession in self.REFERENCE_ENZYMES:
            notes.append(f"Reference enzyme ({self.REFERENCE_ENZYMES[candidate.accession]})")
        elif candidate.novelty_score > 0.5:
            notes.append("Novel sequence - potential for new properties")

        return "; ".join(notes)

    def save_rankings(
        self,
        output_dir: str = "results",
        top_n: int = 50
    ) -> dict[str, Path]:
        """
        Save ranking results to multiple formats.

        Args:
            output_dir: Output directory
            top_n: Number of top candidates to include in reports

        Returns:
            Dictionary of output file paths
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        ranked = self.rank_candidates(verbose=False)
        top_candidates = ranked[:top_n]

        outputs = {}

        # Save CSV
        csv_path = output_dir / "ranked_candidates.csv"
        outputs["csv"] = csv_path
        self._save_csv(top_candidates, csv_path)

        # Save JSON
        json_path = output_dir / "ranked_candidates.json"
        outputs["json"] = json_path
        self._save_json(top_candidates, json_path)

        # Save Markdown report
        md_path = output_dir / "ranking_report.md"
        outputs["markdown"] = md_path
        self._save_markdown(top_candidates, md_path)

        # Save HTML report
        html_path = output_dir / "ranking_report.html"
        outputs["html"] = html_path
        self._save_html(top_candidates, html_path)

        return outputs

    def _save_csv(self, candidates: list[EnzymeCandidate], path: Path) -> None:
        """Save rankings to CSV."""
        with open(path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Rank", "Sequence_ID", "Accession", "Organism", "Length",
                "pLDDT", "Overall_Score", "Structural_Score", "Active_Site_Score",
                "Novelty_Score", "Stability_Score", "Is_Soluble",
                "Druggable_Pockets", "Functional_Notes", "PDB_Path"
            ])

            for c in candidates:
                writer.writerow([
                    c.rank, c.sequence_id, c.accession, c.organism, c.length,
                    f"{c.plddt_mean:.1f}", f"{c.overall_score:.3f}",
                    f"{self.calculate_structural_score(c):.3f}",
                    f"{self.calculate_active_site_score(c):.3f}",
                    f"{c.novelty_score:.3f}", f"{c.stability_score:.3f}",
                    c.is_soluble, c.num_druggable_pockets,
                    c.functional_notes, c.pdb_path
                ])

        print(f"Saved CSV: {path}")

    def _save_json(self, candidates: list[EnzymeCandidate], path: Path) -> None:
        """Save rankings to JSON."""
        data = []
        for c in candidates:
            data.append({
                "rank": c.rank,
                "sequence_id": c.sequence_id,
                "accession": c.accession,
                "organism": c.organism,
                "length": c.length,
                "scores": {
                    "overall": round(c.overall_score, 4),
                    "structural": round(self.calculate_structural_score(c), 4),
                    "active_site": round(self.calculate_active_site_score(c), 4),
                    "novelty": round(c.novelty_score, 4),
                    "stability": round(c.stability_score, 4)
                },
                "properties": {
                    "plddt_mean": round(c.plddt_mean, 2),
                    "pae_mean": round(c.pae_mean, 2),
                    "is_soluble": c.is_soluble,
                    "molecular_weight": round(c.molecular_weight, 1),
                    "isoelectric_point": round(c.isoelectric_point, 2)
                },
                "catalytic_residues": c.catalytic_residues,
                "functional_notes": c.functional_notes,
                "pdb_path": c.pdb_path
            })

        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Saved JSON: {path}")

    def _save_markdown(self, candidates: list[EnzymeCandidate], path: Path) -> None:
        """Save rankings to Markdown report."""
        content = f"""# ClimateEnzyme Candidate Rankings

## PET-Degrading Enzyme Discovery Pipeline Results

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Total Candidates Analyzed:** {len(self.candidates)}
**Top Candidates Shown:** {len(candidates)}

---

## Scoring Methodology

Candidates are ranked by a weighted combination of:

| Factor | Weight | Description |
|--------|--------|-------------|
| Structural Confidence | {self.config.weight_structural_confidence:.0%} | pLDDT, PAE, disorder content |
| Active Site Accessibility | {self.config.weight_active_site:.0%} | Pocket detection, catalytic residues |
| Novelty | {self.config.weight_novelty:.0%} | Sequence divergence from known enzymes |
| Predicted Stability | {self.config.weight_stability:.0%} | Length, pI, composition |
| Solubility | {self.config.weight_solubility:.0%} | Expression feasibility |

---

## Top Candidates

"""
        # Top 10 detailed
        content += "### Top 10 Candidates (Detailed)\n\n"

        for c in candidates[:10]:
            confidence = "***" if c.plddt_mean >= 90 else "**" if c.plddt_mean >= 70 else "*"

            content += f"""#### #{c.rank}: {c.sequence_id} {confidence}

- **Organism:** {c.organism or 'Unknown'}
- **Length:** {c.length} aa
- **Overall Score:** {c.overall_score:.3f}
- **pLDDT:** {c.plddt_mean:.1f}
- **Soluble:** {'Yes' if c.is_soluble else 'No'}
- **Notes:** {c.functional_notes}

---

"""

        # Summary table
        content += "### Complete Rankings Table\n\n"
        content += "| Rank | ID | Organism | Length | pLDDT | Score | Notes |\n"
        content += "|------|----|---------:|-------:|------:|------:|-------|\n"

        for c in candidates:
            content += f"| {c.rank} | {c.sequence_id[:20]} | {c.organism[:20] if c.organism else '-'} | "
            content += f"{c.length} | {c.plddt_mean:.1f} | {c.overall_score:.3f} | "
            content += f"{c.functional_notes[:50]}... |\n"

        content += """

---

## Next Steps

1. **Experimental Validation**: Test top candidates for PET hydrolysis activity
2. **Protein Expression**: Start with soluble candidates for easier expression
3. **Structure Validation**: Confirm predicted structures with experimental methods
4. **Engineering**: Use high-confidence structures as templates for enzyme improvement

## Data Files

- `ranked_candidates.csv` - Full ranking data
- `ranked_candidates.json` - Machine-readable results
- `data/structures/` - Predicted PDB structures

---

*Generated by ClimateEnzyme Discovery Pipeline*
"""

        with open(path, 'w') as f:
            f.write(content)

        print(f"Saved Markdown: {path}")

    def _save_html(self, candidates: list[EnzymeCandidate], path: Path) -> None:
        """Save rankings to HTML report."""
        top_score = f"{candidates[0].overall_score:.3f}" if candidates else "0"
        high_conf_count = sum(1 for c in candidates if c.plddt_mean >= 70)

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ClimateEnzyme Rankings - PET Degradation Candidates</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        h1 {{ color: #2e7d32; border-bottom: 3px solid #4caf50; padding-bottom: 10px; }}
        h2 {{ color: #1565c0; margin-top: 30px; }}
        .stats {{ display: flex; gap: 20px; margin: 20px 0; }}
        .stat-box {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            flex: 1;
            text-align: center;
        }}
        .stat-value {{ font-size: 2em; font-weight: bold; color: #2e7d32; }}
        .stat-label {{ color: #666; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #1565c0; color: white; }}
        tr:hover {{ background: #f5f5f5; }}
        .score-high {{ color: #2e7d32; font-weight: bold; }}
        .score-medium {{ color: #f57c00; }}
        .score-low {{ color: #c62828; }}
        .candidate-card {{
            background: white;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #4caf50;
        }}
        .candidate-card h3 {{ margin-top: 0; color: #1565c0; }}
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            margin-right: 5px;
        }}
        .badge-success {{ background: #e8f5e9; color: #2e7d32; }}
        .badge-info {{ background: #e3f2fd; color: #1565c0; }}
        .badge-warning {{ background: #fff3e0; color: #e65100; }}
        footer {{ margin-top: 40px; text-align: center; color: #666; }}
    </style>
</head>
<body>
    <h1>ClimateEnzyme Discovery Pipeline</h1>
    <h2 style="color: #666; font-weight: normal;">PET-Degrading Enzyme Candidate Rankings</h2>

    <div class="stats">
        <div class="stat-box">
            <div class="stat-value">{len(self.candidates)}</div>
            <div class="stat-label">Total Candidates</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{len(candidates)}</div>
            <div class="stat-label">Passed Filtering</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{top_score}</div>
            <div class="stat-label">Top Score</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{high_conf_count}</div>
            <div class="stat-label">High Confidence</div>
        </div>
    </div>

    <h2>Top 10 Candidates</h2>
"""

        for c in candidates[:10]:
            score_class = "score-high" if c.overall_score >= 0.7 else "score-medium" if c.overall_score >= 0.5 else "score-low"
            plddt_class = "score-high" if c.plddt_mean >= 70 else "score-medium" if c.plddt_mean >= 50 else "score-low"

            html += f"""
    <div class="candidate-card">
        <h3>#{c.rank}: {c.sequence_id}</h3>
        <p>
            <span class="badge badge-info">Organism: {c.organism or 'Unknown'}</span>
            <span class="badge badge-info">Length: {c.length} aa</span>
            <span class="badge {'badge-success' if c.is_soluble else 'badge-warning'}">
                {'Soluble' if c.is_soluble else 'Membrane'}
            </span>
        </p>
        <p><strong>Overall Score:</strong> <span class="{score_class}">{c.overall_score:.3f}</span></p>
        <p><strong>pLDDT:</strong> <span class="{plddt_class}">{c.plddt_mean:.1f}</span></p>
        <p><strong>Notes:</strong> {c.functional_notes}</p>
    </div>
"""

        html += """
    <h2>Complete Rankings</h2>
    <table>
        <thead>
            <tr>
                <th>Rank</th>
                <th>ID</th>
                <th>Organism</th>
                <th>Length</th>
                <th>pLDDT</th>
                <th>Score</th>
                <th>Soluble</th>
            </tr>
        </thead>
        <tbody>
"""

        for c in candidates:
            score_class = "score-high" if c.overall_score >= 0.7 else "score-medium" if c.overall_score >= 0.5 else "score-low"
            html += f"""
            <tr>
                <td>{c.rank}</td>
                <td>{c.sequence_id}</td>
                <td>{c.organism or '-'}</td>
                <td>{c.length}</td>
                <td>{c.plddt_mean:.1f}</td>
                <td class="{score_class}">{c.overall_score:.3f}</td>
                <td>{'Yes' if c.is_soluble else 'No'}</td>
            </tr>
"""

        html += f"""
        </tbody>
    </table>

    <footer>
        <p>Generated by ClimateEnzyme Discovery Pipeline on {datetime.now().strftime("%Y-%m-%d %H:%M")}</p>
        <p>Open Source | MIT License | <a href="https://github.com">GitHub Repository</a></p>
    </footer>
</body>
</html>
"""

        with open(path, 'w') as f:
            f.write(html)

        print(f"Saved HTML: {path}")


def run_ranking(
    sequences_file: str = "data/sequences/sequence_metadata.tsv",
    structures_file: str = "data/structures/structure_summary.csv",
    analysis_file: str = "data/analysis/structure_analysis.json",
    output_dir: str = "results",
    verbose: bool = True
) -> list[EnzymeCandidate]:
    """
    Run the complete ranking pipeline.

    Args:
        sequences_file: Path to sequence metadata
        structures_file: Path to structure summary
        analysis_file: Path to analysis results
        output_dir: Output directory
        verbose: Print progress

    Returns:
        Ranked list of candidates
    """
    ranker = EnzymeRanker()

    if verbose:
        print("Loading data...")

    ranker.load_data(sequences_file, structures_file, analysis_file)

    if verbose:
        print("Calculating rankings...")

    ranked = ranker.rank_candidates(verbose=verbose)

    if verbose:
        print("\nSaving results...")

    outputs = ranker.save_rankings(output_dir)

    if verbose:
        print("\nOutput files:")
        for name, path in outputs.items():
            print(f"  {name}: {path}")

    return ranked


if __name__ == "__main__":
    # Run ranking pipeline
    run_ranking()
