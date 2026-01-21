#!/usr/bin/env python3
"""
ClimateEnzyme Discovery Pipeline
================================

Main entry point for the complete enzyme discovery workflow.

This pipeline:
1. Mines PET-degrading enzyme sequences from UniProt
2. Generates ColabFold scripts for structure prediction
3. Analyzes predicted structures for functional features
4. Ranks candidates for experimental validation

Usage:
    python run_pipeline.py [--step STEP] [--config CONFIG]

Steps:
    1 or mine      - Mine sequences from UniProt
    2 or predict   - Generate ColabFold prediction files
    3 or analyze   - Analyze predicted structures
    4 or rank      - Rank and report candidates
    all            - Run complete pipeline (default)

Example:
    # Run complete pipeline
    python run_pipeline.py

    # Run only sequence mining
    python run_pipeline.py --step mine

    # Run analysis and ranking after manual ColabFold prediction
    python run_pipeline.py --step analyze
    python run_pipeline.py --step rank
"""

import argparse
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from sequence_mining import run_mining_pipeline, FilterConfig
from structure_prediction import generate_colabfold_files, StructureParser
from structure_analysis import analyze_all_structures
from ranking import run_ranking, EnzymeRanker
from utils import setup_project_structure, ReportGenerator


def run_step_1_mining(verbose: bool = True):
    """Step 1: Mine sequences from UniProt."""
    print("\n" + "="*60)
    print("STEP 1: Sequence Mining")
    print("="*60 + "\n")

    config = FilterConfig(
        min_length=200,
        max_length=600,
        require_complete=True,
        exclude_fragments=True,
        max_sequences=100  # Per enzyme type
    )

    sequences, fasta_path = run_mining_pipeline(
        output_dir="data/sequences",
        config=config,
        verbose=verbose
    )

    print(f"\nStep 1 complete: {len(sequences)} sequences saved to {fasta_path}")
    return sequences, fasta_path


def run_step_2_prediction(verbose: bool = True):
    """Step 2: Generate ColabFold files."""
    print("\n" + "="*60)
    print("STEP 2: Structure Prediction Setup")
    print("="*60 + "\n")

    notebook_path, script_path = generate_colabfold_files(
        fasta_file="data/sequences/pet_enzyme_candidates.fasta",
        output_dir="data/structures"
    )

    print("\n" + "-"*40)
    print("ColabFold files generated!")
    print("-"*40)
    print(f"\nOption A: Google Colab (FREE)")
    print(f"  1. Open {notebook_path} in Google Colab")
    print(f"  2. Enable GPU: Runtime -> Change runtime type -> GPU")
    print(f"  3. Run all cells")
    print(f"  4. Download results and extract to data/structures/")
    print(f"\nOption B: Local ColabFold")
    print(f"  1. Install localcolabfold: https://github.com/YoshitakaMo/localcolabfold")
    print(f"  2. Run: bash {script_path}")
    print("-"*40)

    return notebook_path, script_path


def run_step_3_analysis(verbose: bool = True):
    """Step 3: Analyze predicted structures."""
    print("\n" + "="*60)
    print("STEP 3: Structure Analysis")
    print("="*60 + "\n")

    # Check if structures exist
    structures_dir = Path("data/structures")
    pdb_files = list(structures_dir.glob("*.pdb"))

    if not pdb_files:
        print("WARNING: No PDB files found in data/structures/")
        print("Please run ColabFold predictions first (Step 2)")
        print("\nTo continue with demo data, create sample structures or")
        print("download from AlphaFold DB.")
        return None

    # Parse ColabFold outputs
    parser = StructureParser("data/structures")
    predictions = parser.parse_results_directory(verbose=verbose)

    if predictions:
        parser.save_summary()

    # Run structural analysis
    results = analyze_all_structures(
        structures_dir="data/structures",
        output_file="data/analysis/structure_analysis.json",
        verbose=verbose
    )

    print(f"\nStep 3 complete: Analyzed {len(results)} structures")
    return results


def run_step_4_ranking(verbose: bool = True):
    """Step 4: Rank candidates and generate reports."""
    print("\n" + "="*60)
    print("STEP 4: Candidate Ranking")
    print("="*60 + "\n")

    ranked = run_ranking(
        sequences_file="data/sequences/sequence_metadata.tsv",
        structures_file="data/structures/structure_summary.csv",
        analysis_file="data/analysis/structure_analysis.json",
        output_dir="results",
        verbose=verbose
    )

    # Generate additional reports
    generator = ReportGenerator("results")
    generator.generate_methods_section()

    print(f"\nStep 4 complete: {len(ranked)} candidates ranked")

    # Print top 5
    if ranked:
        print("\n" + "-"*40)
        print("TOP 5 CANDIDATES")
        print("-"*40)
        for c in ranked[:5]:
            print(f"  {c.rank}. {c.sequence_id} - Score: {c.overall_score:.3f}, pLDDT: {c.plddt_mean:.1f}")
        print("-"*40)

    return ranked


def run_full_pipeline(verbose: bool = True):
    """Run the complete pipeline."""
    print("\n" + "#"*60)
    print("# ClimateEnzyme Discovery Pipeline")
    print("# Target: PET-Degrading Enzymes")
    print("#"*60)

    # Setup directories
    setup_project_structure(".")

    # Step 1: Mining
    sequences, fasta_path = run_step_1_mining(verbose)

    # Step 2: ColabFold setup
    notebook_path, script_path = run_step_2_prediction(verbose)

    print("\n" + "!"*60)
    print("MANUAL STEP REQUIRED")
    print("!"*60)
    print("\nRun ColabFold predictions before continuing:")
    print(f"  1. Use the Colab notebook: {notebook_path}")
    print(f"  2. Or run locally: bash {script_path}")
    print("\nAfter predictions complete, run:")
    print("  python run_pipeline.py --step analyze")
    print("  python run_pipeline.py --step rank")
    print("!"*60)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="ClimateEnzyme Discovery Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "--step", "-s",
        choices=["1", "2", "3", "4", "mine", "predict", "analyze", "rank", "all"],
        default="all",
        help="Pipeline step to run (default: all)"
    )

    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Reduce output verbosity"
    )

    args = parser.parse_args()
    verbose = not args.quiet

    # Map step names
    step_map = {
        "1": "mine",
        "2": "predict",
        "3": "analyze",
        "4": "rank",
    }
    step = step_map.get(args.step, args.step)

    # Run appropriate step
    if step == "all":
        run_full_pipeline(verbose)
    elif step == "mine":
        run_step_1_mining(verbose)
    elif step == "predict":
        run_step_2_prediction(verbose)
    elif step == "analyze":
        run_step_3_analysis(verbose)
    elif step == "rank":
        run_step_4_ranking(verbose)

    print("\n" + "="*60)
    print("Pipeline step complete!")
    print("="*60)


if __name__ == "__main__":
    main()
