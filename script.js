document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const landingPage = document.getElementById('landing-page');
    const designerPage = document.getElementById('designer-page');
    const startButton = document.getElementById('start-button');
    const interactiveArea = document.getElementById('interactive-area');
    const sqmValue = document.getElementById('sqm-value');
    const scaleValue = document.getElementById('scale-value');
    const scaleSlider = document.getElementById('scale-slider');

    // --- Model Data ---
    let widthInMeters = 4;
    let heightInMeters = 3;
    let scale = 50;
    let resizableBox = null;

    // --- Core Functions ---
    function renderBoxAppearance() {
        if (!resizableBox) return;
        const pixelWidth = widthInMeters * scale;
        const pixelHeight = heightInMeters * scale;
        resizableBox.style.width = `${pixelWidth}px`;
        resizableBox.style.height = `${pixelHeight}px`;
    }

    function updateSquareMeters() {
        if (!resizableBox) return;
        const area = (widthInMeters * heightInMeters).toFixed(2);
        sqmValue.textContent = area;
    }

    function initializeInteractJs() {
        interact(resizableBox)
            .resizable({
                edges: {
                    top: '.handle-tl, .handle-tr',
                    left: '.handle-tl, .handle-bl',
                    bottom: '.handle-bl, .handle-br',
                    right: '.handle-tr, .handle-br',
                },
                listeners: {
                    move(event) {
                        const target = event.target;
                        widthInMeters = event.rect.width / scale;
                        heightInMeters = event.rect.height / scale;
                        target.style.width = `${event.rect.width}px`;
                        target.style.height = `${event.rect.height}px`;
                        let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.deltaRect.left;
                        let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.deltaRect.top;
                        target.style.transform = `translate(${x}px, ${y}px)`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                        updateSquareMeters();
                    }
                },
                modifiers: [
                    interact.modifiers.restrictEdges({ outer: 'parent' }),
                    interact.modifiers.restrictSize({ min: { width: 1 * scale, height: 1 * scale } })
                ],
                inertia: false
            })
            .draggable({
                listeners: {
                    move(event) {
                        const target = event.target;
                        let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                        let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                        target.style.transform = `translate(${x}px, ${y}px)`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                    }
                },
                inertia: true,
                modifiers: [
                    interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })
                ]
            });
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        designerPage.classList.remove('hidden');

        if (!resizableBox) {
            resizableBox = document.createElement('div');
            resizableBox.id = 'resizable-box';
            ['tl', 'tr', 'bl', 'br'].forEach(corner => {
                const handle = document.createElement('div');
                handle.classList.add('resize-handle', `handle-${corner}`);
                resizableBox.appendChild(handle);
            });
            interactiveArea.appendChild(resizableBox);
            const startX = (interactiveArea.clientWidth / 2) - ((widthInMeters * scale) / 2);
            const startY = (interactiveArea.clientHeight / 2) - ((heightInMeters * scale) / 2);
            resizableBox.style.transform = `translate(${startX}px, ${startY}px)`;
            resizableBox.setAttribute('data-x', startX);
            resizableBox.setAttribute('data-y', startY);
            initializeInteractJs();
        }
        renderBoxAppearance();
        updateSquareMeters();
    });

    scaleSlider.addEventListener('input', (event) => {
        scale = parseInt(event.target.value, 10);
        scaleValue.textContent = scale;
        renderBoxAppearance();
        interact(resizableBox).resizable({
            modifiers: [
                interact.modifiers.restrictSize({ min: { width: 1 * scale, height: 1 * scale } })
            ]
        });
    });
});