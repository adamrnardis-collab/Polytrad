"""
Sequence Mining Module
======================

Queries UniProt and public databases for enzyme sequences related to
PET degradation and plastic-degrading enzyme families.

Supported enzyme families:
- PETase (EC 3.1.1.101)
- MHETase (EC 3.1.1.102)
- Cutinases (EC 3.1.1.74)
- Carboxylesterases with PET activity
"""

import requests
import re
import time
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class SequenceRecord:
    """Represents a protein sequence with metadata."""
    accession: str
    entry_name: str
    protein_name: str
    organism: str
    sequence: str
    length: int
    ec_number: str = ""
    gene_name: str = ""
    taxonomy: str = ""
    reviewed: bool = False

    def to_fasta(self) -> str:
        """Convert to FASTA format string."""
        header = f">{self.accession}|{self.entry_name}|{self.protein_name[:50]}|{self.organism}"
        # Wrap sequence at 80 characters
        wrapped_seq = '\n'.join([self.sequence[i:i+80] for i in range(0, len(self.sequence), 80)])
        return f"{header}\n{wrapped_seq}"


@dataclass
class FilterConfig:
    """Configuration for sequence filtering."""
    min_length: int = 150
    max_length: int = 800
    require_complete: bool = True
    exclude_fragments: bool = True
    exclude_transmembrane: bool = False  # Many cutinases are secreted
    reviewed_only: bool = False  # Include TrEMBL for diversity
    max_sequences: int = 500


