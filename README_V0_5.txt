DEEP THOUGS — V0.5

COPY TO THE REPOSITORY ROOT
  index.html
  style.css
  program.js

NEW IN V0.5
- Discovers audio/suffix/s.ogg and audio/suffix/es.ogg automatically.
- Plural-looking determiners such as two, all, these and those now
  trigger a stitched suffix on the following noun.
- The suffix is scheduled as part of the noun, with 8–25 ms overlap
  and no normal word gap.
- The displayed sentence joins the noun and suffix into one word.
- Nouns ending in s, x, z, ch or sh usually receive “es”.
- Other nouns usually receive “s”.
- The machine is still permitted to produce womans, childs and carses.

Examples:
  two + boat + s  -> two boats
  these + bridge + es -> these bridgees, if fate insists
  all + woman + s -> all womans

V0.6 can turn the single-thought button into continuous jabbering,
with proper pauses between thoughts and the rolling live-caption buffer.
