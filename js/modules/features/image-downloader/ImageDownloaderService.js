(function() {
    'use strict';

    class ImageDownloaderService {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
            this.chromeSettings = options.chromeSettings || null;
            this.notification = options.notification || null;
            this.emit = typeof options.emit === 'function' ? options.emit : () => {};
            this.downloadCounter = 0;
        }

        async downloadImage(img) {
            try {
                const src = img.src || img.dataset.src;
                if (!src) {
                    throw new Error('图片源地址不存在');
                }

                const filename = this.generateFilename(img, src);
                
                if (this.chromeSettings) {
                    try {
                        const downloadId = await this.chromeSettings.downloadFile({
                            url: src,
                            filename: filename,
                            saveAs: false
                        });

                        this.emit('imageDownloaded', { img, src, filename, downloadId });
                        
                        if (this.notification) {
                            this.notification.success(`图片下载开始: ${filename}`);
                        }
                    } catch (downloadError) {
                        if (downloadError.message && downloadError.message.includes('Could not establish connection')) {
                            await this.fallbackDownload(src, filename);
                            if (this.notification) {
                                this.notification.info(`已使用备用方式下载: ${filename}`);
                            }
                        } else {
                            throw downloadError;
                        }
                    }
                } else {
                    await this.fallbackDownload(src, filename);
                }

            } catch (error) {
                if (this.notification) {
                    this.notification.error(`图片下载失败: ${error.message}`);
                }
                
                this.emit('downloadError', { img, error });
            }
        }

        async fallbackDownload(src, filename) {
            try {
                const response = await fetch(src, {
                    method: 'GET',
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                
            } catch (error) {
                const link = document.createElement('a');
                link.href = src;
                link.download = filename;
                link.target = '_blank';
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        async batchDownload(images = []) {
            if (!images.length) {
                if (this.notification) {
                    this.notification.warning('没有找到可下载的图片');
                }
                return;
            }

            if (this.notification) {
                this.notification.info(`开始批量下载 ${images.length} 张图片`);
            }

            let successCount = 0;
            let errorCount = 0;

            for (const img of images) {
                try {
                    await this.downloadImage(img);
                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    errorCount++;
                }
            }

            if (this.notification) {
                this.notification.success(`批量下载完成: 成功 ${successCount} 张，失败 ${errorCount} 张`);
            }

            this.emit('batchDownloadCompleted', { total: images.length, success: successCount, error: errorCount });
        }

        generateFilename(img, src) {
            const config = this.getConfig();
            const url = new URL(src, window.location.href);
            const pathname = url.pathname;
            const originalName = pathname.split('/').pop() || 'image';
            const extension = this.getImageExtension(src) || 'jpg';
            const timestamp = Date.now();
            const index = ++this.downloadCounter;

            let filename = config.filenameTemplate
                .replace('{index}', index.toString().padStart(3, '0'))
                .replace('{timestamp}', timestamp.toString())
                .replace('{original}', originalName.replace(/\.[^/.]+$/, ''))
                .replace('{extension}', extension);

            if (!filename.includes('.')) {
                filename += '.' + extension;
            }

            return filename;
        }

        getImageExtension(src) {
            try {
                const url = new URL(src, window.location.href);
                const pathname = url.pathname;
                const match = pathname.match(/\.([^.]+)$/);
                return match ? match[1] : null;
            } catch {
                return null;
            }
        }
    }

    if (window.NWSModules) {
        window.NWSModules.ImageDownloaderService = ImageDownloaderService;
    }
})();
