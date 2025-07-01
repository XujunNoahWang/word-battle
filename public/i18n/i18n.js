class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'zh';
        this.observers = new Set();
        this.initLanguage();
    }

    initLanguage() {
        document.documentElement.lang = this.currentLang;
        this.notifyObservers();
    }

    switchLanguage(lang) {
        if (this.currentLang === lang) return;
        
        this.currentLang = lang;
        document.documentElement.lang = lang;
        localStorage.setItem('language', lang);
        this.notifyObservers();
    }

    t(key, params = {}) {
        let text = translations[this.currentLang][key] || key;
        
        // 替换参数
        if (params && typeof params === 'object') {
            Object.keys(params).forEach(param => {
                const regex = new RegExp(`{${param}}`, 'g');
                text = text.replace(regex, params[param]);
            });
        }
        
        return text;
    }

    subscribe(observer) {
        this.observers.add(observer);
    }

    unsubscribe(observer) {
        this.observers.delete(observer);
    }

    notifyObservers() {
        this.observers.forEach(observer => observer());
    }

    // 更新所有带有data-i18n属性的元素
    updateAllTexts() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            // 检查是否有data-i18n-params属性
            const paramsAttr = element.getAttribute('data-i18n-params');
            let params = {};
            if (paramsAttr) {
                try {
                    params = JSON.parse(paramsAttr);
                } catch (e) {
                    console.error('Invalid data-i18n-params:', paramsAttr);
                }
            }
            element.textContent = this.t(key, params);
        });

        // 更新placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
    }
}

// 创建全局实例
const i18n = new I18n();

// 在DOM加载完成后更新所有文本
document.addEventListener('DOMContentLoaded', () => {
    i18n.updateAllTexts();
}); 