class SequenceMiner:
    """
    Mines enzyme sequences from UniProt for climate-relevant targets.

    Primary focus: PET-degrading enzymes including PETases, MHETases,
    and cutinases that can hydrolyze polyester bonds.
    """

    UNIPROT_API = "https://rest.uniprot.org/uniprotkb"

    # Pre-defined queries for PET-degrading enzyme families
    ENZYME_QUERIES = {
        "petase": {
            "query": '(ec:3.1.1.101) OR (protein_name:"PETase") OR (protein_name:"PET hydrolase")',
            "description": "PET hydrolases (PETases) - directly cleave PET polymer"
        },
        "mhetase": {
            "query": '(ec:3.1.1.102) OR (protein_name:"MHETase") OR (protein_name:"MHET hydrolase")',
            "description": "MHET hydrolases - cleave MHET intermediate from PET degradation"
        },
        "cutinase": {
            "query": '(ec:3.1.1.74) AND (protein_name:"cutinase")',
            "description": "Cutinases - natural polyester hydrolases with PET activity"
        },
        "pet_related": {
            "query": '(keyword:"Esterase") AND ((protein_name:"polyester") OR (protein_name:"terephthalate"))',
            "description": "Other polyester-active esterases"
        },
        "thermostable_cutinase": {
            "query": '(ec:3.1.1.74) AND (taxonomy_name:"Thermobifida" OR taxonomy_name:"Thermomonospora")',
            "description": "Thermostable cutinases from thermophilic bacteria"
        }
    }

    def __init__(self, output_dir: str = "data/sequences"):
        """
        Initialize the sequence miner.

        Args:
            output_dir: Directory for output FASTA files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.sequences: list[SequenceRecord] = []

    def query_uniprot(
        self,
        query: str,
        config: Optional[FilterConfig] = None,
        verbose: bool = True
    ) -> list[SequenceRecord]:
        """
        Query UniProt REST API for sequences matching the query.

        Args:
            query: UniProt query string
            config: Filtering configuration
            verbose: Print progress information

        Returns:
            List of SequenceRecord objects
        """
        if config is None:
            config = FilterConfig()

        # Build query with length filters
        full_query = f"({query}) AND (length:[{config.min_length} TO {config.max_length}])"

        if config.exclude_fragments:
            full_query += " NOT (fragment:true)"

        if config.reviewed_only:
            full_query += " AND (reviewed:true)"

        if verbose:
            print(f"Querying UniProt: {full_query[:100]}...")

        # UniProt API parameters
        params = {
            "query": full_query,
            "format": "tsv",
            "fields": "accession,id,protein_name,organism_name,sequence,length,ec,gene_names,lineage,reviewed",
            "size": min(config.max_sequences, 500)
        }

        try:
            response = requests.get(
                f"{self.UNIPROT_API}/search",
                params=params,
                timeout=60
            )
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error querying UniProt: {e}")
            return []

        # Parse TSV response
        records = []
        lines = response.text.strip().split('\n')

        if len(lines) <= 1:
            if verbose:
                print("No sequences found matching query.")
            return []

        headers = lines[0].split('\t')

        for line in lines[1:]:
            fields = line.split('\t')
            if len(fields) < len(headers):
                continue

            field_dict = dict(zip(headers, fields))

            # Create sequence record
            try:
                record = SequenceRecord(
                    accession=field_dict.get("Entry", ""),
                    entry_name=field_dict.get("Entry Name", ""),
                    protein_name=field_dict.get("Protein names", ""),
                    organism=field_dict.get("Organism", ""),
                    sequence=field_dict.get("Sequence", ""),
                    length=int(field_dict.get("Length", 0)),
                    ec_number=field_dict.get("EC number", ""),
                    gene_name=field_dict.get("Gene Names", ""),
                    taxonomy=field_dict.get("Taxonomic lineage", ""),
                    reviewed=field_dict.get("Reviewed", "") == "reviewed"
                )

                # Apply additional filters
                if self._passes_filters(record, config):
                    records.append(record)

            except (ValueError, KeyError) as e:
                continue

        if verbose:
            print(f"Retrieved {len(records)} sequences after filtering.")

        return records

    def _passes_filters(self, record: SequenceRecord, config: FilterConfig) -> bool:
        """Check if a sequence passes all filter criteria."""
        # Check for completeness (no X characters indicating unknowns)
        if config.require_complete:
            if 'X' in record.sequence.upper():
                return False

        # Basic sequence validation
        if not record.sequence or len(record.sequence) < config.min_length:
            return False

        # Check for valid amino acid characters only
        valid_aa = set("ACDEFGHIKLMNPQRSTVWY")
        if not all(aa in valid_aa for aa in record.sequence.upper()):
            return False

        return True

    def mine_pet_enzymes(
        self,
        enzyme_types: Optional[list[str]] = None,
        config: Optional[FilterConfig] = None,
        verbose: bool = True
    ) -> list[SequenceRecord]:
        """
        Mine sequences for PET-degrading enzyme families.

        Args:
            enzyme_types: List of enzyme types to query (default: all)
            config: Filtering configuration
            verbose: Print progress

        Returns:
            Combined list of unique sequences
        """
        if enzyme_types is None:
            enzyme_types = list(self.ENZYME_QUERIES.keys())

        if config is None:
            config = FilterConfig()

        all_records = []
        seen_accessions = set()

        for enzyme_type in enzyme_types:
            if enzyme_type not in self.ENZYME_QUERIES:
                print(f"Unknown enzyme type: {enzyme_type}")
                continue

            query_info = self.ENZYME_QUERIES[enzyme_type]

            if verbose:
                print(f"\n--- Mining {enzyme_type}: {query_info['description']} ---")

            records = self.query_uniprot(query_info["query"], config, verbose)

            # Deduplicate by accession
            for record in records:
                if record.accession not in seen_accessions:
                    seen_accessions.add(record.accession)
                    all_records.append(record)

            # Be nice to the API
            time.sleep(1)

        self.sequences = all_records

        if verbose:
            print(f"\n=== Total unique sequences: {len(all_records)} ===")

        return all_records

    def add_reference_sequences(self, verbose: bool = True) -> None:
        """
        Add well-characterized reference PET-degrading enzymes.

        These serve as positive controls and comparison standards.
        """
        # Key reference enzymes with known PET activity
        reference_accessions = [
            "A0A0K8P6T7",  # IsPETase from Ideonella sakaiensis (the famous PETase)
            "A0A0K8P8E7",  # IsMHETase from Ideonella sakaiensis
            "Q6A0I4",      # Thermobifida fusca cutinase (TfCut2)
            "E9LVH8",      # Leaf-branch compost cutinase (LCC)
            "G9BY57",      # Saccharomonospora viridis cutinase
        ]

        if verbose:
            print("\n--- Adding reference PET-degrading enzymes ---")

        for acc in reference_accessions:
            # Check if already in collection
            if any(r.accession == acc for r in self.sequences):
                continue

            try:
                response = requests.get(
                    f"{self.UNIPROT_API}/{acc}",
                    params={"format": "tsv", "fields": "accession,id,protein_name,organism_name,sequence,length,ec,gene_names,lineage,reviewed"},
                    timeout=30
                )

                if response.status_code == 200:
                    lines = response.text.strip().split('\n')
                    if len(lines) >= 2:
                        headers = lines[0].split('\t')
                        fields = lines[1].split('\t')
                        field_dict = dict(zip(headers, fields))

                        record = SequenceRecord(
                            accession=field_dict.get("Entry", acc),
                            entry_name=field_dict.get("Entry Name", ""),
                            protein_name=field_dict.get("Protein names", "Reference enzyme"),
                            organism=field_dict.get("Organism", ""),
                            sequence=field_dict.get("Sequence", ""),
                            length=int(field_dict.get("Length", 0)),
                            ec_number=field_dict.get("EC number", ""),
                            gene_name=field_dict.get("Gene Names", ""),
                            taxonomy=field_dict.get("Taxonomic lineage", ""),
                            reviewed=True
                        )

                        if record.sequence:
                            self.sequences.append(record)
                            if verbose:
                                print(f"  Added: {acc} - {record.protein_name[:50]}")

            except requests.RequestException:
                print(f"  Could not fetch {acc}")

            time.sleep(0.5)

    def save_fasta(
        self,
        filename: str = "pet_enzyme_candidates.fasta",
        sequences: Optional[list[SequenceRecord]] = None
    ) -> Path:
        """
        Save sequences to FASTA file.

        Args:
            filename: Output filename
            sequences: Sequences to save (default: self.sequences)

        Returns:
            Path to output file
        """
        if sequences is None:
            sequences = self.sequences

        output_path = self.output_dir / filename

        with open(output_path, 'w') as f:
            for record in sequences:
                f.write(record.to_fasta() + '\n')

        print(f"Saved {len(sequences)} sequences to {output_path}")
        return output_path

    def save_metadata(
        self,
        filename: str = "sequence_metadata.tsv",
        sequences: Optional[list[SequenceRecord]] = None
    ) -> Path:
        """
        Save sequence metadata to TSV file.

        Args:
            filename: Output filename
            sequences: Sequences to save metadata for

        Returns:
            Path to output file
        """
        if sequences is None:
            sequences = self.sequences

        output_path = self.output_dir / filename

        headers = ["accession", "entry_name", "protein_name", "organism",
                   "length", "ec_number", "gene_name", "reviewed"]

        with open(output_path, 'w') as f:
            f.write('\t'.join(headers) + '\n')
            for record in sequences:
                row = [
                    record.accession,
                    record.entry_name,
                    record.protein_name.replace('\t', ' '),
                    record.organism,
                    str(record.length),
                    record.ec_number,
                    record.gene_name,
                    str(record.reviewed)
                ]
                f.write('\t'.join(row) + '\n')

        print(f"Saved metadata to {output_path}")
        return output_path

    def get_summary(self) -> dict:
        """Get summary statistics of mined sequences."""
        if not self.sequences:
            return {"total": 0}

        lengths = [r.length for r in self.sequences]
        organisms = set(r.organism for r in self.sequences)
        reviewed_count = sum(1 for r in self.sequences if r.reviewed)

        return {
            "total": len(self.sequences),
            "reviewed": reviewed_count,
            "unreviewed": len(self.sequences) - reviewed_count,
            "unique_organisms": len(organisms),
            "length_min": min(lengths),
            "length_max": max(lengths),
            "length_mean": sum(lengths) / len(lengths),
        }


def run_mining_pipeline(
    output_dir: str = "data/sequences",
    config: Optional[FilterConfig] = None,
    verbose: bool = True
) -> tuple[list[SequenceRecord], Path]:
    """
    Run the complete sequence mining pipeline.

    Args:
        output_dir: Output directory for files
        config: Filter configuration
        verbose: Print progress

    Returns:
        Tuple of (sequences list, FASTA file path)
    """
    if config is None:
        config = FilterConfig(
            min_length=200,
            max_length=600,
            require_complete=True,
            exclude_fragments=True,
            max_sequences=100  # Per enzyme type
        )

    miner = SequenceMiner(output_dir)

    # Mine all PET enzyme families
    sequences = miner.mine_pet_enzymes(config=config, verbose=verbose)

    # Add reference sequences
    miner.add_reference_sequences(verbose=verbose)

    # Save outputs
    fasta_path = miner.save_fasta()
    miner.save_metadata()

    # Print summary
    if verbose:
        summary = miner.get_summary()
        print("\n=== Mining Summary ===")
        for key, value in summary.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.1f}")
            else:
                print(f"  {key}: {value}")

    return miner.sequences, fasta_path


if __name__ == "__main__":
    # Run the mining pipeline
    sequences, fasta_path = run_mining_pipeline()
