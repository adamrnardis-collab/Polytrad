# ClimateEnzyme Discovery Pipeline

**AI-guided discovery of PET-degrading enzymes for plastic pollution mitigation**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Open Science](https://img.shields.io/badge/Open-Science-orange.svg)](#)

---

## Why This Matters

**350 million metric tons** of plastic are produced annually. PET (polyethylene terephthalate) is one of the most common plastics, found in bottles, packaging, and textiles. Most PET ends up in landfills or oceans, persisting for centuries.

**Enzymes offer a solution.** In 2016, scientists discovered *Ideonella sakaiensis*, a bacterium that evolved enzymes (PETase and MHETase) capable of breaking down PET plastic. This pipeline helps identify and characterize similar enzymes that could be engineered for industrial-scale plastic degradation.

**This is open science.** This pipeline is designed to be:
- **Free** - Runs on Google Colab's free GPU tier
- **Reproducible** - All code and methods documented
- **Accessible** - No specialized hardware required
- **Safe** - Only targets environmental applications

---

## What This Pipeline Does

```
UniProt Database → Sequence Mining → Structure Prediction → Analysis → Ranked Candidates
                                            ↓
                                   ColabFold (AlphaFold2)
```

1. **Mines sequences** from UniProt for PET-degrading enzyme families
2. **Predicts structures** using ColabFold (AlphaFold2) on free Google Colab
3. **Analyzes structures** for catalytic pockets and functional features
4. **Ranks candidates** by predicted real-world usefulness

---

## Quick Start

### Prerequisites

- Python 3.10+
- Google account (for Colab)
- ~2 hours for a typical run

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ClimateEnzyme.git
cd ClimateEnzyme

# Install dependencies
pip install -r requirements.txt

# Run the pipeline
python run_pipeline.py
```

### Running the Pipeline

```bash
# Run complete pipeline (stops before ColabFold)
python run_pipeline.py

# Run individual steps
python run_pipeline.py --step mine      # Step 1: Mine sequences
python run_pipeline.py --step predict   # Step 2: Generate ColabFold files
python run_pipeline.py --step analyze   # Step 3: Analyze structures
python run_pipeline.py --step rank      # Step 4: Rank candidates
```

---

## Pipeline Steps

### Step 1: Sequence Mining

Queries UniProt for enzyme sequences from these families:
- **PETases** (EC 3.1.1.101) - Direct PET hydrolysis
- **MHETases** (EC 3.1.1.102) - MHET intermediate hydrolysis
- **Cutinases** (EC 3.1.1.74) - Natural polyesterases
- **Related esterases** with potential PET activity

Includes reference enzymes with known activity (IsPETase, TfCut2, LCC).

**Output:** `data/sequences/pet_enzyme_candidates.fasta`

### Step 2: Structure Prediction

Generates files for ColabFold/AlphaFold2 prediction:
- Jupyter notebook for Google Colab (FREE GPU)
- Bash script for local ColabFold installation

**How to run predictions:**

1. Open `notebooks/ColabFold_PETase_Prediction.ipynb` in [Google Colab](https://colab.research.google.com/)
2. Enable GPU: Runtime → Change runtime type → GPU
3. Run all cells
4. Download results and extract to `data/structures/`

### Step 3: Structure Analysis

Analyzes predicted structures for:
- **Catalytic pockets** using fpocket
- **Conserved residues** and catalytic triads
- **Solubility prediction** for expression feasibility
- **Active site accessibility**

### Step 4: Ranking

Scores candidates on multiple criteria:

| Factor | Weight | Description |
|--------|--------|-------------|
| Structural confidence | 30% | pLDDT, PAE, disorder |
| Active site accessibility | 25% | Pocket druggability |
| Predicted stability | 20% | Length, pI, composition |
| Novelty | 15% | Divergence from known enzymes |
| Solubility | 10% | Expression feasibility |

**Output:**
- `results/ranked_candidates.csv` - Full rankings
- `results/ranking_report.html` - Interactive report
- `results/ranking_report.md` - Markdown summary

---

## Output Files

```
ClimateEnzyme/
├── data/
│   ├── sequences/
│   │   ├── pet_enzyme_candidates.fasta    # Input sequences
│   │   └── sequence_metadata.tsv          # Sequence information
│   ├── structures/
│   │   ├── *.pdb                          # Predicted structures
│   │   └── structure_summary.csv          # Prediction metrics
│   └── analysis/
│       └── structure_analysis.json        # Analysis results
├── results/
│   ├── ranked_candidates.csv              # Rankings (spreadsheet)
│   ├── ranked_candidates.json             # Rankings (machine-readable)
│   ├── ranking_report.html                # Interactive report
│   ├── ranking_report.md                  # Markdown report
│   └── methods.md                         # Methods section
└── notebooks/
    └── ColabFold_PETase_Prediction.ipynb  # Colab notebook
```

---

## Interpreting Results

### Understanding Scores

- **Overall Score (0-1)**: Higher is better. Top candidates typically score >0.6
- **pLDDT (0-100)**: AlphaFold confidence. >70 = confident, >90 = very confident
- **PAE**: Predicted aligned error. Lower is better.
- **Druggable Pockets**: Number of potential active sites detected

### What to Look For

**High Priority Candidates:**
- Overall score > 0.7
- pLDDT > 70
- At least 1 druggable pocket
- Predicted soluble
- Novel sequence (not identical to known enzymes)

**Reference Enzymes:**
- IsPETase (A0A0K8P6T7) - The original PET-degrading enzyme
- LCC (E9LVH8) - Thermostable cutinase
- TfCut2 (Q6A0I4) - Industrial cutinase

---

## For Researchers

### Experimental Validation

Top candidates should be validated by:
1. **Expression** - Recombinant production in E. coli or similar
2. **Activity assay** - PET film degradation or pNP-based assays
3. **Kinetics** - Determine Km and kcat for PET substrates
4. **Stability** - Thermal and pH stability testing

### Citing This Work

If you use this pipeline in your research, please cite:

```
ClimateEnzyme Discovery Pipeline (2024)
https://github.com/yourusername/ClimateEnzyme
```

Also cite:
- ColabFold: Mirdita et al., Nature Methods 19:679-682 (2022)
- AlphaFold2: Jumper et al., Nature 596:583-589 (2021)

---

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

Areas for contribution:
- Additional enzyme families (methane oxidation, PFAS degradation)
- Improved ranking algorithms
- Visualization tools
- Experimental validation data

---

## Safety and Ethics

This pipeline is designed for **beneficial environmental applications only**.

**Included:**
- PET/plastic degradation
- Pollution remediation
- Sustainable chemistry

**Explicitly excluded:**
- Pathogen engineering
- Toxin production
- Human enhancement
- Weapons development

All target enzymes are naturally occurring and focused on environmental cleanup.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute for any purpose.

---

## Acknowledgments

- UniProt for sequence data
- AlphaFold/ColabFold teams for structure prediction
- fpocket developers for pocket detection
- The *Ideonella sakaiensis* discovery team

---

## Contact

For questions or collaboration:
- Open an issue on GitHub
- Email: [your-email@example.com]

---

*Helping enzymes help the planet.*
