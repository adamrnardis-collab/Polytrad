#!/usr/bin/env python3
"""
ClimateEnzyme Demo Script
=========================

Demonstrates the pipeline functionality with sample data.
No network access required - uses built-in demo sequences.

Usage:
    python demo.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from utils import setup_project_structure, FastaHandler, FastaRecord
from ranking import EnzymeRanker, EnzymeCandidate


# Demo sequences (truncated for illustration)
DEMO_SEQUENCES = [
    {
        "id": "PETASE_DEMO1",
        "organism": "Ideonella sakaiensis",
        "sequence": "MNFPRASRLMQAAVLGGLMAVSAAATAQTNPYARGPNPTAASLEASAGPFTVRSFTVSRPSGYGAGTVYYPTNAGGTVGAIAIVPGYTARQSSIKWWGPRLASHGFVVITIDTNSTLDQPSSRSSQQMAALRQVASLNGTSSSPIYGKVDTARMGVMGWSMGGGGSLISAANNPSLKAAAPQAPWDSSTNFSSVTVPTLIFACENDSIAPVNSSALPIYDSMSRNAKQFLEINGGSHSCANSGNSNQALIGKKGVAWMKRFMDNDTRYSTFACENPNSTRVSDFRTANCSLEDPAANKARKEAELAAATAEQ",
        "length": 290,
        "plddt": 92.5,
        "pae": 3.2,
    },
    {
        "id": "CUTINASE_DEMO2",
        "organism": "Thermobifida fusca",
        "sequence": "MRGSHHHHHHMVGGPAAATGDPGRRAPMRPRRCLLLPLVAAAVAGQAAPLDVTGPGGNGFVPGSYSGGGDAGRPVVLVHGYSGGQVYDPVPREVDGVWATGVNTLEQLSSLGACVVVDLSGNDLDFAVGRPMPSFTQNPGNPSWSNCLGQALAAARVLTIGTDALTVAGCGAAWPGLGLTSDTDPSWVDGLWVDKPTLPALGLSATGPNGAIGNNQLPGSQAAWQS",
        "length": 261,
        "plddt": 88.3,
        "pae": 4.1,
    },
    {
        "id": "ESTERASE_DEMO3",
        "organism": "Bacillus subtilis",
        "sequence": "MKKLLALLVVAAALGVGTAQAADNIYVVGQSAGGLLAGLVDQFVEKKVKGDTVVVTGHSLGGAIALEFADPVKVIGFLSGGANDLTVKKLAEQGAKIVAVLDQRFEKLGKPFNVDVVFTPYLSGVTHLPSFFEYVAKQGIKVIGTGTNALTVGGKVASGKDGIAAGFAAALKGAGVPVLVGLSHCTSTNFLPAVNEKGCMFVDAGSLKSVVSTQAGAASDGDKMAMFDQVAAAETAHDAGNPYDRHPYATAIIAGLKAANDLEIITLSPWNDPTGQTINYDSSRP",
        "length": 301,
        "plddt": 75.2,
        "pae": 6.8,
    },
    {
        "id": "HYDROLASE_DEMO4",
        "organism": "Pseudomonas sp.",
        "sequence": "MKTLLLTAALAAPVFAQDAATPQPVTAHGYDVIVVHGFPGLDGHLATKVAEQGAKVLALDSDGWLNTALTKGDRVVAGYSQGGQNAIDAVAAAAPDLKVIAVSVNYRPLSPDTPKQDLQALATQGAQVIAIVDVRYNGTRNAGVATADPQAKDLMQQFDCVRAADPNAKIIISTPNYPSETVTSYNADGKLKQLLEATGDSVTALSVGYNDQNSTGQVRPTVNAGKNLSPAWIGLPKSEIAKRQAAAQRFGVPVILGHSQGGYLAALANGLK",
        "length": 278,
        "plddt": 68.4,
        "pae": 8.5,
    },
    {
        "id": "LIPASE_DEMO5",
        "organism": "Thermomyces lanuginosus",
        "sequence": "MKLSVTFAALVAGAAAQEVEGKVPWLFSGQVGSDGGKGPGRPEVTVQCKSGQVAASDLHCYTSAGCGNATNVYYSWLQNSPNLIYQVVTGATRVGNPDPDDAGFIAQVKAAGHIGKVLVTGHTDLATCPNYDIIKKLANTIQKAGVKGSLRIGLGFTPGATTTTYTADNSKKVFANFTVSNKLAVSAKTGYVKLQDGAVLAKK",
        "length": 269,
        "plddt": 81.7,
        "pae": 5.3,
    },
]


def run_demo():
    """Run demonstration of pipeline components."""

    print("=" * 60)
    print("ClimateEnzyme Discovery Pipeline - DEMO")
    print("=" * 60)
    print("\nThis demo shows how the pipeline works using sample data.")
    print("No network access required.\n")

    # Setup project structure
    print("1. Setting up project structure...")
    dirs = setup_project_structure(".")
    print(f"   Created {len(dirs)} directories\n")

    # Create demo FASTA file
    print("2. Creating demo sequences...")
    demo_records = []
    for seq in DEMO_SEQUENCES:
        record = FastaRecord(
            id=seq["id"],
            description=f"{seq['organism']} | Demo PET-degrading enzyme candidate",
            sequence=seq["sequence"]
        )
        demo_records.append(record)
        print(f"   - {seq['id']}: {seq['length']} aa from {seq['organism']}")

    fasta_path = Path("data/sequences/demo_candidates.fasta")
    FastaHandler.write(demo_records, str(fasta_path))
    print(f"\n   Saved to: {fasta_path}\n")

    # Demonstrate ranking
    print("3. Creating enzyme candidates for ranking...")
    ranker = EnzymeRanker()

    for seq in DEMO_SEQUENCES:
        candidate = ranker.create_candidate(
            sequence_id=seq["id"],
            organism=seq["organism"],
            length=seq["length"],
            plddt_mean=seq["plddt"],
            pae_mean=seq["pae"],
            is_soluble=True,
            num_druggable_pockets=2 if seq["plddt"] > 80 else 1,
            molecular_weight=seq["length"] * 110,  # Approximate
            isoelectric_point=6.5,
            hydrophobicity=-0.3,
            active_site_accessibility=0.6 if seq["plddt"] > 80 else 0.4,
        )
        print(f"   Created: {candidate.sequence_id}")

    # Run ranking
    print("\n4. Ranking candidates...")
    ranked = ranker.rank_candidates(verbose=False)

    print("\n" + "-" * 50)
    print("DEMO RANKING RESULTS")
    print("-" * 50)
    print(f"{'Rank':<6}{'ID':<20}{'pLDDT':<10}{'Score':<10}{'Notes'}")
    print("-" * 50)

    for c in ranked:
        notes = "High confidence" if c.plddt_mean > 85 else "Moderate" if c.plddt_mean > 70 else "Low confidence"
        print(f"{c.rank:<6}{c.sequence_id:<20}{c.plddt_mean:<10.1f}{c.overall_score:<10.3f}{notes}")

    print("-" * 50)

    # Save demo results
    print("\n5. Saving demo results...")
    outputs = ranker.save_rankings("results", top_n=len(ranked))

    print("\n" + "=" * 60)
    print("DEMO COMPLETE")
    print("=" * 60)
    print("\nGenerated files:")
    for name, path in outputs.items():
        print(f"  - {path}")

    print("\nTo run the full pipeline with real data:")
    print("  python run_pipeline.py")
    print("\nTo mine sequences from UniProt:")
    print("  python run_pipeline.py --step mine")
    print("=" * 60)


if __name__ == "__main__":
    run_demo()
