DEEP THOUGHS — PHASE 1

Place these files in the ROOT of the Deep-Thoughs repository,
beside the existing audio folder:

  index.html
  style.css
  program.js

Then enable GitHub Pages:
Settings > Pages > Deploy from branch > main / root

WHAT IT DOES
1. Reads the public GitHub repository tree.
2. Finds every .ogg file inside audio/.
3. Uses the folder path as the category.
4. Uses the filename as the word.
5. Prints a category count and total file count.

Examples:
  audio/noun/machine.ogg
  becomes vocabulary.noun

  audio/pauses/breath/sniffle.ogg
  becomes vocabulary.pauses.breath

No filenames are hardcoded.

This version does not yet preload or play the audio.
It proves that the machine can discover its own vocabulary.
