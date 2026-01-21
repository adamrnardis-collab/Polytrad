"""
ClimateEnzyme Discovery Pipeline
================================

An open-source pipeline for discovering climate-relevant enzymes using
AlphaFold/ColabFold structural prediction and computational analysis.

Target: PET-degrading enzymes (PETases, cutinases, and related hydrolases)

This pipeline:
1. Mines sequences from UniProt and metagenome databases
2. Filters candidates by quality metrics
3. Predicts structures using ColabFold
4. Analyzes functional features (pockets, conserved residues)
5. Ranks candidates for experimental validation

License: MIT
"""

__version__ = "1.0.0"
__author__ = "ClimateEnzyme Contributors"

from .sequence_mining import SequenceMiner
from .structure_prediction import ColabFoldRunner, StructureParser
from .structure_analysis import PocketAnalyzer, ConservationAnalyzer
from .ranking import EnzymeRanker
from .utils import FastaHandler, ReportGenerator
