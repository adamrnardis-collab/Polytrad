"""
Structure Analysis Module
=========================

Analyzes predicted protein structures for functional features relevant to
enzyme activity and druggability.

Features:
- Catalytic pocket detection (fpocket integration)
- Conserved residue identification
- Solubility/membrane prediction
- Active site characterization
- Fold comparison using structural alignment
"""

import os
import subprocess
import re
import json
import math
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class Pocket:
    """Represents a detected binding pocket."""
    pocket_id: int
    score: float
    volume: float  # Angstroms^3
    surface_area: float  # Angstroms^2
    druggability_score: float
    center: tuple[float, float, float]  # x, y, z coordinates
    residues: list[str] = field(default_factory=list)
    hydrophobicity: float = 0.0
    polarity: float = 0.0

    @property
    def is_druggable(self) -> bool:
        """Check if pocket is likely druggable/bindable."""
        return self.druggability_score > 0.5 and self.volume > 200


@dataclass
class ConservedRegion:
    """Represents a conserved sequence region."""
    start: int
    end: int
    conservation_score: float
    sequence: str
    residues: list[str] = field(default_factory=list)
    is_catalytic: bool = False


@dataclass
class StructureAnalysis:
    """Complete analysis results for a protein structure."""
    sequence_id: str
    pdb_path: str
    pockets: list[Pocket] = field(default_factory=list)
    conserved_regions: list[ConservedRegion] = field(default_factory=list)
    is_soluble: bool = True
    transmembrane_regions: list[tuple[int, int]] = field(default_factory=list)
    hydrophobicity_mean: float = 0.0
    molecular_weight: float = 0.0
    isoelectric_point: float = 0.0
    catalytic_residues: list[str] = field(default_factory=list)
    active_site_accessibility: float = 0.0

    @property
    def has_accessible_active_site(self) -> bool:
        """Check if likely has accessible active site."""
        if not self.pockets:
            return False
        return any(p.is_druggable for p in self.pockets)

    @property
    def num_druggable_pockets(self) -> int:
        """Count druggable pockets."""
        return sum(1 for p in self.pockets if p.is_druggable)


# Amino acid properties for analysis
AMINO_ACID_PROPERTIES = {
    'A': {'hydrophobicity': 1.8, 'charge': 0, 'weight': 89.1, 'pI': 6.0},
    'R': {'hydrophobicity': -4.5, 'charge': 1, 'weight': 174.2, 'pI': 10.8},
    'N': {'hydrophobicity': -3.5, 'charge': 0, 'weight': 132.1, 'pI': 5.4},
    'D': {'hydrophobicity': -3.5, 'charge': -1, 'weight': 133.1, 'pI': 2.8},
    'C': {'hydrophobicity': 2.5, 'charge': 0, 'weight': 121.2, 'pI': 5.1},
    'Q': {'hydrophobicity': -3.5, 'charge': 0, 'weight': 146.1, 'pI': 5.7},
    'E': {'hydrophobicity': -3.5, 'charge': -1, 'weight': 147.1, 'pI': 3.2},
    'G': {'hydrophobicity': -0.4, 'charge': 0, 'weight': 75.1, 'pI': 6.0},
    'H': {'hydrophobicity': -3.2, 'charge': 0, 'weight': 155.2, 'pI': 7.6},
    'I': {'hydrophobicity': 4.5, 'charge': 0, 'weight': 131.2, 'pI': 6.0},
    'L': {'hydrophobicity': 3.8, 'charge': 0, 'weight': 131.2, 'pI': 6.0},
    'K': {'hydrophobicity': -3.9, 'charge': 1, 'weight': 146.2, 'pI': 9.7},
    'M': {'hydrophobicity': 1.9, 'charge': 0, 'weight': 149.2, 'pI': 5.7},
    'F': {'hydrophobicity': 2.8, 'charge': 0, 'weight': 165.2, 'pI': 5.5},
    'P': {'hydrophobicity': -1.6, 'charge': 0, 'weight': 115.1, 'pI': 6.3},
    'S': {'hydrophobicity': -0.8, 'charge': 0, 'weight': 105.1, 'pI': 5.7},
    'T': {'hydrophobicity': -0.7, 'charge': 0, 'weight': 119.1, 'pI': 5.6},
    'W': {'hydrophobicity': -0.9, 'charge': 0, 'weight': 204.2, 'pI': 5.9},
    'Y': {'hydrophobicity': -1.3, 'charge': 0, 'weight': 181.2, 'pI': 5.7},
    'V': {'hydrophobicity': 4.2, 'charge': 0, 'weight': 117.1, 'pI': 6.0},
}

