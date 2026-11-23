// ===== أدوات مساعدة =====
const toastEl = document.getElementById('toast');
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2600);
}

// ===== 1. المؤقت الدقيق + الإحصائيات + الصوت =====
const timeLeftEl = document.getElementById('timeLeft');
const sessionStatusEl = document.getElementById('sessionStatus');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const customMinutesInput = document.getElementById('customMinutes');
const applyCustomBtn = document.getElementById('applyCustomBtn');
const completedSessionsEl = document.getElementById('completedSessions');
const totalFocusMinutesEl = document.getElementById('totalFocusMinutes');
const resetStatsBtn = document.getElementById('resetStatsBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const progressCircle = document.getElementById('progressCircle');

const radius = progressCircle.r.baseVal.value;
const circumference = 2 * Math.PI * radius;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = 0;

let totalSeconds = 25 * 60;
let remainingSeconds = totalSeconds;
let endTime = null;
let timerInterval = null;
let isRunning = false;
let currentMode = 'focus';
let currentSessionDurationMins = 25;

let soundEnabled = localStorage.getItem('focus_sound') !== 'false';
soundToggleBtn.textContent = soundEnabled ? '🔔' : '🔕';

let completedSessions = Number(localStorage.getItem('focus_sessions')) || 0;
let totalFocusMinutes = Number(localStorage.getItem('focus_total_mins')) || 0;

function updateStatsUI() {
  completedSessionsEl.textContent = completedSessions;
  totalFocusMinutesEl.textContent = totalFocusMinutes;
}
updateStatsUI();

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('focus_sound', soundEnabled);
  soundToggleBtn.textContent = soundEnabled ? '🔔' : '🔕';
  showToast(soundEnabled ? 'تم تفعيل صوت التنبيه' : 'تم كتم صوت التنبيه');
});

resetStatsBtn.addEventListener('click', () => {
  completedSessions = 0;
  totalFocusMinutes = 0;
  localStorage.setItem('focus_sessions', 0);
  localStorage.setItem('focus_total_mins', 0);
  updateStatsUI();
  showToast('تم تصفير الإحصائيات');
});

function setProgress(percent) {
  const offset = circumference - (percent / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;
}

function updateTimerUI() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  timeLeftEl.textContent = formatted;
  document.title = `${formatted} - مساحة التركيز`;

  const percent = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;
  setProgress(percent);
}

function playNotificationSound() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // نغمة ثلاثية هادئة
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.16);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.16 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.16);
      osc.stop(ctx.currentTime + i * 0.16 + 0.45);
    });
  } catch (e) {}
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function handleSessionComplete() {
  clearInterval(timerInterval);
  isRunning = false;
  remainingSeconds = 0;
  updateTimerUI();
  startPauseBtn.textContent = 'ابدأ الجلسة';
  sessionStatusEl.textContent = 'انتهت الجلسة!';
  playNotificationSound();

  if (currentMode === 'focus') {
    completedSessions++;
    totalFocusMinutes += currentSessionDurationMins;
    localStorage.setItem('focus_sessions', completedSessions);
    localStorage.setItem('focus_total_mins', totalFocusMinutes);
    updateStatsUI();

    // زيادة عداد الجلسات للمهمة المحددة حالياً
    if (selectedTaskId) {
      const target = tasks.find((t) => t.id === selectedTaskId);
      if (target) {
        target.pomodoros = (target.pomodoros || 0) + 1;
        saveTasks();
      }
    }

    sendBrowserNotification('انتهت جلسة التركيز! 🎯', 'عاش! تقدر تاخد راحة قصيرة دلوقتي.');
    showToast('عاش! تم تسجيل جلسة تركيز مكتملة');
  } else {
    sendBrowserNotification('انتهت فترة الراحة ⏱️', 'جاهز لجلسة تركيز جديدة؟');
    showToast('انتهت فترة الراحة!');
  }
}

