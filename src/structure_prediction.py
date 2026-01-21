"""
Structure Prediction Module
===========================

Integrates with ColabFold for AlphaFold2-based structure prediction.
Generates batch scripts and parses prediction results.

This module:
1. Prepares sequences for ColabFold batch prediction
2. Generates Google Colab notebook code
3. Parses pLDDT, PAE, and disorder predictions
4. Filters low-confidence models
"""

import json
import os
import re
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
import csv


@dataclass
class StructurePrediction:
    """Represents an AlphaFold structure prediction result."""
    sequence_id: str
    pdb_path: str
    plddt_mean: float
    plddt_per_residue: list[float] = field(default_factory=list)
    pae_mean: Optional[float] = None
    pae_matrix: Optional[list[list[float]]] = None
    ptm_score: Optional[float] = None
    disorder_regions: list[tuple[int, int]] = field(default_factory=list)
    confident_regions: list[tuple[int, int]] = field(default_factory=list)
    sequence_length: int = 0

    @property
    def confidence_category(self) -> str:
        """Categorize overall confidence level."""
        if self.plddt_mean >= 90:
            return "very_high"
        elif self.plddt_mean >= 70:
            return "confident"
        elif self.plddt_mean >= 50:
            return "low"
        else:
            return "very_low"

    @property
    def disorder_fraction(self) -> float:
        """Fraction of sequence predicted as disordered."""
        if not self.disorder_regions or self.sequence_length == 0:
            return 0.0
        disorder_residues = sum(end - start + 1 for start, end in self.disorder_regions)
        return disorder_residues / self.sequence_length


@dataclass
class ColabFoldConfig:
    """Configuration for ColabFold predictions."""
    num_models: int = 3
    num_recycles: int = 3
    use_amber: bool = True  # Amber relaxation
    use_templates: bool = False
    msa_mode: str = "mmseqs2_uniref_env"  # or "single_sequence"
    pair_mode: str = "unpaired"
    model_type: str = "alphafold2_ptm"


