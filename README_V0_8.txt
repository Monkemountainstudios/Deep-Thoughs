DEEP THOUGHTS — V0.8
THE MACHINE NOTICES

Copy these files to the repository root:
  index.html
  style.css
  program.js

The GitHub repository remains named:
  Deep-Thoughs

The printed page title is now:
  DEEP THOUGHTS

NEW IN V0.8
- “No.” completes its own transcript line.
- A restarted thought begins on a fresh line.
- audio/rare/ is discovered automatically.
- Rare files are complete spoken intrusions, not vocabulary words.
- Rare events have a real-time cooldown of 10–20 minutes.
- After cooldown, each thought cycle has a 2.5% trigger chance.
- The same rare file will not normally repeat immediately.
- Rare events receive 8–15 seconds of silence afterwards.
- Rare transcript lines are visually separated and slightly distinct.
- Rare events never trigger an “Eh... No.” correction.

KNOWN RARE CAPTIONS
  mean.ogg       I didn't mean to say that.
  say.ogg        Why did I say that?
  ssh.ogg        Sssh, someone is here.
  who.ogg        Who are you?
  why.ogg        Why aren't you answering?
  are.ogg        Are you there?
  listening.ogg  I think someone is listening to us!

Additional .ogg files can be added to audio/rare/ without changing the loader.
For an unknown rare filename, the filename itself becomes the transcript text
until a prettier caption is added to rareCaptionFor().