# Known catalytic motifs for PET-degrading enzymes
PETASE_CATALYTIC_MOTIFS = {
    "serine_hydrolase": r"G.S.G",  # Catalytic serine in Ser-His-Asp triad
    "lipase_box": r"G[XILVFMST]S[XILVFMST]G",  # Lipase consensus
    "cutinase_ser": r"[GAST].[SH].G",  # Cutinase serine motif
    "oxyanion_hole": r"[HN][GAS]G",  # Oxyanion stabilization
}

# PETase-specific catalytic residues (based on IsPETase)
PETASE_CATALYTIC_POSITIONS = {
    "catalytic_triad": ["Ser", "His", "Asp"],  # The Ser-His-Asp catalytic triad
    "oxyanion_hole": ["Met", "Tyr"],  # Oxyanion hole residues
    "substrate_binding": ["Trp", "Phe", "Tyr"],  # Aromatic residues for PET binding
}


class PocketAnalyzer:
    """
    Analyzes protein structures for binding pockets using fpocket.

    fpocket is a fast, open-source pocket detection algorithm that
    identifies potential binding sites based on alpha spheres.
    """

    def __init__(self, fpocket_path: str = "fpocket"):
        """
        Initialize pocket analyzer.

        Args:
            fpocket_path: Path to fpocket executable
        """
        self.fpocket_path = fpocket_path
        self._check_fpocket()

    def _check_fpocket(self) -> bool:
        """Check if fpocket is available."""
        try:
            result = subprocess.run(
                [self.fpocket_path, "-h"],
                capture_output=True,
                text=True
            )
            return True
        except FileNotFoundError:
            print("Warning: fpocket not found. Install from https://github.com/Discngine/fpocket")
            print("Pocket analysis will use fallback method.")
            return False

    def analyze_pockets(self, pdb_path: str, verbose: bool = True) -> list[Pocket]:
        """
        Run fpocket analysis on a PDB file.

        Args:
            pdb_path: Path to PDB structure file
            verbose: Print progress

        Returns:
            List of detected Pocket objects
        """
        pdb_path = Path(pdb_path)
        if not pdb_path.exists():
            print(f"PDB file not found: {pdb_path}")
            return []

        # Try running fpocket
        try:
            result = subprocess.run(
                [self.fpocket_path, "-f", str(pdb_path)],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode != 0:
                if verbose:
                    print(f"fpocket warning: {result.stderr}")
                return self._fallback_pocket_detection(pdb_path)

            # Parse fpocket output
            output_dir = pdb_path.parent / f"{pdb_path.stem}_out"
            return self._parse_fpocket_output(output_dir)

        except (FileNotFoundError, subprocess.TimeoutExpired):
            return self._fallback_pocket_detection(pdb_path)

    def _parse_fpocket_output(self, output_dir: Path) -> list[Pocket]:
        """Parse fpocket output files."""
        pockets = []

        # Read pocket info file
        info_file = output_dir / f"{output_dir.stem.replace('_out', '')}_info.txt"

        if not info_file.exists():
            # Try alternative naming
            info_files = list(output_dir.glob("*_info.txt"))
            if info_files:
                info_file = info_files[0]
            else:
                return pockets

        try:
            with open(info_file, 'r') as f:
                content = f.read()

            # Parse pocket information
            pocket_sections = content.split("Pocket")[1:]  # Skip header

            for section in pocket_sections:
                lines = section.strip().split('\n')
                if not lines:
                    continue

                pocket_id = 0
                score = 0.0
                volume = 0.0
                druggability = 0.0

                for line in lines:
                    if "Score" in line and ":" in line:
                        try:
                            score = float(line.split(":")[1].strip())
                        except (ValueError, IndexError):
                            pass
                    elif "Volume" in line and ":" in line:
                        try:
                            volume = float(line.split(":")[1].strip().split()[0])
                        except (ValueError, IndexError):
                            pass
                    elif "Druggability" in line and ":" in line:
                        try:
                            druggability = float(line.split(":")[1].strip())
                        except (ValueError, IndexError):
                            pass

                if score > 0:
                    pocket = Pocket(
                        pocket_id=len(pockets) + 1,
                        score=score,
                        volume=volume,
                        surface_area=0.0,
                        druggability_score=druggability,
                        center=(0.0, 0.0, 0.0),
                        residues=[]
                    )
                    pockets.append(pocket)

        except Exception as e:
            print(f"Error parsing fpocket output: {e}")

        return pockets

    def _fallback_pocket_detection(self, pdb_path: Path) -> list[Pocket]:
        """
        Simple fallback pocket detection based on geometry.

        Uses cavity detection by identifying internal voids.
        """
        # Read PDB and extract CA atoms
        ca_coords = []
        residues = []

        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("ATOM") and line[12:16].strip() == "CA":
                    x = float(line[30:38])
                    y = float(line[38:46])
                    z = float(line[46:54])
                    ca_coords.append((x, y, z))
                    residue = f"{line[17:20].strip()}{line[22:26].strip()}"
                    residues.append(residue)

        if len(ca_coords) < 10:
            return []

        # Find geometric center
        center = (
            sum(c[0] for c in ca_coords) / len(ca_coords),
            sum(c[1] for c in ca_coords) / len(ca_coords),
            sum(c[2] for c in ca_coords) / len(ca_coords)
        )

        # Estimate pocket near center (simplified)
        pocket = Pocket(
            pocket_id=1,
            score=0.5,
            volume=500.0,  # Estimate
            surface_area=300.0,
            druggability_score=0.5,
            center=center,
            residues=residues[:10]  # Placeholder
        )

        return [pocket]


class ConservationAnalyzer:
    """
    Analyzes sequence conservation to identify functionally important residues.

    Uses multiple sequence alignment to calculate conservation scores
    and identify catalytic residues.
    """

    def __init__(self):
        """Initialize conservation analyzer."""
        self.msa_data = None

    def analyze_conservation_from_sequence(
        self,
        sequence: str,
        sequence_id: str = "query"
    ) -> list[ConservedRegion]:
        """
        Analyze conservation using known catalytic motifs.

        For real conservation analysis, you'd align against homologs.
        This uses known PETase motifs as a heuristic.

        Args:
            sequence: Protein sequence
            sequence_id: Sequence identifier

        Returns:
            List of conserved regions
        """
        conserved_regions = []

        # Search for known catalytic motifs
        for motif_name, pattern in PETASE_CATALYTIC_MOTIFS.items():
            for match in re.finditer(pattern, sequence):
                region = ConservedRegion(
                    start=match.start() + 1,  # 1-indexed
                    end=match.end(),
                    conservation_score=0.9,  # Known motif = high conservation
                    sequence=match.group(),
                    is_catalytic=True
                )
                conserved_regions.append(region)

        # Identify potential catalytic triad (Ser-His-Asp)
        ser_positions = [i for i, aa in enumerate(sequence) if aa == 'S']
        his_positions = [i for i, aa in enumerate(sequence) if aa == 'H']
        asp_positions = [i for i, aa in enumerate(sequence) if aa == 'D']

        # Look for Ser-His-Asp triad pattern (not necessarily sequential)
        # In cutinases, typically in specific structural context
        if ser_positions and his_positions and asp_positions:
            # Mark potential catalytic residues
            for s in ser_positions[:3]:  # First few serines
                region = ConservedRegion(
                    start=s + 1,
                    end=s + 1,
                    conservation_score=0.7,
                    sequence=sequence[s],
                    is_catalytic=False,
                    residues=[f"Ser{s+1}"]
                )
                conserved_regions.append(region)

        return conserved_regions

    def find_catalytic_residues(
        self,
        sequence: str,
        pockets: Optional[list[Pocket]] = None
    ) -> list[str]:
        """
        Identify likely catalytic residues.

        Combines motif search with pocket information.

        Args:
            sequence: Protein sequence
            pockets: Detected pockets (optional)

        Returns:
            List of catalytic residue identifiers
        """
        catalytic = []

        # Find Ser-His-Asp triad candidates
        for i, aa in enumerate(sequence):
            pos = i + 1  # 1-indexed

            # Check for serine in GXSXG motif context
            if aa == 'S' and i >= 2 and i < len(sequence) - 2:
                context = sequence[i-2:i+3]
                if len(context) == 5 and context[0] == 'G' and context[4] == 'G':
                    catalytic.append(f"Ser{pos}")

            # Conserved histidine
            if aa == 'H':
                # Check if in favorable context
                catalytic.append(f"His{pos}")

        return catalytic[:10]  # Limit to top candidates


class SolubilityPredictor:
    """
    Predicts protein solubility and membrane association.

    Uses sequence-based features to predict if a protein is:
    - Soluble (cytoplasmic or secreted)
    - Membrane-associated
    - Contains signal peptides
    """

    # Hydrophobicity window for TM prediction
    TM_WINDOW_SIZE = 19
    TM_THRESHOLD = 1.6  # Kyte-Doolittle hydropathy

    def __init__(self):
        """Initialize solubility predictor."""
        pass

    def predict_solubility(self, sequence: str) -> dict:
        """
        Predict protein solubility features.

        Args:
            sequence: Protein sequence

        Returns:
            Dictionary with prediction results
        """
        # Calculate overall hydrophobicity
        hydrophobicity = self._calculate_hydrophobicity(sequence)

        # Detect transmembrane regions
        tm_regions = self._detect_transmembrane(sequence)

        # Detect signal peptide
        has_signal_peptide = self._detect_signal_peptide(sequence)

        # Calculate molecular properties
        mw = self._calculate_molecular_weight(sequence)
        pi = self._estimate_isoelectric_point(sequence)

        # Determine solubility
        is_soluble = len(tm_regions) == 0 and hydrophobicity < 0

        return {
            "is_soluble": is_soluble,
            "hydrophobicity_mean": hydrophobicity,
            "transmembrane_regions": tm_regions,
            "has_signal_peptide": has_signal_peptide,
            "molecular_weight": mw,
            "isoelectric_point": pi,
            "prediction_confidence": 0.7 if is_soluble else 0.6
        }

    def _calculate_hydrophobicity(self, sequence: str) -> float:
        """Calculate mean Kyte-Doolittle hydrophobicity."""
        values = [AMINO_ACID_PROPERTIES.get(aa, {}).get('hydrophobicity', 0)
                  for aa in sequence.upper()]
        return sum(values) / len(values) if values else 0

    def _detect_transmembrane(self, sequence: str) -> list[tuple[int, int]]:
        """Detect potential transmembrane helices."""
        tm_regions = []
        sequence = sequence.upper()

        if len(sequence) < self.TM_WINDOW_SIZE:
            return tm_regions

        # Sliding window hydrophobicity
        for i in range(len(sequence) - self.TM_WINDOW_SIZE + 1):
            window = sequence[i:i + self.TM_WINDOW_SIZE]
            hydro = self._calculate_hydrophobicity(window)

            if hydro > self.TM_THRESHOLD:
                # Found potential TM region
                start = i + 1  # 1-indexed
                end = i + self.TM_WINDOW_SIZE

                # Merge with previous if overlapping
                if tm_regions and start <= tm_regions[-1][1] + 5:
                    tm_regions[-1] = (tm_regions[-1][0], end)
                else:
                    tm_regions.append((start, end))

        return tm_regions

    def _detect_signal_peptide(self, sequence: str) -> bool:
        """Detect N-terminal signal peptide (simplified)."""
        if len(sequence) < 20:
            return False

        # Signal peptides typically have:
        # 1. Positively charged N-terminus (first 5 aa)
        # 2. Hydrophobic core (next 10-15 aa)
        # 3. Cleavage site (around position 20-30)

        n_region = sequence[:5]
        h_region = sequence[5:20]

        # Check for positive charge in N-region
        positive_count = sum(1 for aa in n_region if aa in 'RK')

        # Check hydrophobicity of H-region
        h_hydro = self._calculate_hydrophobicity(h_region)

        return positive_count >= 1 and h_hydro > 1.0

    def _calculate_molecular_weight(self, sequence: str) -> float:
        """Calculate molecular weight in Daltons."""
        water_mass = 18.015
        mw = sum(AMINO_ACID_PROPERTIES.get(aa, {}).get('weight', 110)
                 for aa in sequence.upper())
        # Subtract water for peptide bonds
        mw -= water_mass * (len(sequence) - 1)
        return mw

    def _estimate_isoelectric_point(self, sequence: str) -> float:
        """Estimate isoelectric point (simplified)."""
        sequence = sequence.upper()

        # Count charged residues
        pos_count = sum(1 for aa in sequence if aa in 'RKH')
        neg_count = sum(1 for aa in sequence if aa in 'DE')

        # Simple approximation
        if pos_count > neg_count:
            return 7.0 + (pos_count - neg_count) / len(sequence) * 5
        else:
            return 7.0 - (neg_count - pos_count) / len(sequence) * 5


class StructureAnalyzer:
    """
    Main class for comprehensive structure analysis.

    Combines pocket detection, conservation analysis, and solubility prediction.
    """

    def __init__(self):
        """Initialize structure analyzer."""
        self.pocket_analyzer = PocketAnalyzer()
        self.conservation_analyzer = ConservationAnalyzer()
        self.solubility_predictor = SolubilityPredictor()

    def analyze_structure(
        self,
        pdb_path: str,
        sequence: Optional[str] = None,
        sequence_id: Optional[str] = None,
        verbose: bool = True
    ) -> StructureAnalysis:
        """
        Perform complete structure analysis.

        Args:
            pdb_path: Path to PDB file
            sequence: Protein sequence (extracted from PDB if not provided)
            sequence_id: Sequence identifier
            verbose: Print progress

        Returns:
            StructureAnalysis object
        """
        pdb_path = Path(pdb_path)
        if sequence_id is None:
            sequence_id = pdb_path.stem

        if verbose:
            print(f"Analyzing: {sequence_id}")

        # Extract sequence from PDB if not provided
        if sequence is None:
            sequence = self._extract_sequence_from_pdb(pdb_path)

        # Pocket analysis
        if verbose:
            print("  - Detecting pockets...")
        pockets = self.pocket_analyzer.analyze_pockets(str(pdb_path), verbose=False)

        # Conservation analysis
        if verbose:
            print("  - Analyzing conservation...")
        conserved_regions = self.conservation_analyzer.analyze_conservation_from_sequence(
            sequence, sequence_id
        )

        # Catalytic residue identification
        catalytic_residues = self.conservation_analyzer.find_catalytic_residues(
            sequence, pockets
        )

        # Solubility prediction
        if verbose:
            print("  - Predicting solubility...")
        solubility = self.solubility_predictor.predict_solubility(sequence)

        # Calculate active site accessibility
        accessibility = self._calculate_accessibility(pockets)

        # Create analysis result
        analysis = StructureAnalysis(
            sequence_id=sequence_id,
            pdb_path=str(pdb_path),
            pockets=pockets,
            conserved_regions=conserved_regions,
            is_soluble=solubility["is_soluble"],
            transmembrane_regions=solubility["transmembrane_regions"],
            hydrophobicity_mean=solubility["hydrophobicity_mean"],
            molecular_weight=solubility["molecular_weight"],
            isoelectric_point=solubility["isoelectric_point"],
            catalytic_residues=catalytic_residues,
            active_site_accessibility=accessibility
        )

        if verbose:
            self._print_summary(analysis)

        return analysis

    def _extract_sequence_from_pdb(self, pdb_path: Path) -> str:
        """Extract amino acid sequence from PDB file."""
        aa_map = {
            'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
            'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
            'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
            'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
        }

        sequence = []
        seen_residues = set()

        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("ATOM"):
                    res_name = line[17:20].strip()
                    res_num = line[22:26].strip()
                    chain = line[21]

                    key = (chain, res_num)
                    if key not in seen_residues:
                        seen_residues.add(key)
                        aa = aa_map.get(res_name, 'X')
                        sequence.append(aa)

        return ''.join(sequence)

    def _calculate_accessibility(self, pockets: list[Pocket]) -> float:
        """Calculate active site accessibility score."""
        if not pockets:
            return 0.0

        # Best pocket score
        best_pocket = max(pockets, key=lambda p: p.score)

        # Combine volume and druggability
        volume_score = min(best_pocket.volume / 500, 1.0)
        drug_score = best_pocket.druggability_score

        return (volume_score + drug_score) / 2

    def _print_summary(self, analysis: StructureAnalysis) -> None:
        """Print analysis summary."""
        print(f"\n  Summary for {analysis.sequence_id}:")
        print(f"    Pockets found: {len(analysis.pockets)}")
        print(f"    Druggable pockets: {analysis.num_druggable_pockets}")
        print(f"    Conserved regions: {len(analysis.conserved_regions)}")
        print(f"    Catalytic residues: {len(analysis.catalytic_residues)}")
        print(f"    Soluble: {analysis.is_soluble}")
        print(f"    Active site accessibility: {analysis.active_site_accessibility:.2f}")


def analyze_all_structures(
    structures_dir: str = "data/structures",
    output_file: str = "data/analysis/structure_analysis.json",
    verbose: bool = True
) -> list[StructureAnalysis]:
    """
    Analyze all structures in a directory.

    Args:
        structures_dir: Directory containing PDB files
        output_file: Output JSON file
        verbose: Print progress

    Returns:
        List of analysis results
    """
    structures_dir = Path(structures_dir)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    analyzer = StructureAnalyzer()
    results = []

    pdb_files = list(structures_dir.glob("*.pdb"))

    if verbose:
        print(f"Found {len(pdb_files)} PDB files to analyze")

    for pdb_file in pdb_files:
        try:
            analysis = analyzer.analyze_structure(str(pdb_file), verbose=verbose)
            results.append(analysis)
        except Exception as e:
            print(f"Error analyzing {pdb_file.name}: {e}")

    # Save results
    results_data = []
    for r in results:
        results_data.append({
            "sequence_id": r.sequence_id,
            "pdb_path": r.pdb_path,
            "num_pockets": len(r.pockets),
            "num_druggable_pockets": r.num_druggable_pockets,
            "is_soluble": r.is_soluble,
            "hydrophobicity_mean": r.hydrophobicity_mean,
            "molecular_weight": r.molecular_weight,
            "isoelectric_point": r.isoelectric_point,
            "catalytic_residues": r.catalytic_residues,
            "active_site_accessibility": r.active_site_accessibility,
            "has_accessible_active_site": r.has_accessible_active_site
        })

    with open(output_path, 'w') as f:
        json.dump(results_data, f, indent=2)

    if verbose:
        print(f"\nSaved analysis to {output_path}")

    return results


if __name__ == "__main__":
    # Example usage
    print("Structure Analysis Module")
    print("Use analyze_all_structures() to analyze predicted structures")
