const STORAGE_KEYS = {
  focusMinutes: "focus-sprint.focus-minutes",
  breakMinutes: "focus-sprint.break-minutes",
  sessionCount: "focus-sprint.session-count",
};

const DEFAULTS = {
  focusMinutes: 25,
  breakMinutes: 5,
};

const timerCard = document.querySelector(".timer-card");
const timerDisplay = document.querySelector("#timer");
const modeBadge = document.querySelector("#mode-badge");
const statusMessage = document.querySelector("#status");
const startPauseButton = document.querySelector("#start-pause");
const resetTimerButton = document.querySelector("#reset-timer");
const sessionCountDisplay = document.querySelector("#session-count");
const resetCountButton = document.querySelector("#reset-count");
const settingsForm = document.querySelector("#settings-form");
const focusMinutesInput = document.querySelector("#focus-minutes");
const breakMinutesInput = document.querySelector("#break-minutes");
const formMessage = document.querySelector("#form-message");

let durations = {
  focus: readPositiveInteger(STORAGE_KEYS.focusMinutes, DEFAULTS.focusMinutes),
  break: readPositiveInteger(STORAGE_KEYS.breakMinutes, DEFAULTS.breakMinutes),
};
let sessionCount = readNonNegativeInteger(STORAGE_KEYS.sessionCount, 0);
let mode = "focus";
let remainingSeconds = durations.focus * 60;
let isRunning = false;
let intervalId = null;
let targetTime = null;
let audioContext = null;

function readPositiveInteger(key, fallback) {
  const value = Number.parseInt(localStorage.getItem(key), 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function readNonNegativeInteger(key, fallback) {
  const value = Number.parseInt(localStorage.getItem(key), 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderTimer() {
  const formattedTime = formatTime(remainingSeconds);
  timerDisplay.textContent = formattedTime;
  timerDisplay.setAttribute(
    "aria-label",
    `${Math.floor(remainingSeconds / 60)} minutes and ${remainingSeconds % 60} seconds remaining`,
  );
  document.title = `${formattedTime} · ${mode === "focus" ? "Focus" : "Break"} · Focus Sprint`;
}

function renderMode() {
  const isFocus = mode === "focus";
  modeBadge.textContent = isFocus ? "Focus time" : "Break time";
  timerCard.classList.toggle("is-break", !isFocus);
}

function renderSessionCount() {
  sessionCountDisplay.textContent = sessionCount;
}

function updateTimer() {
  const secondsLeft = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
  if (secondsLeft === remainingSeconds) return;

  remainingSeconds = secondsLeft;
  renderTimer();

  if (remainingSeconds === 0) finishTimer();
}

function startTimer() {
  prepareAudio();
  if (remainingSeconds === 0) resetTimer();
  isRunning = true;
  targetTime = Date.now() + remainingSeconds * 1000;
  intervalId = window.setInterval(updateTimer, 250);
  startPauseButton.textContent = "Pause";
  statusMessage.textContent = mode === "focus" ? "You’ve got this." : "Take a breather.";
}

function pauseTimer() {
  window.clearInterval(intervalId);
  intervalId = null;
  updateTimer();
  isRunning = false;
  startPauseButton.textContent = "Resume";
  statusMessage.textContent = "Paused.";
}

function resetTimer() {
  window.clearInterval(intervalId);
  intervalId = null;
  isRunning = false;
  targetTime = null;
  remainingSeconds = durations[mode] * 60;
  startPauseButton.textContent = "Start";
  statusMessage.textContent = "Ready when you are.";
  renderTimer();
}

function finishTimer() {
  window.clearInterval(intervalId);
  intervalId = null;
  isRunning = false;

  const completedMode = mode;
  if (completedMode === "focus") {
    sessionCount += 1;
    localStorage.setItem(STORAGE_KEYS.sessionCount, sessionCount);
    renderSessionCount();
  }

  playCompletionTone();
  timerCard.classList.remove("is-complete");
  void timerCard.offsetWidth;
  timerCard.classList.add("is-complete");

  mode = completedMode === "focus" ? "break" : "focus";
  remainingSeconds = durations[mode] * 60;
  startPauseButton.textContent = "Start";
  statusMessage.textContent = completedMode === "focus"
    ? "Focus complete! Your break is ready."
    : "Break complete! Your next sprint is ready.";
  renderMode();
  renderTimer();
}

function playCompletionTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioContext ||= new AudioContext();
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startAt = audioContext.currentTime + index * 0.14;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.23);
  });

}

function prepareAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
}

function parseDuration(input) {
  const value = Number(input.value);
  const isValid = Number.isSafeInteger(value) && value > 0;
  input.setAttribute("aria-invalid", String(!isValid));
  return isValid ? value : null;
}

startPauseButton.addEventListener("click", () => {
  if (isRunning) pauseTimer();
  else startTimer();
});

resetTimerButton.addEventListener("click", resetTimer);

resetCountButton.addEventListener("click", () => {
  sessionCount = 0;
  localStorage.setItem(STORAGE_KEYS.sessionCount, sessionCount);
  renderSessionCount();
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const focusMinutes = parseDuration(focusMinutesInput);
  const breakMinutes = parseDuration(breakMinutesInput);

  if (focusMinutes === null || breakMinutes === null) {
    formMessage.textContent = "Enter positive whole minutes for both durations.";
    return;
  }

  durations = { focus: focusMinutes, break: breakMinutes };
  localStorage.setItem(STORAGE_KEYS.focusMinutes, focusMinutes);
  localStorage.setItem(STORAGE_KEYS.breakMinutes, breakMinutes);
  formMessage.textContent = "Durations saved.";
  resetTimer();
});

[focusMinutesInput, breakMinutesInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    formMessage.textContent = "";
  });
});

focusMinutesInput.value = durations.focus;
breakMinutesInput.value = durations.break;
renderMode();
renderTimer();
renderSessionCount();
