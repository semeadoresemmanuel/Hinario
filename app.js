import songs from './songs.js';

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
    const songsList = document.getElementById('songs-list');
    const songTitleEl = document.getElementById('song-title');
    const songAuthorEl = document.getElementById('song-author');
    const songContentEl = document.getElementById('song-content');
    const searchInputContainer = document.getElementById('search-input-container');
    const fabBackBtn = document.getElementById('fab-back-btn');
    
    // SVG Controls Mode
    const fontDecreaseSvg = document.getElementById('font-decrease-svg');
    const fontIncreaseSvg = document.getElementById('font-increase-svg');
    const toggleChordsSvgWrapper = document.getElementById('toggle-chords-svg-wrapper');
    
    // Initial Font Size (Persistent)
    let currentFontSize = parseFloat(localStorage.getItem('lyricsFontSize')) || 0.75; // 12px initial

    // Initialize Theme
    let currentTheme = localStorage.getItem('theme') || 'dark';
    setThemeElements(currentTheme);

    function setThemeElements(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#121212' : '#f7f7f7');
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
    const validSongs = songs.filter(s => s.title && s.content && s.title.trim().length > 1);
    validSongs.sort((a, b) => a.title.localeCompare(b.title));

    // Helper to remove accents for searching
    function removeAccents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // Render List
    function renderSongs(filter = '') {
        songsList.innerHTML = '';
        const searchWord = removeAccents(filter.toLowerCase().trim());
        
        let listToRender = validSongs.map((song, idx) => {
            const numStr = String(idx + 1).padStart(2, '0');
            const cleanTitle = song.title.toUpperCase();
            return { 
                title: song.title + (song.author ? ` (${song.author})` : ''), 
                numStr: numStr,
                originalText: `<span class="song-number">${numStr}.</span> ${cleanTitle}`, 
                hybridSongObj: { title: cleanTitle, author: song.author, content: song.content },
                originalIndex: idx
            };
        });

        if (searchWord === '') {
            // Render all in standard numerical sequence
            listToRender.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'song-item';
                li.innerHTML = item.originalText;
                li.addEventListener('click', () => openSong(item.hybridSongObj));
                songsList.appendChild(li);
            });
            return;
        }

        // Filter and score for search accuracy
        let titleMatches = [];

        listToRender.forEach((item) => {
            const normalizedTitle = removeAccents(item.hybridSongObj.title.toLowerCase());
            
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
    }

    // Is it a chord line?
    function isChordLine(line) {
        const words = line.trim().split(/\s+/);
        if (words.length === 0 || line.trim() === '') return false;
        
        const chordPattern = /^[(]?[A-G][b#]?(m|M|maj|min|dim|aug|sus|7|9|11|13)*(\/[A-G][b#]?)?[)]?$/;
        let chordCount = 0;
        let specialCount = 0;
        
        words.forEach(w => {
            if (chordPattern.test(w)) chordCount++;
            else if (['||:', ':||', '|', '...'].includes(w)) specialCount++;
        });
        
        const totalConsidered = chordCount + specialCount;
        return (words.length > 0 && (totalConsidered / words.length) > 0.6);
    }

    // Process Lyrics to highlight chords and specific markers
    function processLyrics(text) {
        const lines = text.split('\n');
        return lines.map((line, i) => {
            const suffix = i < lines.length - 1 ? '\n' : '';
            
            if (isChordLine(line)) {
                const processedLine = line.replace(/\(2X\)|\[REFRÃO\]/g, '<span class="lyric-marker">$&</span>');
                return `<span class="chord-line chord">${processedLine}${suffix}</span>`;
            }
            
            // Trim leading and trailing spaces on lyric lines to guarantee perfect left alignment
            const trimmedLine = line.trim();
            const processedLine = trimmedLine.replace(/\(2X\)|\[REFRÃO\]/g, '<span class="lyric-marker">$&</span>');
            return processedLine + suffix;
        }).join('');
    }

    // Ensure titles fit in a single line by dynamically reducing font-size
    function fitTitleText() {
        if (!viewSong.classList.contains('active')) return;

        const titleEl = document.getElementById('song-title');
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
            requestAnimationFrame(() => {
                // Temporarily remove the visible class to measure container height without the button's layout contribution
                fabBackBtn.classList.remove('visible');
                fabBackBtn.classList.remove('fade-in');
                
                const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                const windowHeight = window.innerHeight;
                isSongScrollable = scrollHeight > windowHeight + 15;
                
                if (isSongScrollable) {
                    fabBackBtn.classList.add('visible');
                    // Wait for layout to settle with the button allocated, then cache maxScrollVal
                    requestAnimationFrame(() => {
                        const newScrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                        maxScrollVal = newScrollHeight - window.innerHeight;
                        updateFadeInState();
                    });
                } else {
                    fabBackBtn.classList.remove('visible');
                    fabBackBtn.classList.remove('fade-in');
                    maxScrollVal = 0;
                }
            });
        });
    }

    // Update bottom arrow opacity and transform transition dynamically on scroll
    function updateFadeInState() {
        if (!isSongScrollable) return;
        const currentScroll = window.scrollY;
        const triggerStart = maxScrollVal - 120; // Starts fading in 120px before the bottom
        
        if (currentScroll >= triggerStart) {
            fabBackBtn.classList.add('fade-in');
        } else {
            fabBackBtn.classList.remove('fade-in');
        }
    }

    // Open single song
    function openSong(song) {
        if(!song) return; // safeguard
        songTitleEl.innerText = song.title; // Montserrat natively renders accents without HTML injection
        
        if (song.author) {
            songAuthorEl.innerText = song.author;
            songAuthorEl.style.display = 'block';
        } else {
            songAuthorEl.style.display = 'none';
        }

        songContentEl.innerHTML = processLyrics(song.content); // Montserrat natively renders accents
        
        viewMenu.classList.remove('active');
        viewMenu.classList.add('hidden');
        viewList.classList.remove('active');
        viewList.classList.add('hidden');
        viewSong.classList.remove('hidden');
        viewSong.classList.add('active');
        window.scrollTo(0, 0);
        // Agendamento da re-checagem de tamanho (permite tempo pra renderização sair de display: none)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fitTitleText();
                updateFabBackBtnVisibility();
            });
        });
    }

    // Back to Menu
    function goBackToMenu() {
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
        viewList.classList.remove('search-centered');
        searchInputContainer.style.display = 'none'; // hide search input when just listing all
        searchInput.value = '';
        renderSongs();
        viewMenu.classList.remove('active');
        viewMenu.classList.add('hidden');
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
    });

    searchSongsBtn.addEventListener('click', () => {
        searchInputContainer.style.display = 'block';
        searchInput.value = '';
        renderSongs();
        viewList.classList.add('search-centered');
        viewMenu.classList.remove('active');
        viewMenu.classList.add('hidden');
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
        setTimeout(() => searchInput.focus(), 100);
    });

    backToMenuBtn.addEventListener('click', goBackToMenu);
    
    function closeSongView() {
        viewSong.classList.remove('active');
        viewSong.classList.add('hidden');
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
    }
    
    songBackBtn.addEventListener('click', closeSongView);
    fabBackBtn.addEventListener('click', closeSongView);

    // Font Size Controls
    const enhanceFontLogic = () => {
        if(currentFontSize < 2.5) {
            currentFontSize += 0.1;
            songContentEl.style.fontSize = currentFontSize + 'rem';
            localStorage.setItem('lyricsFontSize', currentFontSize.toFixed(2));
            updateFabBackBtnVisibility();
        }
    };
    
    const shrinkFontLogic = () => {
        if(currentFontSize > 0.75) {
            currentFontSize -= 0.1;
            songContentEl.style.fontSize = currentFontSize + 'rem';
            localStorage.setItem('lyricsFontSize', currentFontSize.toFixed(2));
            updateFabBackBtnVisibility();
        }
    };

    if(fontIncreaseSvg) fontIncreaseSvg.addEventListener('click', enhanceFontLogic);
    if(fontDecreaseSvg) fontDecreaseSvg.addEventListener('click', shrinkFontLogic);

    // Toggle Chords
    let chordsVisible = false;
    
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
        updateFabBackBtnVisibility();
    };

    if(toggleChordsSvgWrapper) toggleChordsSvgWrapper.addEventListener('click', triggerChordToggle);

    const searchOverlay = document.getElementById('search-overlay');
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

    // Remove Neon ativo após 200ms nos botões do Menu e Players para retorno rápido (era 300ms)
    document.querySelectorAll('.flex-btn, #theme-btn, #list-songs-btn, #search-songs-btn').forEach(btn => {
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

    // Scroll Listener for Song Header Bar
    const songHeaderBar = document.querySelector('.song-header-bar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            if (songHeaderBar) songHeaderBar.classList.add('scrolled');
        } else {
            if (songHeaderBar) songHeaderBar.classList.remove('scrolled');
        }
        updateFadeInState();
    });

    window.addEventListener('resize', updateFabBackBtnVisibility);

    // Initial Render fallback
    renderSongs();
});
