document.addEventListener('DOMContentLoaded', () => {
    // ==================== ELEMENTS ====================
    const form               = document.getElementById('advisor-form');
    const userPromptTextarea = document.getElementById('user-prompt');
    const submitBtn          = document.getElementById('submit-btn');
    const adviceStream       = document.getElementById('advice-stream');
    const loaderBar          = document.getElementById('loader-bar');

    // Toolbar Elements
    const toolbar            = document.getElementById('toolbar');
    const historyBtn         = document.getElementById('history-btn');
    const newChatBtnTool     = document.getElementById('new-chat-btn-tool');
    const settingsBtn        = document.getElementById('settings-btn');
    const settingsPanel      = document.getElementById('settings-panel');
    const toolbarToggleBtn   = document.getElementById('toolbar-toggle-btn'); // NEW
    
    const menuToggle = document.getElementById('menu-toggle');

    // Settings Elements
    const themeSelect        = document.getElementById('theme-select');
    const voiceToggle        = document.getElementById('voice-toggle');
    const languageSelect     = document.getElementById('language-select');

    // History Modal Elements
    const historyModal       = document.getElementById('history-modal');
    const historyList        = document.getElementById('history-list');
    const closeModalBtn      = document.querySelector('#history-modal .close-btn');

    // File upload elements
    const fileInput          = document.getElementById('file-input');
    const filePreview        = document.getElementById('file-preview');
    const fileNameSpan       = document.getElementById('file-name');
    const removeFileBtn      = document.getElementById('remove-file-btn');
 
    const BACKEND_URL = 'https://aura-advisor-backend.onrender.com';

    // ==================== SESSION & SETTINGS ====================

    // FIX 1: Use a reliable, cross-browser UUID function
    function generateUUID() {
        return 'sess-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    }
    
    let currentSessionId = localStorage.getItem('auraSessionId') || generateUUID();
    localStorage.setItem('auraSessionId', currentSessionId); 

    // Load saved settings
    const savedTheme = localStorage.getItem('auraTheme') || 'light';
    if (document.documentElement.setAttribute) document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeSelect) themeSelect.value = savedTheme;
    if (voiceToggle) voiceToggle.checked = localStorage.getItem('auraVoice') === 'true';
    if (languageSelect) languageSelect.value = localStorage.getItem('auraLang') || 'en';

    // ==================== UTILS ====================

    function markdownToHtml(text) {
        if (!text) return '';
        // FIX 2: Corrected markdown-to-HTML logic
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }

    function addMessage(content, sender = 'aura') {
        if (!adviceStream) return;
        const div = document.createElement('div');
        div.className = `message ${sender === 'user' ? 'user-message' : 'aura-message'}`;
        
        div.innerHTML = sender === 'aura' 
            ? `<p>${markdownToHtml(content.trim())}</p>`
            : markdownToHtml(content.trim()); 

        adviceStream.appendChild(div);
        adviceStream.scrollTop = adviceStream.scrollHeight;

        // Voice output (Defensive checks)
        if (sender === 'aura' && voiceToggle?.checked && 'speechSynthesis' in window) {
            const clean = content.replace(/<[^>]*>/g, '').trim();
            speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(clean);
            const lang = languageSelect ? languageSelect.value : 'en';
            utter.lang = lang === 'sw' ? 'sw-KE' : 'en-US';
            utter.rate = 0.92;
            speechSynthesis.speak(utter);
        }
    }

    function toggleLoading(show) {
        if (!submitBtn) return;
        submitBtn.disabled = show;
        if (loaderBar) loaderBar.classList.toggle('hidden', !show);
        
        const icon = submitBtn.querySelector('.fas');
        if (icon) {
            // FIX 3: Correct icon toggling
            icon.classList.toggle('fa-paper-plane', !show);
            icon.classList.toggle('fa-spinner', show);
            icon.classList.toggle('fa-pulse', show);
        }
    }

    function resetChat() {
        if (!adviceStream) return;
        adviceStream.innerHTML = `
            <div class="message aura-intro">
                <p><strong>Aura:</strong> Hello, visionary! I'm Aura, your witty and warm guide. To begin, describe yourself—your interests, moods, talents, abilities, and weaknesses—AND tell me what advice you need. Let your uniqueness flow!</p>
            </div>`;
        if (userPromptTextarea) userPromptTextarea.value = '';
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.classList.add('hidden');
        if (userPromptTextarea) userPromptTextarea.focus();
    }

    // ==================== TOOLBAR & HISTORY LOGIC ====================

    // --- Toolbar Toggle Button ---
    if (toolbarToggleBtn && toolbar) {
        toolbarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toolbar.classList.toggle('collapsed');
            
            // Hide settings when collapsing
            if (toolbar.classList.contains('collapsed') && settingsPanel) {
                settingsPanel.classList.add('hidden');
            }
        });
    }
    
    // --- Toolbar Listener (for click expansion) ---
    if (toolbar) {
        toolbar.addEventListener('click', (e) => {
            if (e.target.closest('.tool-btn')) {
                toolbar.classList.remove('collapsed');
            }
        });
    }
    
    // Mobile sidebar toggle
    if (menuToggle && toolbar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toolbar.classList.toggle('open');
            document.body.classList.toggle('sidebar-open');
        });
    
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            const sidebarOpen = toolbar.classList.contains('open');
    
            if (isMobile && 
                sidebarOpen && 
                !toolbar.contains(e.target) && 
                e.target !== menuToggle) {
                toolbar.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
        });
    
        // Optional: close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && toolbar.classList.contains('open')) {
                toolbar.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
        });
    }

    // --- History Button ---
    if (historyBtn && historyModal && historyList) {
        historyBtn.addEventListener('click', () => {
            historyList.innerHTML = '<p style="text-align:center;color:#888;">Loading...</p>';
            historyModal.classList.remove('hidden');

            fetch('${BACKEND_URL}/api/history', { headers: { 'X-Session-ID': currentSessionId } })
                .then(r => r.json())
                .then(d => {
                    historyList.innerHTML = '';
                    if (!d.history?.length) {
                        historyList.innerHTML = '<p style="text-align:center;color:#888;">No history yet!</p>';
                        return;
                    }
                    d.history.forEach(m => {
                        // FIX 4: Correctly handle history skip for media/system messages
                        if (!m.text || m.text.includes("[Media/File Content Attached]")) return; 
                        const el = document.createElement('div');
                        el.className = m.role === 'user' ? 'history-user' : 'history-aura';
                        el.innerHTML = `<strong>${m.role === 'user' ? 'You' : 'Aura'}:</strong><br>${markdownToHtml(m.text)}`;
                        historyList.appendChild(el);
                    });
                })
                .catch((e) => {
                    console.error("History fetch error:", e);
                    historyList.innerHTML = '<p style="color:red;">Load failed. Check console for details.</p>';
                });
        });
    }

    // --- New Chat Button ---
    if (newChatBtnTool) {
        newChatBtnTool.addEventListener('click', () => {
            toggleLoading(true);
            currentSessionId = generateUUID(); 
            localStorage.setItem('auraSessionId', currentSessionId);

            fetch('${BACKEND_URL}/api/new_chat', {
                method: 'POST',
                headers: { 'X-Session-ID': currentSessionId }
            }).finally(() => {
                resetChat();
                toggleLoading(false);
            });
        });
    }

    // --- Settings Button ---
    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
        });
    }
    
    // Close settings panel / history-modal with X button
    document.querySelector('#settings-panel .close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('settings-panel').classList.add('hidden');
    });

    // --- Close Modal & Panel Listeners ---
    closeModalBtn?.addEventListener('click', () => historyModal.classList.add('hidden'));
    historyModal?.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        const clickedInsideToolbar = toolbar?.contains(e.target);
        const clickedInsideModal = historyModal?.contains(e.target);
        const toolbarWasExpanded = !toolbar?.classList.contains('collapsed');

        if (!clickedInsideToolbar && !clickedInsideModal) {
            settingsPanel?.classList.add('hidden');
            
            // Only collapse the toolbar if it was expanded and the click wasn't on a tool button
            if (toolbarWasExpanded && !e.target.closest('.tool-btn')) {
                toolbar?.classList.add('collapsed');
            }
        }
    });

    // ==================== SETTINGS SAVING ====================
    themeSelect?.addEventListener('change', (e) => {
        const theme = e.target.value;
        if (document.documentElement.setAttribute) document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('auraTheme', theme);
    });

    voiceToggle?.addEventListener('change', (e) => {
        localStorage.setItem('auraVoice', e.target.checked);
    });

    languageSelect?.addEventListener('change', (e) => {
        localStorage.setItem('auraLang', e.target.value);
    });
    
    // ==================== FILE INPUT LOGIC ====================
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0 && fileNameSpan && filePreview) {
                fileNameSpan.textContent = fileInput.files[0].name;
                filePreview.classList.remove('hidden');
            } else if (filePreview) {
                filePreview.classList.add('hidden');
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (filePreview) filePreview.classList.add('hidden');
        });
    }

    // ==================== SEND MESSAGE ====================
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const prompt = userPromptTextarea?.value.trim() || '';
            const file = fileInput?.files[0];
            if (!prompt && !file) return;

            document.querySelector('.aura-intro')?.remove();
            addMessage(prompt + (file ? ` [Attached: ${file.name}]` : ''), 'user');

            toggleLoading(true);
            if (userPromptTextarea) userPromptTextarea.value = '';

            const data = new FormData();
            data.append('full_prompt', prompt);
            
            const langValue = languageSelect ? languageSelect.value : 'en';
            data.append('language', langValue); 
            
            if (file) data.append('file', file);

            try {
                const res = await fetch('${BACKEND_URL}/api/advise', {
                    method: 'POST',
                    headers: { 'X-Session-ID': currentSessionId },
                    body: data
                });
                const { advice } = await res.json();
                addMessage(advice, 'aura');
            } catch (error) {
                console.error("Submission Error:", error);
                addMessage('Connection failed. Try again.', 'aura');
            } finally {
                toggleLoading(false);
                if (fileInput) fileInput.value = '';
                if (filePreview) filePreview.classList.add('hidden');
                if (userPromptTextarea) userPromptTextarea.focus();
            }
        });
    }

    // Enter = send and Auto-resize logic
    if (userPromptTextarea) {
        userPromptTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        });

        userPromptTextarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });

        userPromptTextarea.focus();
    }
});