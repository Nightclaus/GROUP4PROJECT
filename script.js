document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const landingPage = document.getElementById('landing-page');
    const designerPage = document.getElementById('designer-page');
    const startButton = document.getElementById('start-button');
    const interactiveArea = document.getElementById('interactive-area');
    const debugLayer = document.getElementById('debug-layer');
    const addObjectBtn = document.getElementById('add-object-btn');
    const areaDisplay = document.getElementById('area-display');
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValue = document.getElementById('scale-value');
    const zoomSlider = document.getElementById('zoom-slider');
    const colorPalette = document.getElementById('color-palette');
    const unionAreaToggle = document.getElementById('union-area-toggle');
    const debugToggle = document.getElementById('debug-toggle');

    // --- Application State ---
    let designObjects = [];
    let scale = 50;
    let objectCounter = 0;
    let selectedObjectId = null;
    let panX = 0;
    let panY = 0;
    // NEW: State for toggles
    let useUnionArea = true;
    let showDebugMarkers = false;

    // --- Core Functions ---

    function updateCanvasTransform() {
        const zoom = zoomSlider.value;
        interactiveArea.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        updateGrid();
    }
    
    function updateGrid() {
        const zoom = zoomSlider.value;
        const gridSize = scale * zoom;
        interactiveArea.style.backgroundImage = `
            linear-gradient(to right, #e0e0e0 1px, transparent 1px),
            linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
        `;
        interactiveArea.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    }

    function createObject(centerX, centerY) {
        objectCounter++;
        const objectId = `obj-${objectCounter}`;
        const zoom = zoomSlider.value;
        const canvasX = (centerX - panX) / zoom;
        const canvasY = (centerY - panY) / zoom;
        
        const newObjectData = { id: objectId, widthMeters: 1, heightMeters: 1, x: canvasX - (scale / 2), y: canvasY - (scale / 2), color: '#3b82f6' };
        designObjects.push(newObjectData);

        const box = document.createElement('div');
        box.id = objectId;
        box.classList.add('resizable-box');
        box.style.backgroundColor = newObjectData.color;
        
        ['tl', 'tr', 'bl', 'br'].forEach(c => { box.appendChild(Object.assign(document.createElement('div'), { className: `resize-handle handle-${c}` })); });

        interactiveArea.insertBefore(box, debugLayer); // Add box before the debug layer
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
    
    // REVISED: This function is now the master controller for area display
    function updateHudArea() {
        const objectsByColor = {};
        designObjects.forEach(obj => {
            if (!objectsByColor[obj.color]) objectsByColor[obj.color] = [];
            objectsByColor[obj.color].push(obj);
        });

        clearDebugMarkers();
        areaDisplay.innerHTML = '';
        if (Object.keys(objectsByColor).length === 0) {
            areaDisplay.innerHTML = '<p>No objects yet.</p>';
            return;
        }

        for (const color in objectsByColor) {
            let totalArea = 0;
            const objectsInGroup = objectsByColor[color];

            if (useUnionArea) {
                const { area, points } = calculateUnionArea(objectsInGroup);
                totalArea = area;
                if (showDebugMarkers) {
                    drawDebugMarkers(points);
                }
            } else {
                totalArea = calculateSumArea(objectsInGroup);
            }

            const p = document.createElement('p');
            p.innerHTML = `<span style="color:${color};">■</span> Total: ${totalArea.toFixed(2)} sq. m`;
            areaDisplay.appendChild(p);
        }
    }

    // NEW: Simple sum calculation
    function calculateSumArea(objectsInGroup) {
        return objectsInGroup.reduce((sum, obj) => sum + (obj.widthMeters * obj.heightMeters), 0);
    }

    // REVISED: Returns both area and the points for debugging
    function calculateUnionArea(objectsInGroup) {
        const resolution = 20; // 5cm accuracy
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
        const area = coveredPoints.size / (resolution * resolution);
        return { area, points: coveredPoints };
    }

    // NEW: Functions to draw and clear the debug markers
    function drawDebugMarkers(points) {
        const resolution = 20;
        const fragment = document.createDocumentFragment();
        points.forEach(pointString => {
            const [i, j] = pointString.split(',').map(Number);
            const marker = document.createElement('div');
            marker.className = 'debug-marker';
            marker.style.left = `${(i / resolution) * scale}px`;
            marker.style.top = `${(j / resolution) * scale}px`;
            fragment.appendChild(marker);
        });
        debugLayer.appendChild(fragment);
    }
    function clearDebugMarkers() {
        debugLayer.innerHTML = '';
    }
    
    function selectObject(objectId) {
        selectedObjectId = objectId;
        document.querySelectorAll('.resizable-box').forEach(box => box.classList.toggle('selected', box.id === objectId));
        colorPalette.classList.toggle('hidden', !objectId);
    }
    
    function initializeObjectInteraction(element) {
        interact(element).resizable({/*...same as before...*/}).draggable({/*...same as before...*/})
        .resizable({
                edges: { top: '.handle-tl, .handle-tr', left: '.handle-tl, .handle-bl', bottom: '.handle-bl, .handle-br', right: '.handle-tr, .handle-br' },
                listeners: {
                    move(event) {
                        const data = designObjects.find(obj => obj.id === element.id); if (!data) return;
                        data.widthMeters = event.rect.width / scale; data.heightMeters = event.rect.height / scale;
                        data.x += event.deltaRect.left; data.y += event.deltaRect.top;
                        renderObject(element.id);
                    },
                    end() { updateHudArea(); }
                },
                modifiers: [ interact.modifiers.restrictEdges({ outer: document.body }) ], inertia: false
            })
            .draggable({
                listeners: {
                    move(event) {
                        const data = designObjects.find(obj => obj.id === element.id); if (!data) return;
                        const zoom = zoomSlider.value;
                        data.x += event.dx / zoom; data.y += event.dy / zoom;
                        renderObject(element.id);
                    },
                    end() { updateHudArea(); }
                }, inertia: true
            })
            .on('tap', (event) => { selectObject(element.id); event.stopPropagation(); });
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', () => {
        landingPage.classList.add('hidden'); designerPage.classList.remove('hidden');
        updateCanvasTransform();
        if (designObjects.length === 0) createObject(designerPage.clientWidth / 2, designerPage.clientHeight / 2);
    });

    addObjectBtn.addEventListener('click', () => createObject(designerPage.clientWidth / 2, designerPage.clientHeight / 2));

    scaleSlider.addEventListener('input', (event) => {
        scale = parseInt(event.target.value, 10); scaleValue.textContent = scale;
        designObjects.forEach(obj => renderObject(obj.id));
        updateGrid(); updateHudArea();
    });

    zoomSlider.addEventListener('input', updateCanvasTransform);

    colorPalette.addEventListener('click', (event) => {
        if (event.target.classList.contains('color-swatch') && selectedObjectId) {
            const data = designObjects.find(obj => obj.id === selectedObjectId);
            const element = document.getElementById(selectedObjectId);
            if (data && element) {
                data.color = element.style.backgroundColor = event.target.style.backgroundColor;
                updateHudArea();
            }
        }
    });
    
    interactiveArea.addEventListener('click', (event) => { if (event.currentTarget === event.target) selectObject(null); });

    interact(designerPage).draggable({
        context: designerPage, ignoreFrom: '.resizable-box, #hud',
        listeners: { move(event) { panX += event.dx; panY += event.dy; updateCanvasTransform(); } }
    });
    
    // NEW: Listeners for the toggles
    unionAreaToggle.addEventListener('change', (event) => {
        useUnionArea = event.target.checked;
        updateHudArea();
    });
    debugToggle.addEventListener('change', (event) => {
        showDebugMarkers = event.target.checked;
        updateHudArea();
    });
    
    updateHudArea();
});