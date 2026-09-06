import songs from './data/songs.js';
import checkIcon from './assets/elements/check.svg';
import trashIcon from './assets/elements/trash.svg';

// Pre-compiled chord detection patterns for optimal performance
const CHORD_UNIT_SOURCE = '[(]?[A-G][b#]?(?:m|M|maj|min|dim|aug|sus|add|alt|[2-9]|11|13|\\+|M|F)*(?:\\([#b0-9a-zA-Z\\+\\-]*\\))?(?:\\/(?:[A-G][b#]?|[0-9]+)(?:m|M|maj|min|dim|aug|sus|add|alt|[2-9]|11|13|\\+|M|F)*(?:\\([#b0-9a-zA-Z\\+\\-]*\\))?)?[)]?';
const CHORD_PATTERN = new RegExp('^(' + CHORD_UNIT_SOURCE + ')+$');
const SPECIAL_TOKENS = new Set([
    '||:', ':||', '|', '...', '2X', '3X', '(2X)', '(3X)', 
    '[2X]', '[3X]', '[REFRÃO]', 'REFRÃO', '[INTRO]', 'INTRO',
    '[SOLO]', 'SOLO', '[FIM]', 'FIM', '[PONTE]', 'PONTE', '1ª', '2ª', 'VEZ', 'VEZES', 'VOLTA'
]);