function startTimer() {
  if (isRunning) return;

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  if (remainingSeconds <= 0) {
    remainingSeconds = totalSeconds;
  }

  isRunning = true;
  endTime = Date.now() + remainingSeconds * 1000;
  startPauseBtn.textContent = 'إيقاف مؤقت';
  sessionStatusEl.textContent = currentMode === 'focus' ? 'وقت التركيز الآن...' : 'استمتع براحتك...';

  timerInterval = setInterval(() => {
    const diff = Math.round((endTime - Date.now()) / 1000);
    if (diff > 0) {
      remainingSeconds = diff;
      updateTimerUI();
    } else {
      handleSessionComplete();
    }
  }, 250);
}

function pauseTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  startPauseBtn.textContent = 'استكمال';
  sessionStatusEl.textContent = 'متوقف مؤقتاً';
}

function resetTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  remainingSeconds = totalSeconds;
  startPauseBtn.textContent = 'ابدأ الجلسة';
  sessionStatusEl.textContent = 'جاهز للبدء';
  updateTimerUI();
}

startPauseBtn.addEventListener('click', () => {
  if (isRunning) pauseTimer();
  else startTimer();
});

resetBtn.addEventListener('click', resetTimer);

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    const mins = Number(btn.dataset.minutes);
    currentSessionDurationMins = mins;
    totalSeconds = mins * 60;
    resetTimer();
  });
});

applyCustomBtn.addEventListener('click', () => {
  const mins = Math.max(1, Math.min(180, Number(customMinutesInput.value) || 25));
  customMinutesInput.value = mins;
  currentSessionDurationMins = mins;
  totalSeconds = mins * 60;
  resetTimer();
  showToast(`تم ضبط الوقت على ${mins} دقيقة`);
});

// اختصارات لوحة المفاتيح الذكية
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (isRunning) pauseTimer();
    else startTimer();
  } else if (e.key.toLowerCase() === 'r') {
    resetTimer();
  }
});

// ===== 2. أصوات التركيز الخلفية (Web Audio API) =====
const ambientBtns = document.querySelectorAll('.ambient-btn');
const ambientVolume = document.getElementById('ambientVolume');
const ambientStatus = document.getElementById('ambientStatus');

let ambientCtx = null;
let ambientSource = null;
let ambientGain = null;

function stopAmbientSound() {
  if (ambientSource) {
    try {
      ambientSource.stop();
      ambientSource.disconnect();
    } catch (e) {}
    ambientSource = null;
  }
  ambientStatus.textContent = 'متوقف';
  ambientStatus.classList.add('muted');
  ambientBtns.forEach((b) => b.classList.remove('active'));
}

function playAmbientSound(type) {
  stopAmbientSound();
  if (type === 'off') return;

  ambientCtx = ambientCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (ambientCtx.state === 'suspended') ambientCtx.resume();

  const bufferSize = 2 * ambientCtx.sampleRate;
  const noiseBuffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      output[i] = white * 0.35;
    } else if (type === 'brown') {
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.5;
    } else if (type === 'rain') {
      // مزيج من الضوضاء الناعمة لمحاكاة صوت المطر
      output[i] = (lastOut + 0.06 * white) / 1.06;
      lastOut = output[i];
      output[i] *= 1.4;
    }
  }

  ambientSource = ambientCtx.createBufferSource();
  ambientSource.buffer = noiseBuffer;
  ambientSource.loop = true;

  const filter = ambientCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = type === 'rain' ? 950 : type === 'brown' ? 320 : 2500;

  ambientGain = ambientCtx.createGain();
  ambientGain.gain.value = Number(ambientVolume.value);

  ambientSource.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(ambientCtx.destination);
  ambientSource.start();

  const labels = { rain: 'مطر هادئ', brown: 'ضوضاء دافئة', white: 'ضوضاء بيضاء' };
  ambientStatus.textContent = labels[type];
  ambientStatus.classList.remove('muted');
}

ambientBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.sound;
    playAmbientSound(type);
    if (type !== 'off') btn.classList.add('active');
  });
});

ambientVolume.addEventListener('input', () => {
  if (ambientGain) {
    ambientGain.gain.value = Number(ambientVolume.value);
  }
});

