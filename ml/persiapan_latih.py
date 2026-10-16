"""Report prerequisites without importing/downloading ML packages. --train runs IndoBERT."""
import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--train', action='store_true')
args = parser.parse_args()
required = ['torch', 'transformers', 'seqeval', 'numpy', 'matplotlib']
missing = [m for m in required if importlib.util.find_spec(m) is None]
manifest = ROOT / 'data/aset/manifest.json'
report = {'ready': not missing and manifest.exists(), 'missing_packages': missing,
          'catalog_dataset_exists': manifest.exists(),
          'weights_exist': (ROOT / 'model/indobert-suarapapan/config.json').exists(),
          'training_performed': (ROOT / 'hasil/aset/metrik_latih.json').exists(),
          'command': 'python ml/latih_ner.py --data-dir ml/data/aset --results ml/hasil/aset --batch 4 --epochs 5'}
print(json.dumps(report, indent=2))
if args.train:
    if not report['ready']:
        sys.exit(2)
    subprocess.run([sys.executable, str(ROOT / 'latih_ner.py'), '--data-dir', str(ROOT / 'data/aset'),
                    '--results', str(ROOT / 'hasil/aset'), '--batch', '4', '--epochs', '5'], check=True)