class ColabFoldRunner:
    """
    Generates ColabFold batch scripts and Colab notebook code.

    ColabFold provides free GPU access for AlphaFold2 predictions
    through Google Colab, making structural biology accessible.
    """

    COLAB_NOTEBOOK_TEMPLATE = '''# ClimateEnzyme Structure Prediction with ColabFold
# ==============================================
#
# This notebook predicts structures for PET-degrading enzyme candidates
# using ColabFold (AlphaFold2) on Google Colab's free GPU.
#
# Instructions:
# 1. Upload your FASTA file to Colab or mount Google Drive
# 2. Run all cells in order
# 3. Download results when complete

# Cell 1: Install ColabFold
#@title Install ColabFold
%%bash
pip install -q "colabfold[alphafold] @ git+https://github.com/sokrypton/ColabFold"
pip install -q jax==0.4.23 jaxlib==0.4.23+cuda12.cudnn89 -f https://storage.googleapis.com/jax-releases/jax_cuda_releases.html

# Cell 2: Import and setup
#@title Setup
import os
from google.colab import files, drive
from colabfold.batch import run as run_colabfold
from colabfold.download import download_alphafold_params

# Download AlphaFold parameters (first run only)
download_alphafold_params("alphafold2_ptm")

# Cell 3: Mount Drive (optional)
#@title Mount Google Drive (optional)
drive.mount('/content/drive')

# Cell 4: Upload FASTA or specify path
#@title Upload FASTA file
# Option A: Upload directly
uploaded = files.upload()
fasta_file = list(uploaded.keys())[0]

# Option B: Use from Drive (uncomment and modify path)
# fasta_file = "/content/drive/MyDrive/pet_enzyme_candidates.fasta"

# Cell 5: Run ColabFold batch prediction
#@title Run Structure Predictions
#@markdown Configure prediction parameters:

num_models = 3  #@param {{type:"integer"}}
num_recycles = 3  #@param {{type:"integer"}}
use_amber = True  #@param {{type:"boolean"}}
use_templates = False  #@param {{type:"boolean"}}
msa_mode = "mmseqs2_uniref_env"  #@param ["mmseqs2_uniref_env", "mmseqs2_uniref", "single_sequence"]

output_dir = "colabfold_results"
os.makedirs(output_dir, exist_ok=True)

# Run predictions
run_colabfold(
    fasta_file,
    output_dir,
    num_models=num_models,
    num_recycle=num_recycles,
    use_amber=use_amber,
    use_templates=use_templates,
    msa_mode=msa_mode,
    model_type="alphafold2_ptm"
)

print("\\nPredictions complete! Check the output directory.")

# Cell 6: Download results
#@title Download Results
import shutil

# Create zip archive
shutil.make_archive("colabfold_results", 'zip', output_dir)
files.download("colabfold_results.zip")
'''

    def __init__(
        self,
        input_dir: str = "data/sequences",
        output_dir: str = "data/structures",
        config: Optional[ColabFoldConfig] = None
    ):
        """
        Initialize ColabFold runner.

        Args:
            input_dir: Directory containing input FASTA files
            output_dir: Directory for structure outputs
            config: ColabFold configuration
        """
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.config = config or ColabFoldConfig()

    def generate_colab_notebook(self, output_file: str = "ColabFold_PETase_Prediction.ipynb") -> Path:
        """
        Generate a complete Google Colab notebook for predictions.

        Returns:
            Path to generated notebook file
        """
        # Create Jupyter notebook structure
        notebook = {
            "nbformat": 4,
            "nbformat_minor": 0,
            "metadata": {
                "colab": {
                    "name": "ClimateEnzyme_ColabFold_Prediction",
                    "provenance": [],
                    "gpuType": "T4"
                },
                "kernelspec": {
                    "name": "python3",
                    "display_name": "Python 3"
                },
                "accelerator": "GPU"
            },
            "cells": []
        }

        # Parse template into cells
        cells_content = [
            {
                "type": "markdown",
                "content": """# ClimateEnzyme Structure Prediction Pipeline

## PET-Degrading Enzyme Structure Prediction with ColabFold

This notebook uses ColabFold (AlphaFold2) to predict structures for enzyme candidates
that may help degrade PET plastic pollution.

**Requirements:**
- Google Colab with GPU runtime (free tier works!)
- Your FASTA file of enzyme candidates

**Runtime:** ~5-15 minutes per protein depending on length

**Instructions:**
1. Click Runtime -> Change runtime type -> GPU
2. Run all cells in order
3. Upload your FASTA file when prompted
4. Download results when complete"""
            },
            {
                "type": "code",
                "content": """#@title 1. Install ColabFold Dependencies
%%capture
!pip install -q "colabfold[alphafold] @ git+https://github.com/sokrypton/ColabFold"

# Check GPU
import torch
if torch.cuda.is_available():
    print(f"GPU available: {torch.cuda.get_device_name(0)}")
else:
    print("WARNING: No GPU detected. Go to Runtime -> Change runtime type -> GPU")"""
            },
            {
                "type": "code",
                "content": """#@title 2. Setup and Import
import os
import json
from pathlib import Path
from google.colab import files

# Create output directory
output_dir = Path("colabfold_results")
output_dir.mkdir(exist_ok=True)

print("Setup complete!")"""
            },
            {
                "type": "code",
                "content": """#@title 3. Upload FASTA File
print("Upload your FASTA file containing enzyme candidates:")
uploaded = files.upload()

if uploaded:
    fasta_file = list(uploaded.keys())[0]
    print(f"\\nUploaded: {fasta_file}")

    # Count sequences
    with open(fasta_file, 'r') as f:
        seq_count = sum(1 for line in f if line.startswith('>'))
    print(f"Contains {seq_count} sequences")
else:
    print("No file uploaded!")"""
            },
            {
                "type": "code",
                "content": """#@title 4. Configure Prediction Parameters
#@markdown Adjust these settings based on your needs:

num_models = 3  #@param {type:"slider", min:1, max:5, step:1}
num_recycles = 3  #@param {type:"slider", min:1, max:12, step:1}
use_amber_relax = True  #@param {type:"boolean"}
msa_mode = "mmseqs2_uniref_env"  #@param ["mmseqs2_uniref_env", "mmseqs2_uniref", "single_sequence"]

print("Configuration:")
print(f"  Models: {num_models}")
print(f"  Recycles: {num_recycles}")
print(f"  Amber relaxation: {use_amber_relax}")
print(f"  MSA mode: {msa_mode}")"""
            },
            {
                "type": "code",
                "content": """#@title 5. Run ColabFold Predictions
from colabfold.batch import run as run_colabfold
from colabfold.download import download_alphafold_params

print("Downloading AlphaFold2 parameters (first run only)...")
download_alphafold_params("alphafold2_ptm")

print("\\nStarting structure predictions...")
print("This may take several minutes per protein.\\n")

run_colabfold(
    fasta_file,
    str(output_dir),
    num_models=num_models,
    num_recycle=num_recycles,
    use_amber=use_amber_relax,
    use_templates=False,
    msa_mode=msa_mode,
    model_type="alphafold2_ptm"
)

print("\\n" + "="*50)
print("PREDICTIONS COMPLETE!")
print("="*50)"""
            },
            {
                "type": "code",
                "content": """#@title 6. Parse and Summarize Results
import glob
import numpy as np

# Find all result JSON files
json_files = glob.glob(str(output_dir / "*_scores*.json"))

results_summary = []

for json_file in sorted(json_files):
    try:
        with open(json_file, 'r') as f:
            scores = json.load(f)

        name = Path(json_file).stem.replace("_scores_rank_001_alphafold2_ptm_model_1_seed_000", "")

        plddt = scores.get("plddt", [])
        pae = scores.get("pae", [[]])

        result = {
            "name": name,
            "plddt_mean": np.mean(plddt) if plddt else 0,
            "plddt_min": np.min(plddt) if plddt else 0,
            "pae_mean": np.mean(pae) if pae else 0,
            "ptm": scores.get("ptm", 0),
            "length": len(plddt)
        }
        results_summary.append(result)

    except Exception as e:
        print(f"Error parsing {json_file}: {e}")

# Sort by confidence
results_summary.sort(key=lambda x: x["plddt_mean"], reverse=True)

print("\\n=== PREDICTION SUMMARY ===\\n")
print(f"{'Name':<40} {'pLDDT':>8} {'PAE':>8} {'pTM':>6} {'Length':>6}")
print("-" * 70)

for r in results_summary:
    confidence = "***" if r["plddt_mean"] > 90 else "**" if r["plddt_mean"] > 70 else "*" if r["plddt_mean"] > 50 else ""
    print(f"{r['name'][:40]:<40} {r['plddt_mean']:>7.1f}{confidence} {r['pae_mean']:>7.1f} {r['ptm']:>6.3f} {r['length']:>6}")

# Save summary
with open(output_dir / "prediction_summary.json", 'w') as f:
    json.dump(results_summary, f, indent=2)

print(f"\\nSummary saved to {output_dir}/prediction_summary.json")"""
            },
            {
                "type": "code",
                "content": """#@title 7. Download Results
import shutil

# Create zip archive
zip_name = "colabfold_results"
shutil.make_archive(zip_name, 'zip', output_dir)

print(f"Created {zip_name}.zip")
print("Downloading...")

files.download(f"{zip_name}.zip")"""
            },
            {
                "type": "markdown",
                "content": """## Next Steps

After downloading your results:

1. **Extract the zip file** - Contains PDB structures and score files
2. **Run the analysis pipeline** - Use the ClimateEnzyme analysis tools
3. **Identify top candidates** - Focus on high pLDDT (>70) structures
4. **Analyze active sites** - Use fpocket for pocket detection

For more information, see the ClimateEnzyme documentation."""
            }
        ]

        # Convert to notebook cells
        for cell in cells_content:
            cell_type = cell["type"]
            content = cell["content"]

            if cell_type == "markdown":
                notebook["cells"].append({
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": content.split('\n')
                })
            else:
                notebook["cells"].append({
                    "cell_type": "code",
                    "metadata": {},
                    "source": content.split('\n'),
                    "execution_count": None,
                    "outputs": []
                })

        # Save notebook
        notebook_path = Path("notebooks") / output_file
        notebook_path.parent.mkdir(parents=True, exist_ok=True)

        with open(notebook_path, 'w') as f:
            json.dump(notebook, f, indent=2)

        print(f"Generated Colab notebook: {notebook_path}")
        return notebook_path

    def generate_batch_script(
        self,
        fasta_file: str,
        output_file: str = "run_colabfold.sh"
    ) -> Path:
        """
        Generate a batch script for local ColabFold installation.

        Args:
            fasta_file: Input FASTA file path
            output_file: Output script filename

        Returns:
            Path to generated script
        """
        script = f'''#!/bin/bash
# ColabFold Batch Prediction Script
# ==================================
# Generated by ClimateEnzyme Pipeline
#
# Prerequisites:
#   - LocalColabFold installed: https://github.com/YoshitakaMo/localcolabfold
#   - GPU with CUDA support (optional but recommended)

# Configuration
INPUT_FASTA="{fasta_file}"
OUTPUT_DIR="{self.output_dir}"
NUM_MODELS={self.config.num_models}
NUM_RECYCLES={self.config.num_recycles}
MSA_MODE="{self.config.msa_mode}"
USE_AMBER={"--amber" if self.config.use_amber else ""}
USE_TEMPLATES={"--templates" if self.config.use_templates else ""}

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Run ColabFold
echo "Starting ColabFold predictions..."
echo "Input: $INPUT_FASTA"
echo "Output: $OUTPUT_DIR"

colabfold_batch \\
    "$INPUT_FASTA" \\
    "$OUTPUT_DIR" \\
    --num-models $NUM_MODELS \\
    --num-recycle $NUM_RECYCLES \\
    --msa-mode $MSA_MODE \\
    --model-type {self.config.model_type} \\
    $USE_AMBER \\
    $USE_TEMPLATES

echo "Predictions complete!"
echo "Results saved to: $OUTPUT_DIR"
'''
        script_path = Path("scripts") / output_file
        script_path.parent.mkdir(parents=True, exist_ok=True)

        with open(script_path, 'w') as f:
            f.write(script)

        # Make executable
        os.chmod(script_path, 0o755)

        print(f"Generated batch script: {script_path}")
        return script_path