// ===== 3. إدارة المهام وربطها بالجلسة =====
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const tasksCounter = document.getElementById('tasksCounter');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const activeTaskTitle = document.getElementById('activeTaskTitle');

let tasks = JSON.parse(localStorage.getItem('focus_tasks')) || [];
let selectedTaskId = Number(localStorage.getItem('focus_selected_task')) || null;

function updateActiveTaskBanner() {
  const task = tasks.find((t) => t.id === selectedTaskId);
  if (task) {
    activeTaskTitle.textContent = task.text;
  } else {
    selectedTaskId = null;
    localStorage.removeItem('focus_selected_task');
    activeTaskTitle.textContent = 'لم يتم تحديد مهمة';
  }
}

function saveTasks() {
  localStorage.setItem('focus_tasks', JSON.stringify(tasks));
  renderTasks();
  updateActiveTaskBanner();
}

function renderTasks() {
  taskList.innerHTML = '';
  const completedCount = tasks.filter((t) => t.completed).length;
  tasksCounter.textContent = `${completedCount} / ${tasks.length}`;

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === selectedTaskId ? 'selected-task' : ''}`;

    li.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      selectedTaskId = selectedTaskId === task.id ? null : task.id;
      localStorage.setItem('focus_selected_task', selectedTaskId || '');
      renderTasks();
      updateActiveTaskBanner();
    });

    const left = document.createElement('div');
    left.className = 'task-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;
      saveTasks();
    });

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;

    left.appendChild(checkbox);
    left.appendChild(span);

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const pomoBadge = document.createElement('span');
    pomoBadge.className = 'pomo-count';
    pomoBadge.title = 'عدد الجلسات المكتملة لهذه المهمة';
    pomoBadge.textContent = `${task.pomodoros || 0} جلسة`;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-task';
    delBtn.textContent = '✕';
    delBtn.title = 'حذف المهمة';
    delBtn.addEventListener('click', () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      if (selectedTaskId === task.id) selectedTaskId = null;
      saveTasks();
    });

    meta.appendChild(pomoBadge);
    meta.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(meta);
    taskList.appendChild(li);
  });
}

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  const newTask = { id: Date.now(), text, completed: false, pomodoros: 0 };
  tasks.unshift(newTask);
  if (!selectedTaskId) {
    selectedTaskId = newTask.id;
    localStorage.setItem('focus_selected_task', selectedTaskId);
  }
  taskInput.value = '';
  saveTasks();
});

clearCompletedBtn.addEventListener('click', () => {
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
});

// ===== 4. بطاقات المراجعة السريعة (Flashcards) =====
const flashcardBox = document.getElementById('flashcardBox');
const cardQuestion = document.getElementById('cardQuestion');
const cardAnswer = document.getElementById('cardAnswer');
const cardCounter = document.getElementById('cardCounter');
const prevCardBtn = document.getElementById('prevCardBtn');
const flipCardBtn = document.getElementById('flipCardBtn');
const nextCardBtn = document.getElementById('nextCardBtn');
const deleteCardBtn = document.getElementById('deleteCardBtn');
const flashcardForm = document.getElementById('flashcardForm');
const questionInput = document.getElementById('questionInput');
const answerInput = document.getElementById('answerInput');

let flashcards = JSON.parse(localStorage.getItem('focus_flashcards')) || [
  { q: 'ما هي تقنية بومودورو (Pomodoro)؟', a: 'تقسيم وقت العمل إلى 25 دقيقة تركيز كامل يليها 5 دقائق راحة.' }
];
let currentCardIndex = 0;

function renderFlashcards() {
  flashcardBox.classList.remove('flipped');
  if (flashcards.length === 0) {
    cardCounter.textContent = '0 / 0';
    cardQuestion.textContent = 'لا توجد بطاقات بعد. أضف أول بطاقة بالأسفل!';
    cardAnswer.textContent = 'أضف سؤالاً وجواباً للمراجعة السريعة';
    return;
  }

  if (currentCardIndex >= flashcards.length) currentCardIndex = flashcards.length - 1;
  if (currentCardIndex < 0) currentCardIndex = 0;

  const current = flashcards[currentCardIndex];
  cardCounter.textContent = `${currentCardIndex + 1} / ${flashcards.length}`;
  cardQuestion.textContent = current.q;
  cardAnswer.textContent = current.a;
}

function saveFlashcards() {
  localStorage.setItem('focus_flashcards', JSON.stringify(flashcards));
  renderFlashcards();
}

flashcardBox.addEventListener('click', () => {
  if (flashcards.length === 0) return;
  flashcardBox.classList.toggle('flipped');
});

flipCardBtn.addEventListener('click', () => {
  if (flashcards.length === 0) return;
  flashcardBox.classList.toggle('flipped');
});

prevCardBtn.addEventListener('click', () => {
  if (flashcards.length === 0) return;
  currentCardIndex = (currentCardIndex - 1 + flashcards.length) % flashcards.length;
  renderFlashcards();
});

nextCardBtn.addEventListener('click', () => {
  if (flashcards.length === 0) return;
  currentCardIndex = (currentCardIndex + 1) % flashcards.length;
  renderFlashcards();
});

deleteCardBtn.addEventListener('click', () => {
  if (flashcards.length === 0) return;
  flashcards.splice(currentCardIndex, 1);
  saveFlashcards();
  showToast('تم حذف البطاقة');
});

flashcardForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = questionInput.value.trim();
  const a = answerInput.value.trim();
  if (!q || !a) return;
  flashcards.push({ q, a });
  currentCardIndex = flashcards.length - 1;
  questionInput.value = '';
  answerInput.value = '';
  saveFlashcards();
  showToast('تمت إضافة بطاقة مراجعة جديدة');
});

// ===== 5. المفكرة السريعة + النسخ والتصدير =====
const quickNotes = document.getElementById('quickNotes');
const charCount = document.getElementById('charCount');
const saveIndicator = document.getElementById('saveIndicator');
const clearNotesBtn = document.getElementById('clearNotesBtn');
const copyNotesBtn = document.getElementById('copyNotesBtn');
const downloadNotesBtn = document.getElementById('downloadNotesBtn');

quickNotes.value = localStorage.getItem('focus_notes') || '';
charCount.textContent = `${quickNotes.value.length} حرف`;

quickNotes.addEventListener('input', () => {
  localStorage.setItem('focus_notes', quickNotes.value);
  charCount.textContent = `${quickNotes.value.length} حرف`;
  saveIndicator.textContent = 'جاري الحفظ...';
  clearTimeout(window.noteSaveTimer);
  window.noteSaveTimer = setTimeout(() => {
    saveIndicator.textContent = 'محفوظ تلقائياً';
  }, 450);
});

copyNotesBtn.addEventListener('click', async () => {
  if (!quickNotes.value.trim()) {
    showToast('المفكرة فارغة!');
    return;
  }
  await navigator.clipboard.writeText(quickNotes.value);
  showToast('تم نسخ الملاحظات للحافظة');
});

downloadNotesBtn.addEventListener('click', () => {
  if (!quickNotes.value.trim()) {
    showToast('المفكرة فارغة!');
    return;
  }
  const blob = new Blob([quickNotes.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ملاحظات-التركيز-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('تم تحميل ملف الملاحظات');
});

clearNotesBtn.addEventListener('click', () => {
  if (!quickNotes.value) return;
  quickNotes.value = '';
  localStorage.removeItem('focus_notes');
  charCount.textContent = '0 حرف';
  showToast('تم مسح المفكرة');
});

// ===== 6. تبديل المظهر =====
const themeToggle = document.getElementById('themeToggle');
if (localStorage.getItem('focus_theme') === 'light') {
  document.body.classList.add('light-theme');
  themeToggle.textContent = '🌙';
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  themeToggle.textContent = isLight ? '🌙' : '☀️';
  localStorage.setItem('focus_theme', isLight ? 'light' : 'dark');
});

// تشغيل أولي
updateTimerUI();
renderTasks();
updateActiveTaskBanner();
renderFlashcards();