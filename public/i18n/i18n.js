// 鍥介檯鍖栨牳蹇冪郴缁?
class I18n {
    constructor() {
        this.currentLanguage = localStorage.getItem('word_battle_language') || 'zh';
        this.translations = {};
        this.observers = [];
        
        this.init();
    }

    init() {
        // 鍔犺浇缈昏瘧鏁版嵁
        this.loadTranslations();
        // 搴旂敤褰撳墠璇█
        this.applyLanguage();
    }

    loadTranslations() {
        // 缈昏瘧鏁版嵁宸查€氳繃 translations.js 鑴氭湰鍔犺浇鍒板叏灞€鍙橀噺涓?
        if (window.translations) {
            this.translations = window.translations;
        } else {
            console.error('缈昏瘧鏁版嵁鏈姞杞?);
            // 浣跨敤榛樿缈昏瘧
            this.translations = { zh: {}, en: {} };
        }
    }

    // 鑾峰彇缈昏瘧鏂囨湰
    t(key, params = {}) {
        if (!key) {
            console.warn('缈昏瘧閿负绌?);
            return '';
        }

        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        if (!value) {
            console.warn(`褰撳墠璇█ ${this.currentLanguage} 鐨勭炕璇戞暟鎹笉瀛樺湪`);
            return key;
        }
        
        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }
        
        if (!value) {
            // 濡傛灉褰撳墠璇█娌℃湁缈昏瘧锛屽皾璇曚娇鐢ㄤ腑鏂?
            value = this.translations.zh;
            if (value) {
                for (const k of keys) {
                    value = value?.[k];
                    if (!value) break;
                }
            }
        }
        
        if (!value) {
            console.warn(`缈昏瘧缂哄け: ${key}`);
            return key;
        }
        
        // 鍙傛暟鏇挎崲
        return this.interpolate(value, params);
    }

    // 鍙傛暟鎻掑€?
    interpolate(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    // 鍒囨崲璇█
    switchLanguage(lang) {
        if (this.currentLanguage === lang) return;
        
        this.currentLanguage = lang;
        localStorage.setItem('word_battle_language', lang);
        
        // 閫氱煡鎵€鏈夎瀵熻€?
        this.notifyObservers();
        
        // 搴旂敤鏂拌瑷€
        this.applyLanguage();
    }

    // 搴旂敤璇█鍒伴〉闈?
    applyLanguage() {
        // 鏇存柊鎵€鏈夊甫鏈?data-i18n 灞炴€х殑鍏冪礌
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = this.t(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.type === 'submit' || element.type === 'button') {
                    element.value = text;
                } else {
                    element.placeholder = text;
                }
            } else {
                element.textContent = text;
            }
        });

        // 鏇存柊甯︽湁 data-i18n-title 灞炴€х殑鍏冪礌鐨?title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // 鏇存柊甯︽湁 data-i18n-html 灞炴€х殑鍏冪礌鐨?innerHTML
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });

        // 鏇存柊椤甸潰鏍囬
        document.title = this.t('common.pageTitle');
        
        // 鏇存柊璇█鍒囨崲鎸夐挳鐘舵€?
        this.updateLanguageSwitcher();
    }

    // 鏇存柊璇█鍒囨崲鎸夐挳
    updateLanguageSwitcher() {
        const switcher = document.getElementById('languageSwitcher');
        if (switcher) {
            const currentLang = switcher.querySelector('.current-lang');
            const otherLang = switcher.querySelector('.other-lang');
            
            if (this.currentLanguage === 'zh') {
                currentLang.textContent = '涓?;
                otherLang.textContent = 'EN';
            } else {
                currentLang.textContent = 'EN';
                otherLang.textContent = '涓?;
            }
        }
    }

    // 娣诲姞瑙傚療鑰?
    addObserver(callback) {
        this.observers.push(callback);
    }

    // 绉婚櫎瑙傚療鑰?
    removeObserver(callback) {
        this.observers = this.observers.filter(obs => obs !== callback);
    }

    // 閫氱煡瑙傚療鑰?
    notifyObservers() {
        this.observers.forEach(callback => {
            try {
                callback(this.currentLanguage);
            } catch (error) {
                console.error('Observer callback error:', error);
            }
        });
    }

    // 鑾峰彇褰撳墠璇█
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // 鏍煎紡鍖栨暟瀛楋紙鏍规嵁璇█鐜锛?
    formatNumber(number) {
        return new Intl.NumberFormat(this.currentLanguage === 'zh' ? 'zh-CN' : 'en-US').format(number);
    }

    // 鏍煎紡鍖栨椂闂达紙鏍规嵁璇█鐜锛?
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (this.currentLanguage === 'zh') {
            return `${minutes}鍒?{remainingSeconds}绉抈;
        } else {
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
}

// 纭繚鍦ㄩ〉闈㈠姞杞藉畬鎴愬悗鍒濆鍖?
document.addEventListener('DOMContentLoaded', () => {
    // 鍒涘缓鍏ㄥ眬瀹炰緥
    window.i18n = new I18n();
}); 
