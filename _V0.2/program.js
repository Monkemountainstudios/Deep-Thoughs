(() => {
  "use strict";

  // ------------------------------------------------------------
  // DEEP THOUGHS — PHASE 2
  // Discover the vocabulary, generate one thought, and speak it.
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
  const thoughtText = document.querySelector("#thoughtText");
  const statusText = document.querySelector("#statusText");
  const reportText = document.querySelector("#reportText");
  const lamp = document.querySelector("#lamp");

  const vocabulary = {};
  const buffers = new Map();

  let audioContext = null;
  let masterGain = null;
  let vocabularyReady = false;
  let audioReady = false;
  let speaking = false;

  initialise();

  thoughtButton.addEventListener("click", async () => {
    if (speaking) return;

    try {
      speaking = true;
      thoughtButton.disabled = true;

      await prepareAudio();

      const thought = buildThought();
      thoughtText.textContent = punctuate(displayWords(thought.words));

      statusText.textContent = "THINKING";
      lamp.classList.add("active");

      await speakThought(thought);

      statusText.textContent = "VOCABULARY READY";
      thoughtButton.textContent = "THINK AGAIN";
      thoughtButton.disabled = false;
      speaking = false;
    } catch (error) {
      console.error(error);
      statusText.textContent = "THOUGHT FAILED";
      thoughtText.textContent = error.message;
      thoughtButton.textContent = "TRY AGAIN";
      thoughtButton.disabled = false;
      speaking = false;
      lamp.classList.remove("active");
    }
  });

  async function initialise() {
    try {
      const tree = await fetchRepositoryTree();
      const audioFiles = findAudioFiles(tree);

      buildVocabulary(audioFiles);

      vocabularyReady = true;
      reportText.textContent = makeVocabularyReport(audioFiles.length);
      statusText.textContent = "VOCABULARY READY";
      thoughtText.textContent = "The machine now has words.";
      thoughtButton.textContent = "THINK A THOUGHT";
      thoughtButton.disabled = false;
      lamp.classList.add("active");

      console.log("Deep Thoughs vocabulary:", vocabulary);
    } catch (error) {
      console.error(error);
      statusText.textContent = "LOAD FAILED";
      thoughtText.textContent = error.message;
      reportText.textContent = "The archive resisted inspection.";
      thoughtButton.textContent = "RELOAD PAGE";
      thoughtButton.disabled = false;
      thoughtButton.onclick = () => window.location.reload();
    }
  }

  // ------------------------------------------------------------
  // VOCABULARY LOADER
  // ------------------------------------------------------------

  async function fetchRepositoryTree() {
    const response = await fetch(TREE_URL, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) {
      throw new Error(
        `GitHub returned ${response.status} ${response.statusText}`
      );
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

      const entry = {
        word,
        repositoryPath: file.path,
        audioUrl: RAW_ROOT + encodePath(file.path)
      };

      placeEntry(vocabulary, parts, entry);
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
  // THOUGHT BUILDER
  // ------------------------------------------------------------

  function buildThought() {
    const builders = [
      thoughtModalJourney,
      thoughtCompoundSubject,
      thoughtPredicateAdjectives,
      thoughtPrepositionalImage,
      thoughtInterjection,
      thoughtDeliberatelyOdd
    ];

    return randomChoice(builders)();
  }

  function thoughtModalJourney() {
    return {
      words: [
        ...buildNounPhrase(),
        pick("modal"),
        ...buildAdverbList(),
        pick("verb"),
        pick("preposition"),
        ...buildNounPhrase()
      ],
      style: "reflective"
    };
  }

  function thoughtCompoundSubject() {
    return {
      words: [
        ...buildNounPhrase(),
        pickWord("connector", "and"),
        ...buildNounPhrase(),
        pick("modal"),
        pick("verb")
      ],
      style: "measured"
    };
  }

  function thoughtPredicateAdjectives() {
    return {
      words: [
        ...buildNounPhrase(),
        pickAvailableWord("auxiliary", ["is", "was", "will"]),
        ...buildAdjectiveList(1, 4, true)
      ],
      style: "solemn"
    };
  }

  function thoughtPrepositionalImage() {
    return {
      words: [
        ...buildNounPhrase(),
        pick("preposition"),
        ...buildNounPhrase(),
        pick("modal"),
        ...buildAdverbList(),
        pick("verb")
      ],
      style: "dreamlike"
    };
  }

  function thoughtInterjection() {
    return {
      words: [
        pick("interjection"),
        { type: "pause", duration: randomBetween(0.5, 1.1) },
        ...buildNounPhrase(),
        pick("modal"),
        pick("verb")
      ],
      style: "hesitant"
    };
  }

  function thoughtDeliberatelyOdd() {
    return {
      words: [
        ...buildAdjectiveList(1, 3, true),
        pick("noun"),
        pick("connector"),
        ...buildAdverbList(1, 3),
        { type: "pause", duration: randomBetween(0.35, 0.8) },
        pick("noun")
      ],
      style: "odd"
    };
  }

  function buildNounPhrase() {
    const phrase = [];

    if (Math.random() < 0.88) {
      phrase.push(pick("determiner"));
    }

    phrase.push(...buildAdjectiveList(0, adjectiveMaximum()));
    phrase.push(pick("noun"));

    // Occasionally pile on a second noun.
    if (Math.random() < 0.18) {
      phrase.push(pickWord("connector", "and"));
      if (Math.random() < 0.75) phrase.push(pick("determiner"));
      phrase.push(...buildAdjectiveList(0, adjectiveMaximum()));
      phrase.push(pick("noun"));
    }

    return phrase;
  }

  function buildAdjectiveList(minimum = 0, maximum = 3, force = false) {
    const count = force
      ? randomInt(Math.max(1, minimum), maximum)
      : weightedCount(minimum, maximum);

    return uniquePicks("adjective", count);
  }

  function buildAdverbList(minimum = 0, maximum = 2) {
    const count = weightedCount(minimum, maximum);
    return uniquePicks("adverb", count);
  }

  function adjectiveMaximum() {
    const roll = Math.random();

    if (roll < 0.68) return 2;
    if (roll < 0.92) return 4;
    return 7;
  }

  function weightedCount(minimum, maximum) {
    let count = minimum;

    while (count < maximum && Math.random() < 0.48) {
      count += 1;
    }

    return count;
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
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (audioReady) return;

    statusText.textContent = "PREPARING THE VOICE";
    thoughtText.textContent = "Loading recorded words...";
    thoughtButton.textContent = "LOADING AUDIO";

    const entries = flattenVocabulary(vocabulary);
    let loaded = 0;

    await Promise.all(entries.map(async entry => {
      const response = await fetch(entry.audioUrl);

      if (!response.ok) {
        throw new Error(
          `Could not load ${entry.repositoryPath}`
        );
      }

      const data = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(data);
      buffers.set(entry.repositoryPath, buffer);

      loaded += 1;
      thoughtText.textContent =
        `Loading recorded words: ${loaded}/${entries.length}`;
    }));

    audioReady = true;
  }

  async function speakThought(thought) {
    let cursor = audioContext.currentTime + 0.08;
    const style = performanceStyle(thought.style);

    for (const item of thought.words) {
      if (item.type === "pause") {
        cursor += item.duration;
        continue;
      }

      const buffer = buffers.get(item.repositoryPath);

      if (!buffer) {
        console.warn("Missing decoded buffer:", item.repositoryPath);
        continue;
      }

      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();

      const rate =
        style.pitch *
        randomBetween(0.992, 1.008);

      source.buffer = buffer;
      source.playbackRate.value = rate;

      const start = cursor;
      const duration = buffer.duration / rate;
      const end = start + duration;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(style.gain, start + 0.006);
      gain.gain.setValueAtTime(style.gain, Math.max(start + 0.01, end - 0.012));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      source.connect(gain);
      gain.connect(masterGain);
      source.start(start);
      source.stop(end + 0.02);

      cursor = end + randomBetween(style.gapMin, style.gapMax);
    }

    if (Math.random() < 0.45) {
      cursor += randomBetween(0.25, 0.65);
      cursor = scheduleNaturalEnding(cursor);
    }

    await waitUntil(cursor + 0.15);
  }

  function scheduleNaturalEnding(startTime) {
    const pools = [];

    if (vocabulary.pause?.breath?.length) {
      pools.push(vocabulary.pause.breath);
    }

    if (vocabulary.pause?.longbreath?.length && Math.random() < 0.25) {
      pools.push(vocabulary.pause.longbreath);
    }

    if (pools.length === 0) return startTime;

    const entry = randomChoice(randomChoice(pools));
    const buffer = buffers.get(entry.repositoryPath);

    if (!buffer) return startTime;

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();

    source.buffer = buffer;
    source.playbackRate.value = randomBetween(0.985, 1.015);
    gain.gain.value = 0.45;

    source.connect(gain);
    gain.connect(masterGain);
    source.start(startTime);

    return startTime + buffer.duration / source.playbackRate.value;
  }

  function performanceStyle(styleName) {
    const styles = {
      reflective: { gapMin: 0.14, gapMax: 0.29, pitch: 0.995, gain: 0.72 },
      measured:   { gapMin: 0.11, gapMax: 0.23, pitch: 1.000, gain: 0.72 },
      solemn:     { gapMin: 0.17, gapMax: 0.34, pitch: 0.985, gain: 0.70 },
      dreamlike:  { gapMin: 0.16, gapMax: 0.36, pitch: 1.008, gain: 0.66 },
      hesitant:   { gapMin: 0.20, gapMax: 0.46, pitch: 0.995, gain: 0.66 },
      odd:        { gapMin: 0.09, gapMax: 0.28, pitch: 1.012, gain: 0.72 }
    };

    return styles[styleName] || styles.reflective;
  }

  // ------------------------------------------------------------
  // SMALL HELPERS
  // ------------------------------------------------------------

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

  function displayWords(items) {
    return items
      .filter(item => item.type !== "pause")
      .map(item => item.word)
      .join(" ");
  }

  function punctuate(text) {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
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

    return lines.join("\\n");
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

  function waitUntil(targetTime) {
    const milliseconds =
      Math.max(0, targetTime - audioContext.currentTime) * 1000;

    return new Promise(resolve => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  window.deepThoughs = {
    vocabulary,
    buffers,
    buildThought
  };
})();
