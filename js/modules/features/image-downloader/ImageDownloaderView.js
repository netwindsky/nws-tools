(function() {
    'use strict';

    class ImageDownloaderView {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
            this.onDownload = typeof options.onDownload === 'function' ? options.onDownload : () => {};
            this.safeQuerySelectorAll = options.safeQuerySelectorAll || null;
            this.downloadButtons = new WeakMap();
            this.resizeObservers = new WeakMap();
        }

        hasDownloadButton(img) {
            return this.downloadButtons.has(img);
        }

        addDownloadButton(img) {
            const overlay = this.createOverlay(img);
            const button = this.createDownloadButton(img);
            overlay.appendChild(button);
            this.downloadButtons.set(img, { overlay, button });
            this.setupImageEvents(img, overlay, button);
            this.setupResizeObserver(img, overlay);
        }

        createOverlay(img) {
            const overlay = document.createElement('div');
            overlay.className = 'nws-image-overlay';
            overlay.dataset.nwsOverlay = 'true';

            this.updateOverlayPosition(img, overlay);

            document.body.appendChild(overlay);

            return overlay;
        }

        updateOverlayPosition(img, overlay) {
            const rect = img.getBoundingClientRect();
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            overlay.style.position = 'absolute';
            overlay.style.left = `${rect.left + scrollLeft}px`;
            overlay.style.top = `${rect.top + scrollTop}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '999999';
        }

        setupResizeObserver(img, overlay) {
            const updatePosition = () => {
                if (document.body.contains(img)) {
                    this.updateOverlayPosition(img, overlay);
                }
            };

            window.addEventListener('scroll', updatePosition, { passive: true });
            window.addEventListener('resize', updatePosition, { passive: true });

            let mutationObserver;
            if (typeof MutationObserver !== 'undefined') {
                mutationObserver = new MutationObserver(updatePosition);
                const parent = img.parentElement;
                if (parent) {
                    mutationObserver.observe(parent, { attributes: true, childList: true, subtree: true });
                }
            }

            this.resizeObservers.set(img, { updatePosition, mutationObserver });
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
            button.style.pointerEvents = 'auto';

            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.onDownload(img);
            };

            return button;
        }

        setupImageEvents(img, overlay, button) {
            const showButton = () => {
                button.classList.add('nws-visible');
                overlay.style.pointerEvents = 'auto';
            };

            const hideButton = (e) => {
                const relatedTarget = e.relatedTarget;
                if (relatedTarget && (relatedTarget === img || relatedTarget === overlay || overlay.contains(relatedTarget))) {
                    return;
                }
                button.classList.remove('nws-visible');
                overlay.style.pointerEvents = 'none';
            };

            img.addEventListener('mouseenter', showButton);
            img.addEventListener('mouseleave', hideButton);
            overlay.addEventListener('mouseenter', showButton);
            overlay.addEventListener('mouseleave', hideButton);

            img.addEventListener('error', () => {
                this.removeDownloadButton(img);
            });

            img.addEventListener('load', () => {
                this.updateOverlayPosition(img, overlay);
            });
        }

        removeDownloadButton(img) {
            const buttonData = this.downloadButtons.get(img);
            if (!buttonData) return;

            const { overlay } = buttonData;
            const observerData = this.resizeObservers.get(img);

            if (observerData) {
                window.removeEventListener('scroll', observerData.updatePosition);
                window.removeEventListener('resize', observerData.updatePosition);
                if (observerData.mutationObserver) {
                    observerData.mutationObserver.disconnect();
                }
                this.resizeObservers.delete(img);
            }

            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }

            this.downloadButtons.delete(img);
        }

        removeAllDownloadButtons() {
            for (const img of this.downloadButtons.keys()) {
                this.removeDownloadButton(img);
            }
            this.downloadButtons = new WeakMap();
            this.resizeObservers = new WeakMap();
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