// Pre-compiled regex patterns for punctuation and lyric markers
const PUNCTUATION_PATTERN = /^[.,\/#!$%\^&\*;:{}=\-_`~()]+|[.,\/#!$%\^&\*;:{}=\-_`~()]+$/g;
const MARKER_PATTERN = /\([23]x\)|\[refrão\]|\[[23]x\]/gi;

document.addEventListener('DOMContentLoaded', () => {
    // Menu elements
    const viewMenu = document.getElementById('view-menu');
    const viewList = document.getElementById('view-list');
    const viewSong = document.getElementById('view-song');
    
    // UI Elements
    const themeBtn = document.getElementById('theme-btn');
    const listSongsBtn = document.getElementById('list-songs-btn');
    const searchSongsBtn = document.getElementById('search-songs-btn');

    // List & Song Views
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const songBackBtn = document.getElementById('song-back-btn');
    const searchInput = document.getElementById('search-input');
    const songHeaderBar = document.querySelector('.song-header-bar');
    const listHeaderBar = document.querySelector('.list-header');
    const songsList = document.getElementById('songs-list');
    const songTitleEl = document.getElementById('song-title');
    const songAuthorEl = document.getElementById('song-author');
    const songContentEl = document.getElementById('song-content');
    const searchInputContainer = document.getElementById('search-input-container');
    const fabBackBtn = document.getElementById('fab-back-btn');
    const fabBackListBtn = document.getElementById('fab-back-list-btn');
    const listContentEl = document.querySelector('.list-content');


    // SVG Controls Mode
    const fontDecreaseSvg = document.getElementById('font-decrease-svg');
    const fontIncreaseSvg = document.getElementById('font-increase-svg');
    const toggleChordsSvgWrapper = document.getElementById('toggle-chords-svg-wrapper');
    
    // Initial Font Size (Always starts at 12px/0.75rem)
    let currentFontSize = 0.75;
    let currentSong = null;
    let chordsVisible = false;

    // Initialize Theme
    let currentTheme = localStorage.getItem('theme') || 'light';
    setThemeElements(currentTheme);

    function setThemeElements(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#121212' : '#f7f7f7');
        }

        const themeLabel = document.getElementById('theme-label');
        if (themeLabel) {
            themeLabel.innerText = theme === 'dark' ? 'TEMA ESCURO' : 'TEMA CLARO';
        }
    }

    // Apply persistent font size on startup
    songContentEl.style.fontSize = currentFontSize + 'rem';

    themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        setThemeElements(currentTheme);
    });

    // Process valid songs from songs.js
    const validSongs = songs.filter(s => s.title && (s.lyrics || s.chords) && s.title.trim().length > 1);
    validSongs.sort((a, b) => a.title.localeCompare(b.title));

    // Helper to remove accents for searching
    function removeAccents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // Pre-map songs list once to avoid repeated allocations on every search keystroke
    const preparedSongsList = validSongs.map((song, idx) => {
        const numStr = String(idx + 1).padStart(2, '0');
        const cleanTitle = song.title.toUpperCase();
        return { 
            numStr: numStr,
            originalText: `<span class="song-number">${numStr}.</span> ${cleanTitle}`, 
            hybridSongObj: { 
                title: cleanTitle, 
                author: song.author, 
                lyrics: song.lyrics, 
                chords: song.chords
            },
            originalIndex: idx,
            normalizedTitle: removeAccents(cleanTitle.toLowerCase())
        };
    });

    // Render List
    function renderSongs(filter = '') {
        songsList.innerHTML = '';
        const searchWord = removeAccents(filter.toLowerCase().trim());

        if (searchWord === '') {
            // Render all in standard numerical sequence
            preparedSongsList.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'song-item';
                li.innerHTML = item.originalText;
                li.addEventListener('click', () => openSong(item.hybridSongObj));
                songsList.appendChild(li);
            });
            updateFabBackListBtnVisibility();
            return;
        }

        // Filter and score for search accuracy
        let titleMatches = [];

        preparedSongsList.forEach((item) => {
            const normalizedTitle = item.normalizedTitle;
            
            let score = 0;
            const isNumberSearch = /^\d+$/.test(searchWord);

            if (isNumberSearch) {
                if (item.numStr.includes(searchWord)) {
                    score = 200; // Ordem exata: ex. "21" -> "21"
                } else {
                    // Ordem independente: ex. "21" -> "12" (contém 1 e 2)
                    const searchDigits = searchWord.split('');
                    const hasAllDigits = searchDigits.every(d => item.numStr.includes(d));
                    if (hasAllDigits) score = 150;
                }
            }

            if (score >= 150) {
                titleMatches.push({ item, score });
            } else if (normalizedTitle === searchWord) {
                score = 100; // Exact match
                titleMatches.push({ item, score });
            } else if (normalizedTitle.startsWith(searchWord)) {
                score = 50; // Starts with
                titleMatches.push({ item, score });
            } else if (normalizedTitle.includes(searchWord)) {
                score = 20; // Title contains
                titleMatches.push({ item, score });
            }
        });

        // Sort dynamically: highest score first. If tied, sort by original sequence
        titleMatches.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.item.originalIndex - b.item.originalIndex;
        });

        titleMatches.forEach((match) => {
            const li = document.createElement('li');
            li.className = 'song-item';
            li.innerHTML = match.item.originalText;
            li.addEventListener('click', () => openSong(match.item.hybridSongObj));
            songsList.appendChild(li);
        });
        updateFabBackListBtnVisibility();
    }

    // Is it a chord line?
    function isChordLine(line) {
        const words = line.trim().split(/\s+/);
        if (words.length === 0 || line.trim() === '') return false;
        
        let chordCount = 0;
        let specialCount = 0;
        
        words.forEach(w => {
            const cleanW = w.replace(PUNCTUATION_PATTERN, "");
            if (CHORD_PATTERN.test(w) || CHORD_PATTERN.test(cleanW)) {
                chordCount++;
            } else if (SPECIAL_TOKENS.has(w.toUpperCase()) || SPECIAL_TOKENS.has(cleanW.toUpperCase())) {
                specialCount++;
            }
        });
        
        const totalConsidered = chordCount + specialCount;
        return (words.length > 0 && (totalConsidered / words.length) > 0.6);
    }

    // Process Lyrics to highlight chords and specific markers
    function processLyrics(text, isChordsSource) {
        const lines = text.split('\n');
        let processedLines = [];
        let lastWasEmpty = true; // start as true to skip leading empty lines

        lines.forEach((line) => {
            const isChord = isChordsSource && isChordLine(line);
            
            if (isChord) {
                const words = line.trim().split(/\s+/);
                
                let hasActualChords = false;
                words.forEach(w => {
                    const cleanW = w.replace(PUNCTUATION_PATTERN, "");
                    if (CHORD_PATTERN.test(w) || CHORD_PATTERN.test(cleanW)) {
                        hasActualChords = true;
                    }
                });

                const processedLine = line.replace(MARKER_PATTERN, '<span class="lyric-marker">$&</span>');
                if (hasActualChords) {
                    processedLines.push(`<span class="chord-line chord">${processedLine}</span>`);
                } else {
                    processedLines.push(`<span class="marker-line">${processedLine}</span>`);
                }
                lastWasEmpty = false;
            } else {
                const trimmedLine = line.trim();
                if (trimmedLine === '') {
                    if (!lastWasEmpty) {
                        processedLines.push(isChordsSource ? '<span class="empty-line"></span>' : '');
                        lastWasEmpty = true;
                    }
                } else {
                    const processedLine = trimmedLine.replace(MARKER_PATTERN, '<span class="lyric-marker">$&</span>');
                    processedLines.push(isChordsSource ? `<span class="lyric-line">${processedLine}</span>` : processedLine);
                    lastWasEmpty = false;
                }
            }
        });

        // Trim any trailing empty lines in processedLines
        while (processedLines.length > 0 && (processedLines[processedLines.length - 1] === '' || processedLines[processedLines.length - 1] === '<span class="empty-line"></span>')) {
            processedLines.pop();
        }

        return isChordsSource ? processedLines.join('') : processedLines.join('\n');
    }

    // Ensure titles fit in a single line by dynamically reducing font-size
    function fitTitleText() {
        if (!viewSong.classList.contains('active')) return;

        const titleEl = songTitleEl;
        const parent = titleEl.parentElement;
        
        // Measure real parent width avoiding 0 cases caused by DOM timings
        setTimeout(() => {
            const parentWidth = parent.clientWidth;
            
            // If it's 0, elements aren't painted yet. We queue again and wait.
            if (parentWidth === 0) {
                requestAnimationFrame(fitTitleText);
                return;
            }

            // Set base size matching CSS rules
            const baseSize = 0.95; 
            titleEl.style.fontSize = baseSize + 'rem';
            
            // Create a temporary unconstrained clone to measure raw text width without ellipsis clipping
            const clone = titleEl.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.visibility = 'hidden';
            clone.style.width = 'auto'; // allow it to stretch past boundaries natively
            clone.style.whiteSpace = 'nowrap';
            clone.style.fontSize = baseSize + 'rem';
            clone.style.textOverflow = 'clip';
            document.body.appendChild(clone);
            
            const textWidth = clone.clientWidth;
            
            if (textWidth > parentWidth) {
                // Calculate ratio (margin of 98% to avoid touching edges)
                const ratio = (parentWidth * 0.98) / textWidth;
                let newSize = baseSize * ratio;
                
                // Limit how small it can get
                if (newSize < 0.65) newSize = 0.65;
                
                titleEl.style.fontSize = newSize.toFixed(2) + 'rem';
            }
            
            document.body.removeChild(clone);
        }, 10); // Guarantee initial flexbox constraints are laid out
    }

    let isSongScrollable = false;
    let maxScrollVal = 0;

    // Toggle bottom back button visibility based on whether the song page is scrollable
    function updateFabBackBtnVisibility() {
        if (!viewSong.classList.contains('active')) return;
        requestAnimationFrame(() => {
            // Get viewport height
            const windowHeight = window.innerHeight;
            
            // Get bounding client rects to calculate the pure content height
            const songContentRect = songContentEl.getBoundingClientRect();
            const viewSongRect = viewSong.getBoundingClientRect();
            
            // Get bottom padding dynamically
            const viewSongStyle = window.getComputedStyle(viewSong);
            const paddingBottom = parseFloat(viewSongStyle.paddingBottom) || 20;
            
            // Calculate content height (excluding the back button itself)
            const contentHeight = (songContentRect.bottom - viewSongRect.top) + paddingBottom;
            
            // If content overflows the viewport, it is scrollable
            isSongScrollable = contentHeight > (windowHeight + 5);
                  if (isSongScrollable) {
                fabBackBtn.classList.add('visible');
                document.body.classList.remove('no-scroll');
                // Calculate maxScrollVal taking into account the space the button now occupies
                const newScrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                maxScrollVal = newScrollHeight - windowHeight;
                updateFadeInState();
            } else {
                fabBackBtn.classList.remove('visible');
                fabBackBtn.classList.remove('fade-in');
                document.body.classList.add('no-scroll');
                maxScrollVal = 0;
            }
        });
    }


    // Update bottom arrow opacity and transform transition dynamically on scroll
    function updateFadeInState() {
        if (!isSongScrollable || !viewSong.classList.contains('active')) return;
        const currentScroll = window.scrollY;
        const triggerStart = maxScrollVal - 120; // Starts fading in 120px before the bottom
        
        if (currentScroll >= triggerStart) {
            fabBackBtn.classList.add('fade-in');
        } else {
            fabBackBtn.classList.remove('fade-in');
        }
    }

    let isListScrollable = false;
    let maxListScrollVal = 0;

    // Toggle bottom back button visibility based on whether the list page is scrollable
    function updateFabBackListBtnVisibility() {
        if (!viewList.classList.contains('active')) return;
        requestAnimationFrame(() => {
            const windowHeight = window.innerHeight;
            const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
            
            isListScrollable = documentHeight > windowHeight + 5;
            
            if (isListScrollable) {
                fabBackListBtn.classList.add('visible');
                // Calculate maxListScrollVal taking into account the space the button now occupies
                const newScrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                maxListScrollVal = newScrollHeight - windowHeight;
                updateListFadeInState();
            } else {
                fabBackListBtn.classList.remove('visible');
                fabBackListBtn.classList.remove('fade-in');
                maxListScrollVal = 0;
            }
        });
    }

    // Update bottom arrow opacity and transform transition dynamically on list scroll
    function updateListFadeInState() {
        if (!isListScrollable || !viewList.classList.contains('active')) return;
        const currentScroll = window.scrollY;
        const triggerStart = maxListScrollVal - 120; // Starts fading in 120px before the bottom
        
        if (currentScroll >= triggerStart) {
            fabBackListBtn.classList.add('fade-in');
        } else {
            fabBackListBtn.classList.remove('fade-in');
        }
    }

    // Open single song
    function openSong(song) {
        if(!song) return; // safeguard
        currentSong = song;
        searchInput.blur();
        
        // Reset to minimum font size (12px / 0.75rem)
        currentFontSize = 0.75;
        songContentEl.style.fontSize = currentFontSize + 'rem';
        
        songTitleEl.innerText = song.title; // Montserrat natively renders accents without HTML injection
        
        if (song.author) {
            songAuthorEl.innerText = song.author;
            songAuthorEl.style.display = 'block';
        } else {
            songAuthorEl.style.display = 'none';
        }

        const content = (chordsVisible ? song.chords : song.lyrics) || '';
        songContentEl.innerHTML = processLyrics(content, chordsVisible); // Montserrat natively renders accents
        
        viewMenu.classList.remove('active');
        viewMenu.classList.add('hidden');
        viewList.classList.remove('active');
        viewList.classList.add('hidden');
        viewSong.classList.remove('hidden');
        viewSong.classList.add('active');
        document.body.classList.remove('menu-active');
        window.scrollTo(0, 0);
        // Agendamento da re-checagem de tamanho (permite tempo pra renderização sair de display: none)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fitTitleText();
                updateFabBackBtnVisibility();
            });
        });
    }

    function resetChordsVisibility() {
        chordsVisible = false;
        if (toggleChordsSvgWrapper) {
            toggleChordsSvgWrapper.classList.remove('chords-active');
            toggleChordsSvgWrapper.classList.add('chords-inactive');
        }
        songContentEl.classList.add('no-chords');
    }

    // Back to Menu
    function goBackToMenu() {
        resetChordsVisibility();
        searchInput.blur();
        clearSearch();
        shouldClearOnNextFocus = true;
        document.body.classList.add('menu-active');
        document.body.classList.remove('no-scroll');
        document.querySelectorAll('.neon-active').forEach(el => el.classList.remove('neon-active'));
        viewSong.classList.remove('active');
        viewSong.classList.add('hidden');
        viewList.classList.remove('active');
        viewList.classList.add('hidden');
        viewMenu.classList.remove('hidden');
        viewMenu.classList.add('active');
    }

    // View Lists Route
    listSongsBtn.addEventListener('click', () => {
        document.body.classList.remove('menu-active');
        viewList.classList.remove('search-centered');
        viewList.classList.add('search-hidden');
        searchInputContainer.style.display = 'none'; // hide search input when just listing all
        clearSearch();
        shouldClearOnNextFocus = true;
        viewMenu.classList.remove('active');
        viewMenu.classList.add('hidden');
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
        if (listHeaderBar) listHeaderBar.classList.remove('header-hidden');

        window.scrollTo(0, 0);
        renderSongs();
    });

    searchSongsBtn.addEventListener('click', () => {
        document.body.classList.remove('menu-active');
        viewList.classList.remove('search-hidden');
        searchInputContainer.style.display = 'block';
        clearSearch();
        shouldClearOnNextFocus = true;
        viewList.classList.add('search-centered');
        viewMenu.classList.remove('active');
        viewMenu.classList.add('hidden');
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
        if (listHeaderBar) listHeaderBar.classList.remove('header-hidden');

        window.scrollTo(0, 0);
        renderSongs();
        setTimeout(() => searchInput.focus(), 100);
    });

    backToMenuBtn.addEventListener('click', goBackToMenu);
    

        function closeSongView() {
        resetChordsVisibility();
        viewSong.classList.remove('active');
        viewSong.classList.add('hidden');
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
        document.body.classList.remove('no-scroll');
        if (listHeaderBar) listHeaderBar.classList.remove('header-hidden');
        updateFabBackListBtnVisibility();
    }
    
    songBackBtn.addEventListener('click', closeSongView);
    fabBackBtn.addEventListener('click', closeSongView);
    
    const bugReportModal = document.getElementById('bug-report-modal');
    const bugDescription = document.getElementById('bug-description');
    const bugCancelBtn = document.getElementById('bug-cancel-btn');
    const bugSubmitBtn = document.getElementById('bug-submit-btn');
    const bugConfirmModal = document.getElementById('bug-confirm-modal');
    const bugConfirmOkBtn = document.getElementById('bug-confirm-ok-btn');
    const reportBugBtn = document.getElementById('report-bug-btn');
    const bugErrorMsg = document.getElementById('bug-error-msg');

    // Action Confirm elements
    const actionConfirmModal = document.getElementById('action-confirm-modal');
    const actionConfirmTitle = document.getElementById('action-confirm-title');
    const actionConfirmMessage = document.getElementById('action-confirm-message');
    const actionConfirmCancelBtn = document.getElementById('action-confirm-cancel-btn');
    const actionConfirmOkBtn = document.getElementById('action-confirm-ok-btn');
    let onConfirmCallback = null;

    const showActionConfirm = (title, message, callback) => {
        if (!actionConfirmModal) return;
        actionConfirmTitle.innerText = title;
        actionConfirmMessage.innerText = message;
        onConfirmCallback = callback;
        actionConfirmModal.classList.add('active');
    };

    if (actionConfirmCancelBtn && actionConfirmModal) {
        actionConfirmCancelBtn.addEventListener('click', () => {
            actionConfirmModal.classList.remove('active');
            onConfirmCallback = null;
        });
    }

    if (actionConfirmOkBtn && actionConfirmModal) {
        actionConfirmOkBtn.addEventListener('click', () => {
            if (onConfirmCallback) {
                onConfirmCallback();
            }
            actionConfirmModal.classList.remove('active');
            onConfirmCallback = null;
        });
    }

    if (actionConfirmModal) {
        actionConfirmModal.addEventListener('click', (e) => {
            if (e.target === actionConfirmModal) {
                actionConfirmModal.classList.remove('active');
                onConfirmCallback = null;
            }
        });
    }

    if (reportBugBtn && bugReportModal) {
        reportBugBtn.addEventListener('click', (e) => {
            bugDescription.value = ''; // Reset input
            if (bugErrorMsg) bugErrorMsg.classList.add('hidden');
            bugReportModal.classList.add('active');
            // Timeout to allow bounce transform to finish before focusing
            setTimeout(() => {
                bugDescription.focus();
            }, 250);
        });
    }

    if (bugCancelBtn && bugReportModal) {
        bugCancelBtn.addEventListener('click', () => {
            bugReportModal.classList.remove('active');
        });
    }

    // Also close modal when clicking outside content
    if (bugReportModal) {
        bugReportModal.addEventListener('click', (e) => {
            if (e.target === bugReportModal) {
                bugReportModal.classList.remove('active');
            }
        });
    }

    if (bugConfirmModal) {
        bugConfirmModal.addEventListener('click', (e) => {
            if (e.target === bugConfirmModal) {
                bugConfirmModal.classList.remove('active');
            }
        });
    }

    if (bugConfirmOkBtn && bugConfirmModal) {
        bugConfirmOkBtn.addEventListener('click', () => {
            bugConfirmModal.classList.remove('active');
        });
    }

    if (bugDescription) {
        bugDescription.addEventListener('input', () => {
            if (bugErrorMsg) {
                bugErrorMsg.classList.add('hidden');
            }
        });
    }

    if (bugSubmitBtn && bugReportModal && bugDescription) {
        bugSubmitBtn.addEventListener('click', () => {
            const text = bugDescription.value.trim();
            if (!text) {
                if (bugErrorMsg) {
                    bugErrorMsg.classList.remove('hidden');
                    bugErrorMsg.style.animation = 'none';
                    bugErrorMsg.offsetHeight; /* trigger reflow */
                    bugErrorMsg.style.animation = null;
                }
                return;
            }
            
            const songTitle = document.getElementById('song-title').innerText;
            const songAuthor = document.getElementById('song-author').innerText || 'Desconhecido';
            
            // Catalog/Save the bug locally
            const reportedBugs = JSON.parse(localStorage.getItem('reportedBugs')) || [];
            reportedBugs.push({
                song: songTitle,
                author: songAuthor,
                description: text,
                date: new Date().toLocaleDateString('pt-BR')
            });
            localStorage.setItem('reportedBugs', JSON.stringify(reportedBugs));
            
            bugReportModal.classList.remove('active');
            
            // Show confirmation modal
            if (bugConfirmModal) {
                setTimeout(() => {
                    bugConfirmModal.classList.add('active');
                }, 300);
            }
        });
    }

    // Bugs List Modal Logic
    const bugsListModal = document.getElementById('bugs-list-modal');
    const bugsModalList = document.getElementById('bugs-modal-list');
    const bugsClearAllBtn = document.getElementById('bugs-clear-all-btn');
    const bugsCloseBtn = document.getElementById('bugs-close-btn');
    const reportMessagesBtn = document.getElementById('report-messages-btn');

    function renderBugsList() {
        if (!bugsModalList) return;
        const reportedBugs = JSON.parse(localStorage.getItem('reportedBugs')) || [];
        
        if (reportedBugs.length === 0) {
            bugsModalList.innerHTML = '<div class="no-bugs-msg">Nenhum erro encontrado no momento.</div>';
            if (bugsClearAllBtn) bugsClearAllBtn.style.display = 'none';
            return;
        }

        if (bugsClearAllBtn) bugsClearAllBtn.style.display = 'flex';
        
        bugsModalList.innerHTML = reportedBugs.map((bug, index) => `
            <div class="bug-report-item">
                <div class="bug-report-item-header">
                    <h4 class="bug-report-item-title">${bug.song}</h4>
                    <span class="bug-report-item-date">${bug.date}</span>
                </div>
                <p class="bug-report-item-desc">${bug.description}</p>
                <div class="bug-report-item-footer">
                    <button class="bug-report-item-resolve" data-index="${index}" aria-label="Resolvido">
                        <img src="${checkIcon}" alt="Resolvido" class="check-icon">
                    </button>
                    <button class="bug-report-item-trash" data-index="${index}" aria-label="Apagar erro">
                        <img src="${trashIcon}" alt="Apagar" class="trash-icon">
                    </button>
                </div>
            </div>
        `).join('');

        const resolveAction = (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            const bugs = JSON.parse(localStorage.getItem('reportedBugs')) || [];
            bugs.splice(index, 1);
            localStorage.setItem('reportedBugs', JSON.stringify(bugs));
            renderBugsList();
        };

        const deleteAction = (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            showActionConfirm(
                'APAGAR ERRO',
                'Deseja realmente excluir este relato de erro?',
                () => {
                    const bugs = JSON.parse(localStorage.getItem('reportedBugs')) || [];
                    bugs.splice(index, 1);
                    localStorage.setItem('reportedBugs', JSON.stringify(bugs));
                    renderBugsList();
                }
            );
        };

        // Add resolve listener to resolve button
        bugsModalList.querySelectorAll('.bug-report-item-resolve').forEach(btn => {
            btn.addEventListener('click', resolveAction);
        });

        // Add delete listener to trash button
        bugsModalList.querySelectorAll('.bug-report-item-trash').forEach(btn => {
            btn.addEventListener('click', deleteAction);
        });
    }

    if (reportMessagesBtn && bugsListModal) {
        let isUnlocked = false;
        const errorClosedEye = document.getElementById('report-messages-closed-eye');
        const errorOpenEye = document.getElementById('report-messages-eye');
        if (errorClosedEye && errorOpenEye) {
            errorClosedEye.classList.remove('hidden');
            errorOpenEye.classList.add('hidden');
        }

        const passwordPromptModal = document.getElementById('password-prompt-modal');
        const passwordInput = document.getElementById('prompt-password-input');
        const cancelBtn = document.getElementById('prompt-cancel-btn');
        const submitBtn = document.getElementById('prompt-submit-btn');
        const errorMsg = document.getElementById('prompt-error-msg');
        const toggleVisibilityBtn = document.getElementById('toggle-password-visibility-btn');
        const visibilityOff = document.getElementById('password-visibility-off');
        const visibilityOn = document.getElementById('password-visibility-on');

        const closePasswordModal = () => {
            if (passwordPromptModal) {
                passwordPromptModal.classList.remove('active');
            }
            if (passwordInput) {
                passwordInput.value = '';
                passwordInput.type = 'password';
            }
            if (visibilityOff && visibilityOn) {
                visibilityOff.classList.remove('hidden');
                visibilityOn.classList.add('hidden');
            }
            if (errorMsg) {
                errorMsg.classList.add('hidden');
            }
        };

        const tryUnlock = () => {
            if (!passwordInput) return;
            const pwd = passwordInput.value;
            if (pwd === 'admsemeadores*') {
                isUnlocked = true;
                if (errorClosedEye && errorOpenEye) {
                    errorClosedEye.classList.add('hidden');
                    errorOpenEye.classList.remove('hidden');
                }
                closePasswordModal();
                renderBugsList();
                bugsListModal.classList.add('active');
            } else {
                if (errorMsg) {
                    errorMsg.classList.remove('hidden');
                    // Reset animation trigger
                    errorMsg.style.animation = 'none';
                    errorMsg.offsetHeight; /* trigger reflow */
                    errorMsg.style.animation = null;
                }
                passwordInput.select();
            }
        };

        reportMessagesBtn.addEventListener('click', () => {
            const settingsBtn = document.getElementById('settings-btn');
            const settingsDropdown = document.getElementById('settings-dropdown');
            if (settingsBtn && settingsDropdown) {
                settingsBtn.classList.remove('active');
                settingsDropdown.classList.remove('active');
            }

            if (!isUnlocked) {
                if (passwordPromptModal && passwordInput) {
                    passwordInput.value = '';
                    passwordInput.type = 'password';
                    if (visibilityOff && visibilityOn) {
                        visibilityOff.classList.remove('hidden');
                        visibilityOn.classList.add('hidden');
                    }
                    if (errorMsg) errorMsg.classList.add('hidden');
                    passwordPromptModal.classList.add('active');
                    setTimeout(() => {
                        passwordInput.focus();
                    }, 100);
                }
            } else {
                renderBugsList();
                bugsListModal.classList.add('active');
            }
        });

        if (cancelBtn) {
            cancelBtn.addEventListener('click', closePasswordModal);
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', tryUnlock);
        }

        if (toggleVisibilityBtn && passwordInput && visibilityOff && visibilityOn) {
            toggleVisibilityBtn.addEventListener('click', () => {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    visibilityOff.classList.add('hidden');
                    visibilityOn.classList.remove('hidden');
                } else {
                    passwordInput.type = 'password';
                    visibilityOff.classList.remove('hidden');
                    visibilityOn.classList.add('hidden');
                }
                passwordInput.focus();
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    tryUnlock();
                }
            });
            passwordInput.addEventListener('input', () => {
                if (errorMsg) {
                    errorMsg.classList.add('hidden');
                }
            });
        }
    }

    // Settings Dropdown Logic
    const settingsBtn = document.getElementById('settings-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');

    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsBtn.classList.toggle('active');
            settingsDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!settingsDropdown.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
                settingsBtn.classList.remove('active');
                settingsDropdown.classList.remove('active');
            }
        });
    }

    if (bugsCloseBtn && bugsListModal) {
        bugsCloseBtn.addEventListener('click', () => {
            bugsListModal.classList.remove('active');
        });
    }

    if (bugsClearAllBtn && bugsListModal) {
        bugsClearAllBtn.addEventListener('click', () => {
            showActionConfirm(
                'LIMPAR HISTÓRICO',
                'Deseja realmente limpar todo o histórico de erros reportados?',
                () => {
                    localStorage.removeItem('reportedBugs');
                    renderBugsList();
                }
            );
        });
    }

    // Close modal when clicking outside content
    if (bugsListModal) {
        bugsListModal.addEventListener('click', (e) => {
            if (e.target === bugsListModal) {
                bugsListModal.classList.remove('active');
            }
        });
    }
    
    fabBackListBtn.addEventListener('click', goBackToMenu);
    listContentEl.addEventListener('scroll', updateListFadeInState);

    // Font Size Controls
    const enhanceFontLogic = () => {
        if(currentFontSize < 2.5) {
            currentFontSize += 0.1;
            songContentEl.style.fontSize = currentFontSize + 'rem';
            updateFabBackBtnVisibility();
        }
    };
    
    const shrinkFontLogic = () => {
        if(currentFontSize > 0.75) {
            currentFontSize -= 0.1;
            songContentEl.style.fontSize = currentFontSize + 'rem';
            updateFabBackBtnVisibility();
        }
    };

    if(fontIncreaseSvg) fontIncreaseSvg.addEventListener('click', enhanceFontLogic);
    if(fontDecreaseSvg) fontDecreaseSvg.addEventListener('click', shrinkFontLogic);

    // Toggle Chords
    const triggerChordToggle = () => {
        chordsVisible = !chordsVisible;
        if (chordsVisible) {
            if (toggleChordsSvgWrapper) {
                toggleChordsSvgWrapper.classList.remove('chords-inactive');
                toggleChordsSvgWrapper.classList.add('chords-active');
            }
            songContentEl.classList.remove('no-chords');
        } else {
            if (toggleChordsSvgWrapper) {
                toggleChordsSvgWrapper.classList.remove('chords-active');
                toggleChordsSvgWrapper.classList.add('chords-inactive');
            }
            songContentEl.classList.add('no-chords');
        }
        
        // Re-process lyrics using the corresponding source
        if (currentSong) {
            const content = (chordsVisible ? currentSong.chords : currentSong.lyrics) || '';
            songContentEl.innerHTML = processLyrics(content, chordsVisible);
        }
        
        updateFabBackBtnVisibility();
    };

    if(toggleChordsSvgWrapper) toggleChordsSvgWrapper.addEventListener('click', triggerChordToggle);

    const searchOverlay = document.getElementById('search-overlay');
    let shouldClearOnNextFocus = false;

    function clearSearch() {
        searchInput.value = '';
        searchOverlay.innerHTML = '';
        try {
            const originalType = searchInput.type || 'text';
            searchInput.type = 'password';
            searchInput.type = originalType;
        } catch (e) {
            // safeguard
        }
    }

    searchInput.addEventListener('focus', () => {
        if (shouldClearOnNextFocus) {
            shouldClearOnNextFocus = false;
            searchInput.value = '';
            searchOverlay.innerHTML = '';
            // Double clear using timeout to catch asynchronous autofills
            setTimeout(() => {
                if (searchInput.value !== '') {
                    searchInput.value = '';
                    searchOverlay.innerHTML = '';
                    searchInput.dispatchEvent(new Event('input'));
                }
            }, 50);
        }
    });

    // Events
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const trimmedVal = val.trim();

        if (trimmedVal.length > 0) {
            viewList.classList.remove('search-centered');
        } else {
            viewList.classList.add('search-centered');
        }

        // Atualiza a sobreposição de cores
        if (val.length === 0) {
            searchOverlay.innerHTML = '';
        } else {
            // Envolve dígitos e o ponto (se houver) num span da classe `number-highlight` para ficarem verdes
            const highlighted = val.replace(/(\d+\.?)/g, '<span class="number-highlight">$1</span>');
            searchOverlay.innerHTML = highlighted;
        }

        // Mantém a rolagem sincronizada caso o texto seja maior que a caixa
        searchOverlay.scrollLeft = searchInput.scrollLeft;

        renderSongs(trimmedVal);
    });

    searchInput.addEventListener('scroll', () => {
        searchOverlay.scrollLeft = searchInput.scrollLeft;
    });

    // Remove Neon ativo após 200ms nos botões do Menu, Players, Configurações e Mensagens para retorno rápido (era 300ms)
    document.querySelectorAll('.flex-btn, #theme-btn, #report-messages-btn, #settings-btn, #list-songs-btn, #search-songs-btn').forEach(btn => {
        // Intercepta qualquer forma de click/pressão pra garantir em todos os dipositivos
        btn.addEventListener('mousedown', () => activateNeon(btn));
        btn.addEventListener('touchstart', () => activateNeon(btn), {passive: true});

        function activateNeon(el) {
            el.classList.add('neon-active');
            setTimeout(() => {
                el.classList.remove('neon-active');
                el.blur(); // Perde o foco fantasma no touch 
            }, 200);
        }
    });

    // Scroll Listener for Header Bars
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > 10) {
            if (songHeaderBar) {
                songHeaderBar.classList.add('scrolled');
                songHeaderBar.classList.add('header-hidden');
            }
            if (listHeaderBar) {
                listHeaderBar.classList.add('scrolled');
                listHeaderBar.classList.add('header-hidden');
            }
        } else {
            if (songHeaderBar) {
                songHeaderBar.classList.remove('scrolled');
                songHeaderBar.classList.remove('header-hidden');
            }
            if (listHeaderBar) {
                listHeaderBar.classList.remove('scrolled');
                listHeaderBar.classList.remove('header-hidden');
            }
        }

        updateFadeInState();
        updateListFadeInState();
    });

    window.addEventListener('resize', () => {
        updateFabBackBtnVisibility();
        updateFabBackListBtnVisibility();
    });

    // Dismiss modals or dropdowns with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const settingsDropdownEl = document.getElementById('settings-dropdown');
            const settingsBtnEl = document.getElementById('settings-btn');
            if (settingsDropdownEl && settingsDropdownEl.classList.contains('active')) {
                settingsDropdownEl.classList.remove('active');
                if (settingsBtnEl) settingsBtnEl.classList.remove('active');
            }
            const passwordPromptModalEl = document.getElementById('password-prompt-modal');
            if (passwordPromptModalEl && passwordPromptModalEl.classList.contains('active')) {
                passwordPromptModalEl.classList.remove('active');
            }
            if (bugReportModal && bugReportModal.classList.contains('active')) {
                bugReportModal.classList.remove('active');
            }
            if (bugConfirmModal && bugConfirmModal.classList.contains('active')) {
                bugConfirmModal.classList.remove('active');
            }
            if (actionConfirmModal && actionConfirmModal.classList.contains('active')) {
                actionConfirmModal.classList.remove('active');
            }
            if (bugsListModal && bugsListModal.classList.contains('active')) {
                bugsListModal.classList.remove('active');
            }
        }
    });

    // Initial Render fallback
    renderSongs();
});
