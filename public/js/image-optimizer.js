// Image optimization utility class
class ImageOptimizer {
    constructor() {
        this.webpSupported = null;
        this.imageCache = new Map();
        this.preloadQueue = [];
        this.isPreloading = false;
    }

    // Check WebP support
    async checkWebPSupport() {
        if (this.webpSupported !== null) {
            return this.webpSupported;
        }

        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                this.webpSupported = webP.height === 2;
                resolve(this.webpSupported);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    // Get optimized image URL
    async getImageUrl(word) {
        const supportsWebP = await this.checkWebPSupport();
        const extension = supportsWebP ? 'webp' : 'jpg';
        return `/data/images/${word.toLowerCase()}.${extension}`;
    }

    // Preload single image
    async preloadImage(word) {
        const url = await this.getImageUrl(word);
        
        if (this.imageCache.has(url)) {
            return this.imageCache.get(url);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(url, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to preload image: ${word}`);
                reject(new Error(`Failed to load ${word}`));
            };
            img.src = url;
        });
    }

    // Preload multiple images with progress callback
    async preloadImages(words, progressCallback = null) {
        const total = words.length;
        let loaded = 0;
        const results = [];

        for (const word of words) {
            try {
                const img = await this.preloadImage(word);
                results.push({ word, img, success: true });
            } catch (error) {
                results.push({ word, error: error.message, success: false });
            }
            
            loaded++;
            if (progressCallback) {
                const percent = Math.round((loaded / total) * 100);
                progressCallback(loaded, total, percent);
            }
        }

        return results;
    }

    // Batch preload with queue management
    async batchPreload(words, priority = 'normal') {
        const task = { words, priority, promise: null };
        
        if (priority === 'high') {
            // High priority tasks are executed immediately
            task.promise = this.preloadImages(words);
        } else {
            // Normal priority tasks are queued
            this.preloadQueue.push(task);
            task.promise = new Promise((resolve) => {
                task.resolve = resolve;
            });
        }

        if (!this.isPreloading) {
            this.processQueue();
        }

        return task.promise;
    }

    // Process preload queue
    async processQueue() {
        if (this.isPreloading || this.preloadQueue.length === 0) {
            return;
        }

        this.isPreloading = true;

        while (this.preloadQueue.length > 0) {
            const task = this.preloadQueue.shift();
            try {
                const result = await this.preloadImages(task.words);
                if (task.resolve) {
                    task.resolve(result);
                }
            } catch (error) {
                if (task.resolve) {
                    task.resolve([]);
                }
            }
        }

        this.isPreloading = false;
    }

    // Get cached image
    getCachedImage(word) {
        const url = `/data/images/${word.toLowerCase()}.webp`;
        return this.imageCache.get(url) || null;
    }

    // Clear cache
    clearCache() {
        this.imageCache.clear();
    }

    // Get cache stats
    getCacheStats() {
        return {
            size: this.imageCache.size,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    // Estimate memory usage
    estimateMemoryUsage() {
        let totalBytes = 0;
        for (const img of this.imageCache.values()) {
            if (img.width && img.height) {
                totalBytes += img.width * img.height * 4; // 4 bytes per pixel (RGBA)
            }
        }
        return totalBytes;
    }
}

// Export for use in other modules
window.ImageOptimizer = ImageOptimizer; 