class StructureParser:
    """
    Parses ColabFold/AlphaFold output files to extract quality metrics.

    Extracts:
    - pLDDT (per-residue confidence)
    - PAE (predicted aligned error)
    - pTM (predicted TM-score)
    - Disorder predictions
    """

    # pLDDT thresholds for disorder prediction
    DISORDER_THRESHOLD = 50  # Below this is likely disordered
    CONFIDENT_THRESHOLD = 70  # Above this is confident

    def __init__(self, results_dir: str = "data/structures"):
        """
        Initialize parser.

        Args:
            results_dir: Directory containing ColabFold results
        """
        self.results_dir = Path(results_dir)
        self.predictions: list[StructurePrediction] = []

    def parse_results_directory(self, verbose: bool = True) -> list[StructurePrediction]:
        """
        Parse all predictions in the results directory.

        Returns:
            List of StructurePrediction objects
        """
        self.predictions = []

        # Find all PDB files (rank 1 models)
        pdb_files = list(self.results_dir.glob("*_relaxed_rank_001*.pdb"))
        if not pdb_files:
            pdb_files = list(self.results_dir.glob("*_unrelaxed_rank_001*.pdb"))
        if not pdb_files:
            pdb_files = list(self.results_dir.glob("*.pdb"))

        if verbose:
            print(f"Found {len(pdb_files)} PDB files to parse")

        for pdb_file in pdb_files:
            try:
                prediction = self._parse_single_prediction(pdb_file)
                if prediction:
                    self.predictions.append(prediction)
            except Exception as e:
                if verbose:
                    print(f"Error parsing {pdb_file.name}: {e}")

        if verbose:
            print(f"Successfully parsed {len(self.predictions)} predictions")

        return self.predictions

    def _parse_single_prediction(self, pdb_path: Path) -> Optional[StructurePrediction]:
        """Parse a single prediction from its files."""
        # Extract sequence ID from filename
        name = pdb_path.stem
        # Remove common suffixes
        for suffix in ["_relaxed_rank_001", "_unrelaxed_rank_001", "_rank_001"]:
            if suffix in name:
                name = name.split(suffix)[0]
                break

        # Find corresponding scores JSON
        json_patterns = [
            f"{name}_scores_rank_001*.json",
            f"{name}*scores*.json",
            f"{name}.json"
        ]

        scores_file = None
        for pattern in json_patterns:
            matches = list(self.results_dir.glob(pattern))
            if matches:
                scores_file = matches[0]
                break

        # Parse scores
        plddt_per_residue = []
        pae_matrix = None
        ptm_score = None

        if scores_file and scores_file.exists():
            with open(scores_file, 'r') as f:
                scores = json.load(f)
                plddt_per_residue = scores.get("plddt", [])
                pae_matrix = scores.get("pae", None)
                ptm_score = scores.get("ptm", None)

        # If no JSON, try to extract pLDDT from PDB B-factors
        if not plddt_per_residue:
            plddt_per_residue = self._extract_plddt_from_pdb(pdb_path)

        if not plddt_per_residue:
            return None

        # Calculate metrics
        plddt_mean = sum(plddt_per_residue) / len(plddt_per_residue)
        pae_mean = None
        if pae_matrix:
            flat_pae = [val for row in pae_matrix for val in row]
            pae_mean = sum(flat_pae) / len(flat_pae) if flat_pae else None

        # Identify disorder and confident regions
        disorder_regions = self._find_regions(plddt_per_residue, below=self.DISORDER_THRESHOLD)
        confident_regions = self._find_regions(plddt_per_residue, above=self.CONFIDENT_THRESHOLD)

        return StructurePrediction(
            sequence_id=name,
            pdb_path=str(pdb_path),
            plddt_mean=plddt_mean,
            plddt_per_residue=plddt_per_residue,
            pae_mean=pae_mean,
            pae_matrix=pae_matrix,
            ptm_score=ptm_score,
            disorder_regions=disorder_regions,
            confident_regions=confident_regions,
            sequence_length=len(plddt_per_residue)
        )

    def _extract_plddt_from_pdb(self, pdb_path: Path) -> list[float]:
        """Extract pLDDT scores from PDB B-factor column."""
        plddt = []
        current_residue = None

        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("ATOM") and line[12:16].strip() == "CA":
                    residue_num = int(line[22:26].strip())
                    if residue_num != current_residue:
                        current_residue = residue_num
                        try:
                            b_factor = float(line[60:66].strip())
                            plddt.append(b_factor)
                        except ValueError:
                            pass

        return plddt

    def _find_regions(
        self,
        scores: list[float],
        below: Optional[float] = None,
        above: Optional[float] = None,
        min_length: int = 5
    ) -> list[tuple[int, int]]:
        """
        Find contiguous regions meeting score criteria.

        Args:
            scores: Per-residue scores
            below: Find regions below this threshold
            above: Find regions above this threshold
            min_length: Minimum region length

        Returns:
            List of (start, end) tuples (1-indexed)
        """
        regions = []
        in_region = False
        start = 0

        for i, score in enumerate(scores):
            meets_criteria = False
            if below is not None:
                meets_criteria = score < below
            elif above is not None:
                meets_criteria = score > above

            if meets_criteria and not in_region:
                in_region = True
                start = i + 1  # 1-indexed
            elif not meets_criteria and in_region:
                in_region = False
                if i - start + 1 >= min_length:
                    regions.append((start, i))  # End is 1-indexed

        # Handle region extending to end
        if in_region and len(scores) - start + 1 >= min_length:
            regions.append((start, len(scores)))

        return regions

    def filter_by_confidence(
        self,
        min_plddt: float = 70.0,
        max_disorder_fraction: float = 0.3
    ) -> list[StructurePrediction]:
        """
        Filter predictions by confidence criteria.

        Args:
            min_plddt: Minimum mean pLDDT score
            max_disorder_fraction: Maximum allowed disorder fraction

        Returns:
            Filtered list of predictions
        """
        filtered = []

        for pred in self.predictions:
            if pred.plddt_mean >= min_plddt:
                if pred.disorder_fraction <= max_disorder_fraction:
                    filtered.append(pred)

        return filtered

    def save_summary(self, output_file: str = "structure_summary.csv") -> Path:
        """Save prediction summary to CSV."""
        output_path = self.results_dir / output_file

        with open(output_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "sequence_id", "pdb_path", "plddt_mean", "pae_mean",
                "ptm_score", "confidence_category", "disorder_fraction",
                "sequence_length", "num_disorder_regions"
            ])

            for pred in self.predictions:
                writer.writerow([
                    pred.sequence_id,
                    pred.pdb_path,
                    f"{pred.plddt_mean:.2f}",
                    f"{pred.pae_mean:.2f}" if pred.pae_mean else "N/A",
                    f"{pred.ptm_score:.3f}" if pred.ptm_score else "N/A",
                    pred.confidence_category,
                    f"{pred.disorder_fraction:.3f}",
                    pred.sequence_length,
                    len(pred.disorder_regions)
                ])

        print(f"Saved summary to {output_path}")
        return output_path


def generate_colabfold_files(
    fasta_file: str = "data/sequences/pet_enzyme_candidates.fasta",
    output_dir: str = "data/structures"
) -> tuple[Path, Path]:
    """
    Generate all files needed for ColabFold predictions.

    Returns:
        Tuple of (notebook_path, script_path)
    """
    runner = ColabFoldRunner(output_dir=output_dir)

    notebook_path = runner.generate_colab_notebook()
    script_path = runner.generate_batch_script(fasta_file)

    return notebook_path, script_path


if __name__ == "__main__":
    # Generate ColabFold files
    notebook, script = generate_colabfold_files()
    print(f"\nGenerated files:")
    print(f"  Colab notebook: {notebook}")
    print(f"  Batch script: {script}")
