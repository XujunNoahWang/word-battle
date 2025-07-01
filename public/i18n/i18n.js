// 国际化核心系统
class I18n {
    constructor() {
        this.currentLanguage = localStorage.getItem('word_battle_language') || 'zh';
        this.translations = {};
        this.observers = [];
        
        this.init();
    }

    init() {
        // 加载翻译数据
        this.loadTranslations();
        // 应用当前语言
        this.applyLanguage();
    }

    loadTranslations() {
        // 翻译数据已通过 translations.js 脚本加载到全局变量中
        if (window.translations) {
            this.translations = window.translations;
        } else {
            console.error('翻译数据未加载');
            // 使用默认翻译
            this.translations = { zh: {}, en: {} };
        }
    }

    // 获取翻译文本
    t(key, params = {}) {
        if (!key) {
            console.warn('翻译键为空');
            return '';
        }

        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        if (!value) {
            console.warn(`当前语言 ${this.currentLanguage} 的翻译数据不存在`);
            return key;
        }
        
        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }
        
        if (!value) {
            // 如果当前语言没有翻译，尝试使用中文
            value = this.translations.zh;
            if (value) {
                for (const k of keys) {
                    value = value?.[k];
                    if (!value) break;
                }
            }
        }
        
        if (!value) {
            console.warn(`翻译缺失: ${key}`);
            return key;
        }
        
        // 参数替换
        return this.interpolate(value, params);
    }

    // 参数插值
    interpolate(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    // 切换语言
    switchLanguage(lang) {
        if (this.currentLanguage === lang) return;
        
        this.currentLanguage = lang;
        localStorage.setItem('word_battle_language', lang);
        
        // 通知所有观察者
        this.notifyObservers();
        
        // 应用新语言
        this.applyLanguage();
    }

    // 应用语言到页面
    applyLanguage() {
        // 更新所有带有 data-i18n 属性的元素
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

        // 更新带有 data-i18n-title 属性的元素的 title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // 更新带有 data-i18n-html 属性的元素的 innerHTML
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });

        // 更新页面标题
        document.title = this.t('common.pageTitle');
        
        // 更新语言切换按钮状态
        this.updateLanguageSwitcher();
    }

    // 更新语言切换按钮
    updateLanguageSwitcher() {
        const switcher = document.getElementById('languageSwitcher');
        if (switcher) {
            const currentLang = switcher.querySelector('.current-lang');
            const otherLang = switcher.querySelector('.other-lang');
            
            if (this.currentLanguage === 'zh') {
                currentLang.textContent = '中';
                otherLang.textContent = 'EN';
            } else {
                currentLang.textContent = 'EN';
                otherLang.textContent = '中';
            }
        }
    }

    // 添加观察者
    addObserver(callback) {
        this.observers.push(callback);
    }

    // 移除观察者
    removeObserver(callback) {
        this.observers = this.observers.filter(obs => obs !== callback);
    }

    // 通知观察者
    notifyObservers() {
        this.observers.forEach(callback => {
            try {
                callback(this.currentLanguage);
            } catch (error) {
                console.error('Observer callback error:', error);
            }
        });
    }

    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // 格式化数字（根据语言环境）
    formatNumber(number) {
        return new Intl.NumberFormat(this.currentLanguage === 'zh' ? 'zh-CN' : 'en-US').format(number);
    }

    // 格式化时间（根据语言环境）
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (this.currentLanguage === 'zh') {
            return `${minutes}分${remainingSeconds}秒`;
        } else {
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
}

// 确保在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 创建全局实例
    window.i18n = new I18n();
}); 
