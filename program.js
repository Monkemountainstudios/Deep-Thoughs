(() => {
  "use strict";

  // ------------------------------------------------------------
  // DEEP THOUGHS — PHASE 1
  // Vocabulary loader only.
  // ------------------------------------------------------------

  const REPOSITORY_OWNER = "Monkemountainstudios";
  const REPOSITORY_NAME = "Deep-Thoughs";
  const REPOSITORY_BRANCH = "main";
  const AUDIO_ROOT = "audio/";

  const TREE_API_URL =
    `https://api.github.com/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}` +
    `/git/trees/${REPOSITORY_BRANCH}?recursive=1`;

  const RAW_FILE_ROOT =
    `https://raw.githubusercontent.com/${REPOSITORY_OWNER}/` +
    `${REPOSITORY_NAME}/${REPOSITORY_BRANCH}/`;

  const loadButton = document.querySelector("#loadButton");
  const statusText = document.querySelector("#statusText");
  const reportText = document.querySelector("#reportText");
  const lamp = document.querySelector("#lamp");

  const vocabulary = {};

  loadButton.addEventListener("click", loadVocabulary);

  async function loadVocabulary() {
    setLoadingState();

    try {
      const repositoryTree = await fetchRepositoryTree();
      const audioFiles = findAudioFiles(repositoryTree);
      buildVocabulary(audioFiles);

      reportText.textContent = makeVocabularyReport(vocabulary, audioFiles.length);
      setReadyState(audioFiles.length);
      console.log("Deep Thoughs vocabulary:", vocabulary);
    } catch (error) {
      console.error("Vocabulary loading failed:", error);
      setErrorState(error);
    }
  }

  async function fetchRepositoryTree() {
    const response = await fetch(TREE_API_URL, {
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
      throw new Error("GitHub truncated the repository tree. The library has become magnificently enormous.");
    }

    return data.tree;
  }

  function findAudioFiles(repositoryTree) {
    return repositoryTree
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
      const pathParts = relativePath.split("/");
      const fileName = pathParts.pop();
      const word = fileName.replace(/\.ogg$/i, "");

      const entry = {
        word,
        repositoryPath: file.path,
        audioUrl: RAW_FILE_ROOT + encodePath(file.path)
      };

      putEntryInCategory(vocabulary, pathParts, entry);
    }
  }

  function putEntryInCategory(rootObject, categoryPath, entry) {
    if (categoryPath.length === 0) {
      rootObject._uncategorized ??= [];
      rootObject._uncategorized.push(entry);
      return;
    }

    let currentLevel = rootObject;

    for (let index = 0; index < categoryPath.length; index += 1) {
      const category = categoryPath[index];
      const isFinalCategory = index === categoryPath.length - 1;

      if (isFinalCategory) {
        currentLevel[category] ??= [];
        currentLevel[category].push(entry);
      } else {
        currentLevel[category] ??= {};
        currentLevel = currentLevel[category];
      }
    }
  }

  function makeVocabularyReport(rootObject, totalFiles) {
    return [
      "VOCABULARY LOADED",
      "",
      ...countCategories(rootObject),
      "",
      `Total audio files: ${totalFiles}`
    ].join("\n");
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
    return path.split("/").map(part => encodeURIComponent(part)).join("/");
  }

  function clearObject(object) {
    for (const key of Object.keys(object)) delete object[key];
  }

  function setLoadingState() {
    loadButton.disabled = true;
    loadButton.textContent = "LOADING...";
    statusText.textContent = "READING THE ARCHIVE";
    reportText.textContent = "Asking GitHub what words exist...";
    lamp.classList.remove("active");
  }

  function setReadyState(totalFiles) {
    loadButton.disabled = false;
    loadButton.textContent = "RELOAD VOCABULARY";
    statusText.textContent = "VOCABULARY READY";
    reportText.textContent += `\n\nThe machine now knows ${totalFiles} recorded items.`;
    lamp.classList.add("active");
  }

  function setErrorState(error) {
    loadButton.disabled = false;
    loadButton.textContent = "TRY AGAIN";
    statusText.textContent = "LOAD FAILED";
    reportText.textContent =
      "The archive resisted inspection.\n\n" +
      `${error.message}\n\n` +
      "Open the browser console for further muttering.";
    lamp.classList.remove("active");
  }

  window.deepThoughs = { vocabulary, loadVocabulary };
})();
