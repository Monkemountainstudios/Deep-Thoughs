(() => {
  "use strict";

  // ------------------------------------------------------------
  // DEEP THOUGHTS — V0.8
  // Prosody, dramatic pauses, stress, room presence,
  // continuous thought, full live transcript, rare intrusions, CC toggle,
  // abandoned thoughts, and stitched plural suffixes.
  // ------------------------------------------------------------

  const OWNER = "Monkemountainstudios";
  const REPOSITORY = "Deep-Thoughs";
  const BRANCH = "main";
  const AUDIO_ROOT = "audio/";

  const TREE_URL =
    `https://api.github.com/repos/${OWNER}/${REPOSITORY}` +
    `/git/trees/${BRANCH}?recursive=1`;

  const RAW_ROOT =
    `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${BRANCH}/`;

  const thoughtButton = document.querySelector("#thoughtButton");
  const transcript = document.querySelector("#transcript");
  const ccButton = document.querySelector("#ccButton");
  const statusText = document.querySelector("#statusText");
  const reportText = document.querySelector("#reportText");
  const lamp = document.querySelector("#lamp");

  const vocabulary = {};
  const buffers = new Map();

  let audioContext = null;
  let dryBus = null;
  let reverbInput = null;
  let masterGain = null;
  let vocabularyReady = false;
  let audioReady = false;
  let speaking = false;
  let continuousThinking = false;
  let stopRequested = false;
  let loopToken = 0;
  let captionTimers = [];
  let captionsEnabled = true;
  let currentTranscriptLine = null;
  let currentLineWords = [];
  const completedTranscriptLines = [];
  const MAX_TRANSCRIPT_LINES = 10;

  let nextRareAllowedAt = 0;
  let lastRarePath = null;

  const PLURAL_DETERMINERS = new Set([
    "all", "two", "these", "those", "many", "several", "both", "three", "four", "heaps", 
  ]);

  initialise();

  thoughtButton.addEventListener("click", async () => {
    if (continuousThinking) {
      requestStop();
      return;
    }

    try {
      thoughtButton.disabled = true;
      await prepareAudio();
      startContinuousThinking();
    } catch (error) {
      console.error(error);
      statusText.textContent = "THOUGHT FAILED";
      setTranscriptPlaceholder(error.message);
      thoughtButton.textContent = "TRY AGAIN";
      thoughtButton.disabled = false;
      lamp.classList.remove("active");
    }
  });

  ccButton.addEventListener("click", () => {
    captionsEnabled = !captionsEnabled;
    ccButton.textContent = captionsEnabled ? "CC: ON" : "CC: OFF";
    ccButton.setAttribute("aria-pressed", String(captionsEnabled));
    transcript.classList.toggle("cc-off", !captionsEnabled);
  });

  async function initialise() {
    try {
      const tree = await fetchRepositoryTree();
      const audioFiles = findAudioFiles(tree);

      buildVocabulary(audioFiles);

      vocabularyReady = true;
      reportText.textContent = makeVocabularyReport(audioFiles.length);
      statusText.textContent = "VOCABULARY READY";
      setTranscriptPlaceholder("Awaiting a thought.");
      thoughtButton.textContent = "START THINKING";
      thoughtButton.disabled = false;
      ccButton.disabled = false;
      lamp.classList.add("active");
    } catch (error) {
      console.error(error);
      statusText.textContent = "LOAD FAILED";
      setTranscriptPlaceholder(error.message);
      reportText.textContent = "The archive resisted inspection.";
      thoughtButton.textContent = "RELOAD PAGE";
      thoughtButton.disabled = false;
      ccButton.disabled = true;
      thoughtButton.onclick = () => window.location.reload();
    }
  }

  function startContinuousThinking() {
    continuousThinking = true;
    stopRequested = false;
    speaking = true;
    loopToken += 1;

    thoughtButton.textContent = "STOP THINKING";
    thoughtButton.disabled = false;
    statusText.textContent = "THINKING";
    lamp.classList.add("active");
    clearCaptionTimers();
    resetTranscript();
    scheduleNextRareWindow();

    thoughtLoop(loopToken);
  }

  function requestStop() {
    if (!continuousThinking || stopRequested) return;

    stopRequested = true;
    thoughtButton.disabled = true;
    thoughtButton.textContent = "FINISHING THOUGHT";
    statusText.textContent = "CONCLUDING";
  }

  async function thoughtLoop(token) {
    try {
      while (continuousThinking && token === loopToken) {
        if (shouldPlayRareEvent()) {
          await performRareEvent(token);

          if (stopRequested || token !== loopToken) {
            stopContinuousThinking();
            return;
          }

          await waitSeconds(randomBetween(8.0, 15.0), token);
          continue;
        }

        const performancePlan = buildPerformance();
        beginTranscriptLine();
        await perform(performancePlan, token);
        finalizeTranscriptLine(chooseEndingMark());

        if (stopRequested || token !== loopToken) {
          stopContinuousThinking();
          return;
        }

        await waitSeconds(chooseBetweenThoughtPause(), token);
      }
    } catch (error) {
      console.error(error);
      stopContinuousThinking();
      statusText.textContent = "THOUGHT FAILED";
      setTranscriptPlaceholder(error.message);
    }
  }

  function stopContinuousThinking() {
    continuousThinking = false;
    stopRequested = false;
    speaking = false;
    loopToken += 1;

    thoughtButton.textContent = "START THINKING";
    thoughtButton.disabled = false;
    statusText.textContent = "VOCABULARY READY";
    lamp.classList.add("active");
  }

  function chooseBetweenThoughtPause() {
    const roll = Math.random();

    if (roll < 0.08) return randomBetween(7.0, 14.0);
    if (roll < 0.32) return randomBetween(3.5, 6.5);
    return randomBetween(1.7, 3.8);
  }

  function scheduleNextRareWindow() {
    nextRareAllowedAt =
      performance.now() + randomBetween(10, 20) * 60 * 1000;
  }

  function shouldPlayRareEvent() {
    const rarePool = vocabulary.rare;

    if (!Array.isArray(rarePool) || rarePool.length === 0) {
      return false;
    }

    if (performance.now() < nextRareAllowedAt) {
      return false;
    }

    // Once the real-time cooldown has expired, each thought cycle
    // gets a small chance to open the strange little door.
    return Math.random() < 0.025;
  }

  async function performRareEvent(token) {
    const entry = chooseRareEntry();

    if (!entry) {
      scheduleNextRareWindow();
      return;
    }

    const buffer = buffers.get(entry.repositoryPath);

    if (!buffer) {
      scheduleNextRareWindow();
      return;
    }

    lastRarePath = entry.repositoryPath;
    scheduleNextRareWindow();

    addRareTranscriptLine(rareCaptionFor(entry.word));

    const start = audioContext.currentTime + randomBetween(0.2, 0.55);
    const rate = randomBetween(0.992, 1.008);

    const end = scheduleAudioBuffer(
      buffer,
      start,
      rate,
      randomBetween(0.66, 0.76),
      randomBetween(0.09, 0.12)
    );

    await waitUntil(end + 0.2, token);
  }

  function chooseRareEntry() {
    const pool = vocabulary.rare || [];
    const choices = pool.filter(entry => entry.repositoryPath !== lastRarePath);
    return randomChoice(choices.length ? choices : pool);
  }

  function rareCaptionFor(fileWord) {
    const captions = {
      mean: "I didn't mean to say that.",
      say: "Why did I say that?",
      ssh: "Sssh, someone is here.",
      who: "Who are you?",
      why: "Why aren't you answering?",
      are: "Are you there?",
      listening: "I think someone is listening to us!"
    };

    return captions[fileWord.toLowerCase()] || fileWord;
  }

  function addRareTranscriptLine(text) {
    const dividerTop = document.createElement("div");
    dividerTop.className = "rare-divider";

    const line = document.createElement("p");
    line.className = "transcript-line rare-line";
    line.textContent = text;

    const dividerBottom = document.createElement("div");
    dividerBottom.className = "rare-divider";

    transcript.querySelector(".transcript-placeholder")?.remove();
    transcript.append(dividerTop, line, dividerBottom);

    completedTranscriptLines.push(line);
    trimTranscript();
    updateTranscriptFading();
    transcript.scrollTop = transcript.scrollHeight;
  }

  // ------------------------------------------------------------
  // VOCABULARY LOADER
  // ------------------------------------------------------------

  async function fetchRepositoryTree() {
    const response = await fetch(TREE_URL, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.tree)) {
      throw new Error("GitHub did not return a usable file tree.");
    }

    if (data.truncated) {
      throw new Error("The repository tree was truncated.");
    }

    return data.tree;
  }

  function findAudioFiles(tree) {
    return tree
      .filter(item =>
        item.type === "blob" &&
        item.path.startsWith(AUDIO_ROOT) &&
        item.path.toLowerCase().endsWith(".ogg")
      )
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  function buildVocabulary(audioFiles) {
    clearObject(vocabulary);

    for (const file of audioFiles) {
      const relativePath = file.path.slice(AUDIO_ROOT.length);
      const parts = relativePath.split("/");
      const fileName = parts.pop();
      const word = fileName.replace(/\.ogg$/i, "");

      placeEntry(vocabulary, parts, {
        word,
        repositoryPath: file.path,
        audioUrl: RAW_ROOT + encodePath(file.path)
      });
    }
  }

  function placeEntry(root, categoryPath, entry) {
    if (categoryPath.length === 0) {
      root._uncategorized ??= [];
      root._uncategorized.push(entry);
      return;
    }

    let level = root;

    categoryPath.forEach((category, index) => {
      const finalCategory = index === categoryPath.length - 1;

      if (finalCategory) {
        level[category] ??= [];
        level[category].push(entry);
      } else {
        level[category] ??= {};
        level = level[category];
      }
    });
  }

  // ------------------------------------------------------------
  // THOUGHT + PERFORMANCE PLANNING
  // ------------------------------------------------------------

  function buildPerformance() {
    if (Math.random() < 0.07) {
      return buildAbandonedThought();
    }

    const thought = buildThought();
    return {
      displayThought: thought,
      events: annotateThought(thought),
      mode: thought.mode
    };
  }

  function buildAbandonedThought() {
    const falseThought = buildThought();
    const falseWords = falseThought.words.filter(item => item.type !== "pause");
    const cutoff = Math.min(
      falseWords.length,
      randomInt(2, Math.max(2, Math.min(5, falseWords.length)))
    );

    const abandoned = falseWords.slice(0, cutoff);
    const correction = buildThought();

    const eh = findAnyWord(["eh", "eeh", "um", "ahem", "bah"]);
    const no = findAnyWord(["no"]);

    const events = [];

    abandoned.forEach((word, index) => {
      events.push(makeWordEvent(word, {
        role: index === abandoned.length - 1 ? "abandoned-final" : "normal",
        stress: index === abandoned.length - 1 ? 0.6 : 0.2
      }));
    });

    events.push({ type: "pause", duration: randomBetween(0.8, 1.8) });

    if (eh) {
      events.push(makeWordEvent(eh, { role: "aside", stress: 0.2 }));
      events.push({ type: "pause", duration: randomBetween(0.35, 0.8) });
    }

    if (no) {
      events.push(makeWordEvent(no, {
        role: "correction",
        stress: 0.85,
        breakAfter: true
      }));
      events.push({ type: "pause", duration: randomBetween(1.2, 2.6) });
    }

    const correctionEvents = annotateThought(correction);
    events.push(...correctionEvents);

    return {
      displayThought: correction,
      events,
      mode: "self-correcting",
      abandonedWords: abandoned.map(item => item.word)
    };
  }

  function annotateThought(thought) {
    const realWords = thought.words.filter(item => item.type !== "pause");
    const stressIndexes = chooseStressIndexes(realWords);
    const events = [];
    let wordIndex = 0;

    for (const item of thought.words) {
      if (item.type === "pause") {
        events.push(item);
        continue;
      }

      const role = inferRole(item, wordIndex, realWords.length);
      const stress = stressIndexes.has(wordIndex)
        ? randomBetween(0.72, 1.0)
        : randomBetween(0.05, 0.35);

      events.push(makeWordEvent(item, { role, stress }));
      wordIndex += 1;
    }

    return events;
  }

  function chooseStressIndexes(words) {
    const weightedCandidates = words
      .map((word, index) => ({
        index,
        weight: importanceWeight(word)
      }))
      .filter(item => item.weight > 0);

    const chosen = new Set();
    const count = weightedChoice([[1, 70], [2, 27], [3, 3]]);

    while (weightedCandidates.length && chosen.size < count) {
      const total = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * total;
      let selectedIndex = 0;

      for (let i = 0; i < weightedCandidates.length; i += 1) {
        roll -= weightedCandidates[i].weight;
        if (roll <= 0) {
          selectedIndex = i;
          break;
        }
      }

      chosen.add(weightedCandidates[selectedIndex].index);
      weightedCandidates.splice(selectedIndex, 1);
    }

    return chosen;
  }

  function importanceWeight(entry) {
    const path = entry.repositoryPath;

    if (path.includes("/noun/")) return 1.0;
    if (path.includes("/verb/")) return 0.95;
    if (path.includes("/adjective/")) return 0.68;
    if (path.includes("/adverb/")) return 0.42;
    if (path.includes("/modal/")) return 0.48;
    if (path.includes("/interjection/")) return 0.55;
    if (path.includes("/preposition/")) return 0.12;
    if (path.includes("/connector/")) return 0.08;
    if (path.includes("/determiner/")) return 0.02;
    return 0.25;
  }

  function inferRole(entry, index, totalWords) {
    const path = entry.repositoryPath;

    if (index === totalWords - 1) return "final";
    if (path.includes("/connector/")) return "connector";
    if (path.includes("/preposition/")) return "preposition";
    if (path.includes("/modal/")) return "modal";
    if (path.includes("/auxiliary/")) return "auxiliary";
    if (path.includes("/verb/")) return "verb";
    if (path.includes("/noun/")) return "noun";
    if (path.includes("/adjective/")) return "adjective";
    if (path.includes("/adverb/")) return "adverb";
    if (path.includes("/interjection/")) return "interjection";
    return "normal";
  }

  function makeWordEvent(entry, extra = {}) {
    return {
      type: "word",
      entry,
      role: extra.role || "normal",
      stress: extra.stress ?? 0.2,
      breakAfter: Boolean(extra.breakAfter)
    };
  }

  // ------------------------------------------------------------
  // THOUGHT ENGINE
  // ------------------------------------------------------------

  function buildThought() {
    const builders = [
      sentenceModal,
      sentenceCopular,
      sentenceCompoundSubject,
      sentenceCompoundObject,
      sentencePrepositional,
      sentenceItWas,
      sentencePronounModal,
      sentenceFragment
    ];

    return randomChoice(builders)();
  }

 function sentenceModal() {
  return {
    words: [
      ...buildNounPhrase(),
      pick("modal"),
      ...maybeNot(),
      ...buildAdverbList(),
      pick("verb"),
      ...maybeObjectPhrase(),
      ...maybePrepositionalPhrase()
    ],
    mode: randomChoice(["reflective", "oracle", "measured"])
  };
}

  function sentenceCopular() {
    return {
      words: [
        ...buildNounPhrase(),
        pickCopula(),
        ...buildPredicateAdjectives()
      ],
      mode: randomChoice(["solemn", "reflective", "certain"])
    };
  }

  function sentenceCompoundSubject() {
    return {
      words: [
        ...buildNounPhrase(false),
        pickWord("connector", "and"),
        ...buildNounPhrase(false),
        pick("modal"),
        ...buildAdverbList(),
        pick("verb"),
        ...maybeObjectPhrase()
      ],
      mode: "measured"
    };
  }

  function sentenceCompoundObject() {
    return {
      words: [
        ...buildNounPhrase(),
        pick("modal"),
        pick("verb"),
        ...buildNounPhrase(),
        pickWord("connector", "and"),
        ...buildNounPhrase()
      ],
      mode: randomChoice(["story", "oracle"])
    };
  }
  function sentencePronounModal() {
  const subject = pickAvailableWord("pronoun", [
    "i", "he", "she", "it", "we", "they"
  ]);

  return {
    words: [
      subject,
      pick("modal"),
      ...buildAdverbList(),
      pick("verb"),
      ...maybeObjectPhrase(),
      ...maybePrepositionalPhrase()
    ],
    mode: randomChoice(["reflective", "oracle", "measured"])
  };
}

  function sentencePrepositional() {
    return {
      words: [
        ...buildPrepositionalPhrase(),
        { type: "pause", duration: randomBetween(0.35, 0.8) },
        ...buildNounPhrase(),
        pick("modal"),
        ...buildAdverbList(),
        pick("verb")
      ],
      mode: "dreamlike"
    };
  }

  function sentenceItWas() {
    const it = pickWord("pronoun", "it");
    const was = pickAvailableWord("auxiliary", ["was", "is", "will"]);

    return {
      words: [
        it,
        was,
        ...buildPredicateAdjectives(),
        pickWord("connector", "and"),
        ...buildPredicateAdjectives()
      ],
      mode: randomChoice(["measured", "solemn"])
    };
  }

  function sentenceFragment() {
    return {
      words: [
        ...buildNounPhrase(),
        { type: "pause", duration: randomBetween(0.55, 1.2) },
        ...buildAdverbList(1, 3),
        pick("verb")
      ],
      mode: "odd"
    };
  }

  function buildNounPhrase(allowCompound = true) {
    const phrase = [];
    let determiner = null;

    if (Math.random() < 0.9) {
      determiner = pick("determiner");
      phrase.push(determiner);
    }

    phrase.push(...buildAdjectiveList(0, adjectiveMaximum()));
    phrase.push(buildNounForDeterminer(determiner));

    if (allowCompound && Math.random() < 0.17) {
      phrase.push(pickWord("connector", "and"));

      let secondDeterminer = null;

      if (Math.random() < 0.75) {
        secondDeterminer = pick("determiner");
        phrase.push(secondDeterminer);
      }

      phrase.push(...buildAdjectiveList(0, adjectiveMaximum()));
      phrase.push(buildNounForDeterminer(secondDeterminer));
    }

    if (Math.random() < 0.12) {
      phrase.push(pickWord("preposition", "of"));
      phrase.push(...buildNounPhrase(false));
    }

    return phrase;
  }

  function buildNounForDeterminer(determiner) {
    const noun = pick("noun");
    const determinerWord = determiner?.word?.toLowerCase() || "";
    const shouldPluralize = PLURAL_DETERMINERS.has(determinerWord);

    if (!shouldPluralize) {
      return noun;
    }

    return makePluralNoun(noun);
  }

  function makePluralNoun(noun) {
    const suffixPool = vocabulary.suffix;

    if (!Array.isArray(suffixPool) || suffixPool.length === 0) {
      return noun;
    }

    const lower = noun.word.toLowerCase();
    const naturallyWantsEs = /(s|x|z|ch|sh)$/.test(lower);

    // Mostly sensible, occasionally confidently wrong.
    const useEs = naturallyWantsEs
      ? Math.random() < 0.84
      : Math.random() < 0.10;

    const wanted = useEs ? "es" : "s";
    const suffix =
      suffixPool.find(entry => entry.word.toLowerCase() === wanted) ||
      randomChoice(suffixPool);

    return {
      ...noun,
      word: `${noun.word}${suffix.word}`,
      baseWord: noun.word,
      suffixEntry: suffix,
      isPluralized: true
    };
  }

  function buildPredicateAdjectives() {
    const adjectives = buildAdjectiveList(1, adjectiveMaximum(), true);

    if (adjectives.length >= 2 && Math.random() < 0.7) {
      const last = adjectives.pop();
      adjectives.push(pickWord("connector", "and"));
      adjectives.push(last);
    }

    return adjectives;
  }

  function buildAdjectiveList(minimum = 0, maximum = 3, force = false) {
    const count = force
      ? randomInt(Math.max(1, minimum), maximum)
      : weightedCount(minimum, maximum);

    return uniquePicks("adjective", count);
  }

  function buildAdverbList(minimum = 0, maximum = 2) {
    return uniquePicks("adverb", weightedCount(minimum, maximum));
  }

  function buildPrepositionalPhrase() {
    return [pick("preposition"), ...buildNounPhrase(false)];
  }

  function maybeObjectPhrase() {
    return Math.random() < 0.72 ? buildNounPhrase() : [];
  }
function maybeNot(chance = 0.22) {
  return Math.random() < chance
    ? [pickWord("auxiliary", "not")]
    : [];
}
  function maybePrepositionalPhrase() {
    return Math.random() < 0.42 ? buildPrepositionalPhrase() : [];
  }

  function adjectiveMaximum() {
    const roll = Math.random();
    if (roll < 0.62) return 2;
    if (roll < 0.9) return 4;
    return 7;
  }

  function weightedCount(minimum, maximum) {
    let count = minimum;
    while (count < maximum && Math.random() < 0.46) count += 1;
    return count;
  }

  function pickCopula() {
    return pickAvailableWord("auxiliary", [
      "is", "was", "are", "were", "seems", "becomes"
    ]);
  }

  // ------------------------------------------------------------
  // PERFORMANCE ENGINE
  // ------------------------------------------------------------

  async function prepareAudio() {
    if (!vocabularyReady) {
      throw new Error("The vocabulary is not ready.");
    }

    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("This browser does not support Web Audio.");
      }

      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(audioContext.destination);

      dryBus = audioContext.createGain();
      dryBus.gain.value = 0.92;
      dryBus.connect(masterGain);

      reverbInput = createRoomPresence(audioContext);
      reverbInput.connect(masterGain);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (audioReady) return;

    statusText.textContent = "PREPARING THE VOICE";
    setTranscriptPlaceholder("Loading recorded words...");
    thoughtButton.textContent = "LOADING VOICE";

    const entries = flattenVocabulary(vocabulary);
    let loaded = 0;

    await Promise.all(entries.map(async entry => {
      const response = await fetch(entry.audioUrl);

      if (!response.ok) {
        throw new Error(`Could not load ${entry.repositoryPath}`);
      }

      const data = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(data);
      buffers.set(entry.repositoryPath, buffer);

      loaded += 1;
      setTranscriptPlaceholder(
        `Loading recorded words: ${loaded}/${entries.length}`
      );
    }));

    audioReady = true;
  }

  async function perform(performance, token) {
    let cursor = audioContext.currentTime + 0.08;
    const style = performanceStyle(performance.mode);
    const wordEvents = performance.events.filter(event => event.type === "word");
    let spokenWordIndex = 0;

    for (const event of performance.events) {
      if (event.type === "pause") {
        cursor += event.duration;
        continue;
      }

      const progress = wordEvents.length <= 1
        ? 0
        : spokenWordIndex / (wordEvents.length - 1);

      const pitchArc = cadencePitch(style.cadence, progress);
      const stressPitch = 1 + event.stress * randomBetween(0.010, 0.028);
      const stressGain = 1 + event.stress * randomBetween(0.04, 0.13);

      const start = cursor;

      scheduleCaptionWord(
        event.entry.word,
        start,
        token,
        event.breakAfter
      );

      const end = scheduleWord(
        event.entry,
        start,
        style.basePitch * pitchArc * stressPitch * randomBetween(0.995, 1.005),
        style.gain * stressGain,
        style.wet
      );

      cursor = end + gapAfter(event, style);
      spokenWordIndex += 1;
    }

    if (Math.random() < style.breathChance) {
      cursor += randomBetween(0.22, 0.6);
      cursor = scheduleNaturalEvent(cursor, style.wet * 1.15);
    }

    await waitUntil(cursor + 0.15, token);
  }

  function scheduleCaptionWord(word, startTime, token, breakAfter = false) {
    const delay = Math.max(
      0,
      (startTime - audioContext.currentTime) * 1000
    );

    const timer = window.setTimeout(() => {
      if (token !== loopToken || !continuousThinking) return;
      appendTranscriptWord(word);

      if (breakAfter) {
        finalizeTranscriptLine(".");
        beginTranscriptLine();
      }
    }, delay);

    captionTimers.push(timer);
  }

  function beginTranscriptLine() {
    currentLineWords = [];

    const line = document.createElement("p");
    line.className = "transcript-line current";
    line.textContent = "";

    transcript.querySelector(".transcript-placeholder")?.remove();
    transcript.appendChild(line);
    currentTranscriptLine = line;

    trimTranscript();
  }

  function appendTranscriptWord(word) {
    if (!currentTranscriptLine) {
      beginTranscriptLine();
    }

    currentLineWords.push(word);
    currentTranscriptLine.textContent = currentLineWords.join(" ");
    transcript.scrollTop = transcript.scrollHeight;
  }

  function finalizeTranscriptLine(endingMark = ".") {
    if (!currentTranscriptLine) return;

    const baseText = currentLineWords.join(" ").trim();

    if (baseText) {
      currentTranscriptLine.textContent = `${baseText}${endingMark}`;
      currentTranscriptLine.classList.remove("current");
      completedTranscriptLines.push(currentTranscriptLine);
    } else {
      currentTranscriptLine.remove();
    }

    currentTranscriptLine = null;
    currentLineWords = [];

    updateTranscriptFading();
    trimTranscript();
  }

  function chooseEndingMark() {
    const roll = Math.random();

    if (roll < 0.73) return ".";
    if (roll < 0.90) return "...";
    if (roll < 0.97) return "?";
    return " —";
  }

  function trimTranscript() {
    const lines = [...transcript.querySelectorAll(".transcript-line")];

    while (lines.length > MAX_TRANSCRIPT_LINES) {
      const oldest = lines.shift();
      if (!oldest) break;

      const previous = oldest.previousElementSibling;
      const next = oldest.nextElementSibling;

      if (previous?.classList.contains("rare-divider")) previous.remove();
      if (next?.classList.contains("rare-divider")) next.remove();

      oldest.remove();

      const index = completedTranscriptLines.indexOf(oldest);
      if (index >= 0) completedTranscriptLines.splice(index, 1);
    }

    updateTranscriptFading();
  }

  function updateTranscriptFading() {
    const lines = [...transcript.querySelectorAll(".transcript-line")];
    const total = lines.length;

    lines.forEach((line, index) => {
      const age = total - 1 - index;
      const opacity = Math.max(0.28, 1 - age * 0.075);
      line.style.opacity = String(opacity);

      if (line.classList.contains("rare-line")) {
        const previous = line.previousElementSibling;
        const next = line.nextElementSibling;

        if (previous?.classList.contains("rare-divider")) {
          previous.style.opacity = String(opacity * 0.7);
        }

        if (next?.classList.contains("rare-divider")) {
          next.style.opacity = String(opacity * 0.7);
        }
      }
    });
  }

  function resetTranscript() {
    transcript.innerHTML = "";
    completedTranscriptLines.length = 0;
    currentTranscriptLine = null;
    currentLineWords = [];
  }

  function setTranscriptPlaceholder(message) {
    resetTranscript();

    const placeholder = document.createElement("p");
    placeholder.className = "transcript-placeholder";
    placeholder.textContent = message;
    transcript.appendChild(placeholder);
  }

  function clearCaptionTimers() {
    for (const timer of captionTimers) {
      window.clearTimeout(timer);
    }

    captionTimers = [];
  }

  function scheduleWord(entry, startTime, playbackRate, gainValue, wetAmount) {
    const baseBuffer = buffers.get(entry.repositoryPath);
    if (!baseBuffer) return startTime;

    const baseEnd = scheduleAudioBuffer(
      baseBuffer,
      startTime,
      playbackRate,
      gainValue,
      wetAmount
    );

    if (!entry.suffixEntry) {
      return baseEnd;
    }

    const suffixBuffer = buffers.get(entry.suffixEntry.repositoryPath);

    if (!suffixBuffer) {
      return baseEnd;
    }

    // The suffix is part of the noun, not another spoken word.
    // Start it just before the noun has completely finished.
    const overlap = randomBetween(0.008, 0.025);
    const suffixStart = Math.max(startTime + 0.02, baseEnd - overlap);
    const suffixRate = playbackRate * randomBetween(0.995, 1.012);

    return scheduleAudioBuffer(
      suffixBuffer,
      suffixStart,
      suffixRate,
      gainValue * randomBetween(0.82, 0.94),
      wetAmount
    );
  }

  function scheduleAudioBuffer(
    buffer,
    startTime,
    playbackRate,
    gainValue,
    wetAmount
  ) {
    const source = audioContext.createBufferSource();
    const envelope = audioContext.createGain();
    const wetSend = audioContext.createGain();

    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const endTime = startTime + buffer.duration / playbackRate;
    const fadeStart = Math.max(startTime + 0.01, endTime - 0.014);

    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, gainValue),
      startTime + 0.006
    );
    envelope.gain.setValueAtTime(
      Math.max(0.0001, gainValue),
      fadeStart
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

    wetSend.gain.value = wetAmount * randomBetween(0.82, 1.18);

    source.connect(envelope);
    envelope.connect(dryBus);
    envelope.connect(wetSend);
    wetSend.connect(reverbInput);

    source.start(startTime);
    source.stop(endTime + 0.02);

    return endTime;
  }

  function gapAfter(event, style) {
    let mean = style.wordGap;
    let variation = style.wordGapVariation;

    // These are phrase cues, not fixed pauses.
    // Every value is still randomized.
    const roleAdjustments = {
      connector: [0.10, 0.09],
      preposition: [0.045, 0.05],
      modal: [0.055, 0.055],
      auxiliary: [0.025, 0.035],
      verb: [0.07, 0.065],
      noun: [0.025, 0.035],
      adjective: [0.00, 0.018],
      adverb: [0.025, 0.035],
      interjection: [0.30, 0.18],
      final: [0.34, 0.20],
      "abandoned-final": [0.58, 0.30],
      correction: [0.42, 0.22],
      aside: [0.20, 0.14]
    };

    const adjustment = roleAdjustments[event.role];

    if (adjustment) {
      mean += adjustment[0];
      variation += adjustment[1];
    }

    if (event.stress > 0.65) {
      mean += randomBetween(0.025, 0.10);
    }

    if (Math.random() < style.dramaticPauseChance) {
      mean += randomBetween(0.28, 0.85);
      variation += 0.14;
    }

    return Math.max(
      0.008,
      mean + randomBetween(-variation, variation)
    );
  }

  function cadencePitch(cadence, position) {
    if (cadence === "falling") return 1.022 - position * 0.05;
    if (cadence === "rising") return 0.986 + position * 0.045;
    if (cadence === "hill") return 0.994 + Math.sin(position * Math.PI) * 0.025;
    if (cadence === "wandering") {
      return 1 + Math.sin(position * Math.PI * 2) * 0.018;
    }
    return 1;
  }

  function performanceStyle(mode) {
    const styles = {
      reflective: {
        wordGap: 0.024, wordGapVariation: 0.016,
        basePitch: 0.995, gain: 0.69, wet: 0.3,
        cadence: "falling", dramaticPauseChance: 0.08, breathChance: 0.45
      },
      oracle: {
        wordGap: 0.030, wordGapVariation: 0.020,
        basePitch: 0.988, gain: 0.72, wet: 0.350,
        cadence: "hill", dramaticPauseChance: 0.18, breathChance: 0.42
      },
      measured: {
        wordGap: 0.020, wordGapVariation: 0.014,
        basePitch: 1.0, gain: 0.70, wet: 0.25,
        cadence: "falling", dramaticPauseChance: 0.05, breathChance: 0.32
      },
      solemn: {
        wordGap: 0.034, wordGapVariation: 0.022,
        basePitch: 0.982, gain: 0.68, wet: 0.25,
        cadence: "falling", dramaticPauseChance: 0.13, breathChance: 0.52
      },
      certain: {
        wordGap: 0.016, wordGapVariation: 0.012,
        basePitch: 1.006, gain: 0.74, wet: 0.27,
        cadence: "falling", dramaticPauseChance: 0.03, breathChance: 0.24
      },
      story: {
        wordGap: 0.020, wordGapVariation: 0.016,
        basePitch: 1.002, gain: 0.70, wet: 0.2,
        cadence: "wandering", dramaticPauseChance: 0.06, breathChance: 0.34
      },
      dreamlike: {
        wordGap: 0.032, wordGapVariation: 0.024,
        basePitch: 1.006, gain: 0.64, wet: 0.5,
        cadence: "wandering", dramaticPauseChance: 0.12, breathChance: 0.58
      },
      odd: {
        wordGap: 0.022, wordGapVariation: 0.020,
        basePitch: 1.012, gain: 0.70, wet: 0.35,
        cadence: "rising", dramaticPauseChance: 0.10, breathChance: 0.40
      },
      "self-correcting": {
        wordGap: 0.028, wordGapVariation: 0.022,
        basePitch: 0.997, gain: 0.67, wet: 0.54,
        cadence: "wandering", dramaticPauseChance: 0.08, breathChance: 0.55
      }
    };

    return styles[mode] || styles.reflective;
  }

  function scheduleNaturalEvent(startTime, wetAmount) {
    const pools = [];

    if (vocabulary.pause?.breath?.length) pools.push(vocabulary.pause.breath);
    if (vocabulary.pause?.longbreath?.length && Math.random() < 0.22) {
      pools.push(vocabulary.pause.longbreath);
    }

    if (!pools.length) return startTime;

    const entry = randomChoice(randomChoice(pools));
    const buffer = buffers.get(entry.repositoryPath);
    if (!buffer) return startTime;

    return scheduleWord(
      entry,
      startTime,
      randomBetween(0.985, 1.015),
      randomBetween(0.38, 0.5),
      wetAmount
    );
  }

  function createRoomPresence(context) {
    const input = context.createGain();
    const preDelay = context.createDelay(0.1);
    const convolver = context.createConvolver();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const wet = context.createGain();

    preDelay.delayTime.value = randomBetween(0.009, 0.057);

    highpass.type = "highpass";
    highpass.frequency.value = 260;

    lowpass.type = "lowpass";
    lowpass.frequency.value = randomBetween(3900, 6900);

    wet.gain.value = randomBetween(0.29, 0.6);

    convolver.buffer = makeImpulseResponse(
      context,
      randomBetween(2.2, 4.85),
      randomBetween(1.4, 3.1)
    );

    input.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(wet);

    return Object.assign(input, {
      connect(destination) {
        wet.connect(destination);
        return destination;
      }
    });
  }

  function makeImpulseResponse(context, duration, decay) {
    const length = Math.floor(context.sampleRate * duration);
    const impulse = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);

      for (let i = 0; i < length; i += 1) {
        const envelope = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    return impulse;
  }

  // ------------------------------------------------------------
  // DISPLAY + HELPERS
  // ------------------------------------------------------------

  function formatPerformance(performance) {
    const text = performance.displayThought.words
      .filter(item => item.type !== "pause")
      .map(item => item.word)
      .join(" ");

    if (!text) return "";

    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  }

  function findAnyWord(words) {
    const allEntries = flattenVocabulary(vocabulary);

    for (const wanted of words) {
      const found = allEntries.find(entry =>
        entry.word.toLowerCase() === wanted.toLowerCase()
      );

      if (found) return found;
    }

    return null;
  }

  function pick(category) {
    const entries = vocabulary[category];

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(`No usable words found in ${category}.`);
    }

    return randomChoice(entries);
  }

  function pickWord(category, preferredWord) {
    const entries = vocabulary[category] || [];

    return entries.find(entry =>
      entry.word.toLowerCase() === preferredWord.toLowerCase()
    ) || randomChoice(entries);
  }

  function pickAvailableWord(category, preferredWords) {
    const entries = vocabulary[category] || [];

    for (const word of preferredWords) {
      const match = entries.find(entry =>
        entry.word.toLowerCase() === word.toLowerCase()
      );

      if (match) return match;
    }

    return randomChoice(entries);
  }

  function uniquePicks(category, count) {
    const available = [...(vocabulary[category] || [])];
    const result = [];

    while (available.length && result.length < count) {
      const index = Math.floor(Math.random() * available.length);
      result.push(available.splice(index, 1)[0]);
    }

    return result;
  }

  function flattenVocabulary(object) {
    const entries = [];

    for (const value of Object.values(object)) {
      if (Array.isArray(value)) entries.push(...value);
      else entries.push(...flattenVocabulary(value));
    }

    return entries;
  }

  function makeVocabularyReport(totalFiles) {
    const lines = [
      "VOCABULARY LOADED",
      "",
      ...countCategories(vocabulary),
      "",
      `Total audio files: ${totalFiles}`
    ];

    return lines.join("\n");
  }

  function countCategories(object, path = []) {
    const lines = [];

    for (const [key, value] of Object.entries(object)) {
      const newPath = [...path, key];

      if (Array.isArray(value)) {
        lines.push(`${newPath.join("/")}: ${value.length}`);
      } else {
        lines.push(...countCategories(value, newPath));
      }
    }

    return lines.sort((a, b) => a.localeCompare(b));
  }

  function weightedChoice(entries) {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;

    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }

    return entries[entries.length - 1][0];
  }

  function encodePath(path) {
    return path
      .split("/")
      .map(part => encodeURIComponent(part))
      .join("/");
  }

  function clearObject(object) {
    for (const key of Object.keys(object)) delete object[key];
  }

  function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function waitUntil(targetTime, token = loopToken) {
    const milliseconds =
      Math.max(0, targetTime - audioContext.currentTime) * 1000;

    return new Promise(resolve => {
      window.setTimeout(() => {
        resolve(token === loopToken);
      }, milliseconds);
    });
  }

  function waitSeconds(seconds, token = loopToken) {
    return new Promise(resolve => {
      window.setTimeout(() => {
        resolve(token === loopToken);
      }, seconds * 1000);
    });
  }

  window.addEventListener("pagehide", () => {
    continuousThinking = false;
    loopToken += 1;
    clearCaptionTimers();
  });

  window.deepThoughs = {
    vocabulary,
    buffers,
    buildThought,
    buildPerformance
  };
})();
