"""Regenerate the bundled PDF font subsets (requires Python fontTools).

Sources: Liberation Sans 2, distributed under SIL OFL 1.1.
Default source directory is the Debian fonts-liberation package location.
"""
import base64
import io
import pathlib
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

source = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/truetype/liberation')
target = pathlib.Path(__file__).resolve().parent.parent / 'docs/vendor/print-fonts.js'
exports = ['// Subsets of Liberation Sans, renamed PSO Print; SIL OFL 1.1. See fonts-LICENSE.txt.']
for style, export in [('Regular', 'regular'), ('Bold', 'bold')]:
    font = TTFont(source / f'LiberationSans-{style}.ttf')
    # OFL reserved names must not be used by modified fonts.
    names = {1:'PSO Print', 2:style, 3:f'PSOPrint-{style}', 4:f'PSO Print {style}', 6:f'PSOPrint-{style}'}
    for entry in font['name'].names:
        if entry.nameID in names:
            entry.string = names[entry.nameID].encode(entry.getEncoding())
    options = subset.Options()
    options.name_IDs = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=list(range(0x20, 0x100)) + list(range(0x400, 0x500)) + list(range(0x2000, 0x2070)) + [0x2116])
    sub.subset(font)
    output = io.BytesIO()
    font.save(output)
    encoded = base64.b64encode(output.getvalue()).decode('ascii')
    exports.append(f"export const {export} = '{encoded}';")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text('\n'.join(exports) + '\n')
