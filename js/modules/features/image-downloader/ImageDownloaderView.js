(function() {
    'use strict';

    class ImageDownloaderView {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
            this.onDownload = typeof options.onDownload === 'function' ? options.onDownload : () => {};
            this.safeQuerySelectorAll = options.safeQuerySelectorAll || null;
            this.downloadButtons = new WeakMap();
        }

        hasDownloadButton(img) {
            return this.downloadButtons.has(img);
        }

        addDownloadButton(img) {
            const container = this.createImageContainer(img);
            const button = this.createDownloadButton(img);
            container.appendChild(button);
            this.downloadButtons.set(img, { container, button });
            this.setupImageEvents(img, container, button);
        }

        createImageContainer(img) {
            if (img.parentNode && img.parentNode.classList.contains('nws-image-container')) {
                return img.parentNode;
            }

            const container = document.createElement('div');
            container.className = 'nws-image-container';
            
            const style = window.getComputedStyle(img);
            const rect = img.getBoundingClientRect();
            
            if (style.position !== 'static') {
                container.style.position = style.position;
                container.style.top = style.top;
                container.style.right = style.right;
                container.style.bottom = style.bottom;
                container.style.left = style.left;
                container.style.zIndex = style.zIndex;
                container.style.transform = style.transform;
            }

            if (style.display === 'block') {
                container.style.display = 'block';
            } else {
                container.style.display = 'inline-block';
            }
            container.style.verticalAlign = style.verticalAlign;

            container.style.float = style.float;
            container.style.margin = style.margin;
            
            let width = rect.width || img.offsetWidth;
            let height = rect.height || img.offsetHeight;
            
            if (!width || width === 0) {
                width = img.naturalWidth || (style.width !== 'auto' ? style.width : null);
            }
            if (!height || height === 0) {
                height = img.naturalHeight || (style.height !== 'auto' ? style.height : null);
            }
            
            if (width) {
                container.style.width = typeof width === 'number' ? `${width}px` : width;
            } else if (style.width === '100%' || style.maxWidth === '100%') {
                container.style.width = '100%';
            }
            
            if (height) {
                container.style.height = typeof height === 'number' ? `${height}px` : height;
            }
            
            container.style.maxWidth = style.maxWidth;
            container.style.maxHeight = style.maxHeight;
            container.style.flex = style.flex;
            container.style.gridArea = style.gridArea;
            container.style.objectFit = style.objectFit;

            img.parentNode.insertBefore(container, img);
            container.appendChild(img);
            
            img.style.position = 'static';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.margin = '0';
            img.style.padding = '0';
            img.style.border = 'none';
            
            return container;
        }

        createDownloadButton(img) {
            const config = this.getConfig();
            const button = document.createElement('button');
            button.className = `nws-download-button nws-download-button-${config.buttonPosition}`;
            button.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;
            button.title = '下载图片';
            
            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.onDownload(img);
            };

            return button;
        }

        setupImageEvents(img, container, button) {
            container.addEventListener('mouseenter', () => {
                button.style.display = 'flex';
            });

            container.addEventListener('mouseleave', () => {
                button.style.display = 'none';
            });

            img.addEventListener('error', () => {
                this.removeDownloadButton(img);
            });
        }

        removeDownloadButton(img) {
            const buttonData = this.downloadButtons.get(img);
            if (!buttonData) return;

            const { container, button } = buttonData;
            
            if (button.parentNode) {
                button.parentNode.removeChild(button);
            }

            if (container.children.length === 1 && container.children[0] === img) {
                container.parentNode.insertBefore(img, container);
                container.parentNode.removeChild(container);
            }

            this.downloadButtons.delete(img);
        }

        removeAllDownloadButtons() {
            for (const img of this.downloadButtons.keys()) {
                this.removeDownloadButton(img);
            }
            this.downloadButtons = new WeakMap();
        }

        getDownloadButtonsCount() {
            return Array.from(this.downloadButtons.keys()).length;
        }

        getAllDownloadableImages() {
            return Array.from(this.downloadButtons.keys());
        }

        getAllImages(root = document) {
            if (this.safeQuerySelectorAll) {
                return this.safeQuerySelectorAll('img', root);
            }
            return root.querySelectorAll('img');
        }
    }

    if (window.NWSModules) {
        window.NWSModules.ImageDownloaderView = ImageDownloaderView;
    }
})();
