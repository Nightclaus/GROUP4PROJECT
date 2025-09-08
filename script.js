document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const landingPage = document.getElementById('landing-page');
    const designerPage = document.getElementById('designer-page');
    const startButton = document.getElementById('start-button');
    const interactiveArea = document.getElementById('interactive-area');
    const addObjectBtn = document.getElementById('add-object-btn');
    const areaDisplay = document.getElementById('area-display');
    const scaleValue = document.getElementById('scale-value');
    const scaleSlider = document.getElementById('scale-slider');
    const zoomSlider = document.getElementById('zoom-slider');
    const colorPalette = document.getElementById('color-palette');

    // --- Application State ---
    let designObjects = [];
    let scale = 50;
    let objectCounter = 0;
    let selectedObjectId = null;
    let panX = 0;
    let panY = 0;

    // --- Core Functions ---

    function updateCanvasTransform() {
        const zoom = zoomSlider.value;
        interactiveArea.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        updateGrid();
    }
    
    // NEW: Function to draw and update the background grid
    function updateGrid() {
        const zoom = zoomSlider.value;
        const gridSize = scale * zoom; // The visual size of 1 meter

        // Create two gradients, one for vertical lines and one for horizontal
        interactiveArea.style.backgroundImage = `
            linear-gradient(to right, #e0e0e0 1px, transparent 1px),
            linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
        `;
        // Set the size of the grid squares
        interactiveArea.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    }

    function createObject(centerX, centerY) {
        objectCounter++;
        const objectId = `obj-${objectCounter}`;
        const zoom = zoomSlider.value;
        const canvasX = (centerX - panX) / zoom;
        const canvasY = (centerY - panY) / zoom;
        
        const newObjectData = {
            id: objectId,
            widthMeters: 1, // Default to 1x1 meter
            heightMeters: 1,
            x: canvasX - ((1 * scale) / 2),
            y: canvasY - ((1 * scale) / 2),
            color: '#3b82f6'
        };
        designObjects.push(newObjectData);

        const box = document.createElement('div');
        box.id = objectId;
        box.classList.add('resizable-box');
        box.style.backgroundColor = newObjectData.color;
        
        ['tl', 'tr', 'bl', 'br'].forEach(corner => {
            const handle = document.createElement('div');
            handle.classList.add('resize-handle', `handle-${corner}`);
            box.appendChild(handle);
        });

        interactiveArea.appendChild(box);
        renderObject(objectId);
        initializeObjectInteraction(box);
        selectObject(objectId);
        updateHudArea();
    }

    function renderObject(objectId) {
        const data = designObjects.find(obj => obj.id === objectId);
        const element = document.getElementById(objectId);
        if (!data || !element) return;

        element.style.width = `${data.widthMeters * scale}px`;
        element.style.height = `${data.heightMeters * scale}px`;
        element.style.transform = `translate(${data.x}px, ${data.y}px)`;
    }
    
    // NEW: Advanced area calculation for overlapping objects
    function calculateUnionArea(objectsInGroup) {
        const resolution = 20; // 20 points per meter = 5cm accuracy. Higher is more accurate but slower.
        const coveredPoints = new Set();

        objectsInGroup.forEach(obj => {
            const startX = Math.round(obj.x / scale * resolution);
            const startY = Math.round(obj.y / scale * resolution);
            const endX = Math.round((obj.x / scale + obj.widthMeters) * resolution);
            const endY = Math.round((obj.y / scale + obj.heightMeters) * resolution);

            for (let i = startX; i < endX; i++) {
                for (let j = startY; j < endY; j++) {
                    coveredPoints.add(`${i},${j}`);
                }
            }
        });

        return coveredPoints.size / (resolution * resolution);
    }

    function updateHudArea() {
        const objectsByColor = {};
        designObjects.forEach(obj => {
            if (!objectsByColor[obj.color]) {
                objectsByColor[obj.color] = [];
            }
            objectsByColor[obj.color].push(obj);
        });

        areaDisplay.innerHTML = '';
        if (Object.keys(objectsByColor).length === 0) {
            areaDisplay.innerHTML = '<p>No objects yet.</p>';
        } else {
            for (const color in objectsByColor) {
                const totalArea = calculateUnionArea(objectsByColor[color]); // Use the new function
                const p = document.createElement('p');
                p.innerHTML = `<span style="color:${color};">■</span> Total: ${totalArea.toFixed(2)} sq. m`;
                areaDisplay.appendChild(p);
            }
        }
    }
    
    function selectObject(objectId) {
        selectedObjectId = objectId;
        document.querySelectorAll('.resizable-box').forEach(box => {
            box.classList.toggle('selected', box.id === objectId);
        });
        colorPalette.classList.toggle('hidden', !objectId);
    }
    
    function initializeObjectInteraction(element) {
        interact(element)
            .resizable({
                edges: { top: '.handle-tl, .handle-tr', left: '.handle-tl, .handle-bl', bottom: '.handle-bl, .handle-br', right: '.handle-tr, .handle-br' },
                listeners: {
                    move(event) {
                        const data = designObjects.find(obj => obj.id === element.id);
                        if (!data) return;
                        
                        const zoom = zoomSlider.value;
                        data.widthMeters = event.rect.width / scale;
                        data.heightMeters = event.rect.height / scale;
                        data.x = (parseFloat(element.getAttribute('data-x')) || 0) + event.deltaRect.left / zoom;
                        data.y = (parseFloat(element.getAttribute('data-y')) || 0) + event.deltaRect.top / zoom;

                        renderObject(element.id);
                        updateHudArea();
                    },
                    start(event) {
                        const element = event.target;
                        element.setAttribute('data-x', designObjects.find(o=>o.id === element.id).x);
                        element.setAttribute('data-y', designObjects.find(o=>o.id === element.id).y);
                    }
                },
                modifiers: [ interact.modifiers.restrictEdges({ outer: document.body }) ],
                inertia: false
            })
            .draggable({
                listeners: {
                    move(event) {
                        const data = designObjects.find(obj => obj.id === element.id);
                        if (!data) return;
                        const zoom = zoomSlider.value;
                        data.x += event.dx / zoom;
                        data.y += event.dy / zoom;
                        renderObject(element.id);
                    },
                    end() {
                        updateHudArea(); // Do the expensive calculation only when drag ends
                    }
                },
                inertia: true
            })
            .on('tap', (event) => {
                selectObject(element.id);
                event.stopPropagation();
            });
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        designerPage.classList.remove('hidden');
        updateCanvasTransform(); // Initial transform and grid setup
        if (designObjects.length === 0) {
            createObject(designerPage.clientWidth / 2, designerPage.clientHeight / 2);
        }
    });

    addObjectBtn.addEventListener('click', () => {
        createObject(designerPage.clientWidth / 2, designerPage.clientHeight / 2);
    });

    scaleSlider.addEventListener('input', (event) => {
        scale = parseInt(event.target.value, 10);
        scaleValue.textContent = scale;
        designObjects.forEach(obj => renderObject(obj.id));
        updateGrid(); // Update grid when object scale changes
    });

    zoomSlider.addEventListener('input', updateCanvasTransform);

    colorPalette.addEventListener('click', (event) => {
        if (event.target.classList.contains('color-swatch') && selectedObjectId) {
            const data = designObjects.find(obj => obj.id === selectedObjectId);
            const element = document.getElementById(selectedObjectId);
            if (data && element) {
                const newColor = event.target.style.backgroundColor;
                data.color = newColor;
                element.style.backgroundColor = newColor;
                updateHudArea();
            }
        }
    });
    
    interactiveArea.addEventListener('click', (event) => {
        if (event.currentTarget === event.target) {
            selectObject(null);
        }
    });

    // PANNING FIX: Use a separate interact instance for the background
    interact(designerPage).draggable({
        context: designerPage,
        ignoreFrom: '.resizable-box, #hud', // Don't pan when interacting with objects or HUD
        listeners: {
            move(event) {
                panX += event.dx;
                panY += event.dy;
                updateCanvasTransform();
            }
        }
    });
    
    updateHudArea();
});