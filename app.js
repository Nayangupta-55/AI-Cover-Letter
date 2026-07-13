(() => {
  "use strict";

  const form            = document.getElementById("letterForm");
  const composeBtn      = document.getElementById("composeBtn");
  const modeSegmented    = document.getElementById("modeSegmented");
  const apiKeyField      = document.getElementById("apiKeyField");
  const apiKeyInput      = document.getElementById("apiKeyInput");

  const dropzone         = document.getElementById("dropzone");
  const resumeInput      = document.getElementById("resumeInput");
  const resumeStatus     = document.getElementById("resumeStatus");

  const paper             = document.getElementById("paper");
  const paperStatusText   = document.getElementById("paperStatusText");
  const paperBody         = document.getElementById("paperBody");
  const generatingState   = document.getElementById("generatingState");
  const generatingLabel   = document.getElementById("generatingLabel");
  const letterheadDate    = document.getElementById("todayDate");

  const copyBtn  = document.getElementById("copyBtn");
  const copyNote = document.getElementById("copyNote");

  const phaseTrack = document.getElementById("phaseTrack");

  const state = {
    mode: "simulate",     
    resumeText: "",        
    resumeFileName: "",
    lastLetterText: "",     
  };

  letterheadDate.textContent = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  function generateSimulatedLetter({ candidateName, jobRole, targetCompany, keySkills }) {
    const skillsList = keySkills
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const skillsSentence = skillsList.length
      ? skillsList.length === 1
        ? skillsList[0]
        : `${skillsList.slice(0, -1).join(", ")} and ${skillsList[skillsList.length - 1]}`
      : "a strong, adaptable skill set";

    return [
      `Dear Hiring Manager at ${targetCompany},`,
      ``,
      `I am ${candidateName}, and I am writing to express my interest in the ${jobRole} position at ${targetCompany}. Having followed the organization's work, I am confident that my background aligns closely with what this role requires.`,
      ``,
      `Over the course of my career I have developed hands-on expertise in ${skillsSentence}. I bring a practical, detail-oriented approach to every project, and I am energized by the opportunity to apply that experience to ${targetCompany}'s goals.`,
      ``,
      `I would welcome the chance to discuss how my skills in ${skillsList[0] || "this field"} and beyond can contribute to your team. Thank you for considering my application — I look forward to the possibility of speaking further.`,
      ``,
      `Sincerely,`,
      `${candidateName}`,
    ].join("\n");
  }

  
  function getApiKey() {
    const fromConfig = window.APP_CONFIG && window.APP_CONFIG.GEMINI_API_KEY;
    const fromField  = apiKeyInput.value.trim();
    return fromField || fromConfig || "";
  }

  const MODEL_FALLBACKS = ["gemini-flash-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

  function getModel() {
    return (window.APP_CONFIG && window.APP_CONFIG.GEMINI_MODEL) || MODEL_FALLBACKS[0];
  }

  function buildPrompt({ candidateName, jobRole, targetCompany, keySkills, jobDescription }) {
    const sections = [
      `You are an expert career writer. Write a polished, professional cover letter.`,
      `Return only the letter body in Markdown (short paragraphs, no headings, no placeholders in brackets).`,
      ``,
      `Candidate name: ${candidateName}`,
      `Target role: ${jobRole}`,
      `Target company: ${targetCompany}`,
      `Key skills: ${keySkills}`,
    ];

    if (jobDescription && jobDescription.trim()) {
      sections.push(``, `Job description:`, jobDescription.trim());
    }

    if (state.resumeText) {
      sections.push(
        ``,
        `Résumé excerpt (use relevant, concrete details from this — do not invent experience that isn't here):`,
        state.resumeText.slice(0, 6000)
      );
    }

    sections.push(
      ``,
      `Write 3-4 concise paragraphs, end with "Sincerely," followed by the candidate's name.`
    );

    return sections.join("\n");
  }

  async function callGemini(model, apiKey, formData) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const payload = {
      contents: [
        { role: "user", parts: [{ text: buildPrompt(formData) }] }
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.error?.message || `Gemini request failed (HTTP ${res.status}).`;
      const err = new Error(message);
      err.status = res.status;
      
      err.isModelUnavailable = res.status === 404 || /no longer available|not found/i.test(message);
      throw err;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "";
    if (!text) throw new Error("Gemini returned an empty response. Try again.");
    return text;
  }

  async function generateWithGemini(formData) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error(
        "No Gemini API key found. Paste one above, or add it to config.js (see config.example.js)."
      );
    }

    const primary = getModel();
    const candidates = [primary, ...MODEL_FALLBACKS.filter(m => m !== primary)];

    let lastError;
    for (const model of candidates) {
      try {
        return await callGemini(model, apiKey, formData);
      } catch (err) {
        lastError = err;
        if (!err.isModelUnavailable) throw err;
      }
    }
    throw lastError;
  }

  if (window["pdfjsLib"]) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  async function extractPdfText(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText.trim();
  }

  async function handleResumeFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      resumeStatus.textContent = "Only PDF files are supported.";
      return;
    }

    resumeStatus.textContent = `Reading ${file.name}…`;
    try {
      const text = await extractPdfText(file);
      state.resumeText = text;
      state.resumeFileName = file.name;
      dropzone.classList.add("is-filled");
      resumeStatus.textContent = `Attached: ${file.name} (${text.split(/\s+/).length} words extracted)`;
      if (state.mode === "ai") setActivePhase(3);
    } catch (err) {
      console.error(err);
      resumeStatus.textContent = "Couldn't read that PDF. Try another file.";
    }
  }

  dropzone.addEventListener("click", () => resumeInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); resumeInput.click(); }
  });
  resumeInput.addEventListener("change", (e) => handleResumeFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--brick)"; })
  );
  ["dragleave", "drop"].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.style.borderColor = ""; })
  );
  dropzone.addEventListener("drop", (e) => handleResumeFile(e.dataTransfer.files[0]));

  modeSegmented.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__opt");
    if (!btn) return;
    [...modeSegmented.children].forEach(c => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.mode = btn.dataset.mode;
    apiKeyField.hidden = state.mode !== "ai";
    setActivePhase(state.mode === "ai" ? (state.resumeText ? 3 : 2) : 1);
  });

  function setActivePhase(n) {
    [...phaseTrack.children].forEach(dot => {
      const active = Number(dot.dataset.phase) === n;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", String(active));
    });
  }
  phaseTrack.addEventListener("click", (e) => {
    const dot = e.target.closest(".phase-dot");
    if (!dot) return;
    const p = Number(dot.dataset.phase);
    if (p === 1) { state.mode = "simulate"; apiKeyField.hidden = true; toggleSegmented("simulate"); }
    else { state.mode = "ai"; apiKeyField.hidden = false; toggleSegmented("ai"); }
    setActivePhase(p);
  });
  function toggleSegmented(mode) {
    [...modeSegmented.children].forEach(c => c.classList.toggle("is-active", c.dataset.mode === mode));
  }

  function setPaperState(kind, label) {
    paper.dataset.state = kind; 
    paperStatusText.textContent = label;
  }

  function renderPlainLetter(text) {
    
    paperBody.innerHTML = "";
    text.split(/\n{2,}/).forEach(block => {
      const p = document.createElement("p");
      p.textContent = block;
      paperBody.appendChild(p);
    });
    state.lastLetterText = text;
    copyBtn.disabled = false;
  }

  function renderMarkdownLetter(markdown) {
    if (window.marked) {
      paperBody.innerHTML = marked.parse(markdown);
    } else {
      renderPlainLetter(markdown);
      return;
    }
    state.lastLetterText = paperBody.textContent.trim();
    copyBtn.disabled = false;
  }

  function renderError(message) {
    paperBody.innerHTML = `<p class="paper__placeholder">⚠ ${escapeHtml(message)}</p>`;
    copyBtn.disabled = true;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function readForm() {
    const fd = new FormData(form);
    return {
      candidateName: fd.get("candidateName").trim(),
      jobRole: fd.get("jobRole").trim(),
      targetCompany: fd.get("targetCompany").trim(),
      keySkills: fd.get("keySkills").trim(),
      jobDescription: fd.get("jobDescription").trim(),
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const data = readForm();

    composeBtn.disabled = true;
    composeBtn.classList.add("is-stamping");
    setTimeout(() => composeBtn.classList.remove("is-stamping"), 500);

    if (state.mode === "simulate") {
      setPaperState("done", "Simulated · Phase 01 template");
      generatingState.hidden = true;
      renderPlainLetter(generateSimulatedLetter(data));
      composeBtn.disabled = false;
      return;
    }

    const usingResume = Boolean(state.resumeText);
    setActivePhase(usingResume ? 3 : 2);
    setPaperState("generating", usingResume ? "Personalizing with résumé · Phase 03" : "Generating · Phase 02");
    generatingState.hidden = false;
    generatingLabel.textContent = usingResume
      ? "Reading your résumé and drafting…"
      : "Contacting Gemini…";
    paperBody.innerHTML = "";
    copyBtn.disabled = true;

    try {
      const markdown = await generateWithGemini(data);
      generatingState.hidden = true;
      setPaperState("done", usingResume ? "Personalized · Phase 03" : "AI‑generated · Phase 02");
      renderMarkdownLetter(markdown);
    } catch (err) {
      console.error(err);
      generatingState.hidden = true;
      setPaperState("error", "Couldn't generate — see message");
      renderError(err.message || "Something went wrong while contacting Gemini.");
    } finally {
      composeBtn.disabled = false;
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.lastLetterText);
      copyNote.textContent = "Copied ✓";
      setTimeout(() => (copyNote.textContent = ""), 2000);
    } catch {
      copyNote.textContent = "Copy failed — select the text manually.";
    }
  });

  window.addEventListener("load", () => {
    if (window.__CONFIG_MISSING__ && !window.APP_CONFIG) {
      console.info(
        "config.js not found — copy config.example.js to config.js and add your Gemini key, " +
        "or paste a key directly into the 'Gemini API key' field."
      );
    }
  });
})();
