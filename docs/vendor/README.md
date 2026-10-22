# PDF dependencies

- `jspdf.umd.min.js`: jsPDF 4.2.1, MIT license in `jspdf-LICENSE.txt`.
  Source: https://registry.npmjs.org/jspdf/-/jspdf-4.2.1.tgz
  Package integrity (SHA-512):
  `YyAXyvnmjTbR4bHQRLzex3CuINCDlQnBqoSYyjJwTP2x9jDLuKDzy7aKUl0hgx3uhcl7xzg32agn5vlie6HIlQ==`
- `print-fonts.js`: Latin/Cyrillic subsets of Liberation Sans Regular and Bold,
  renamed **PSO Print** as required for derivatives of reserved font names.
  SIL OFL 1.1 license and original copyright notices: `fonts-LICENSE.txt`.
  Source: https://github.com/liberationfonts/liberation-fonts
  Regenerate from the Debian `fonts-liberation` package using
  `python scripts/prepare-print-fonts.py` (requires Python `fontTools`), or pass
  a directory containing `LiberationSans-Regular.ttf` and `LiberationSans-Bold.ttf`.

These assets are committed and cached locally. PDF export does not fetch a CDN,
upload schedule data, or require a new build dependency.
