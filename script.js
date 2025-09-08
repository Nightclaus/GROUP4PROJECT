document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const landingPage = document.getElementById('landing-page');
    const designerPage = document.getElementById('designer-page');
    const startButton = document.getElementById('start-button');
    const interactiveArea = document.getElementById('interactive-area');
    const worldContainer = document.getElementById('world-container');
    const gridCanvas = document.getElementById('grid-canvas');
    const gridCtx = gridCanvas.getContext('2d');
    const debugLayer = document.getElementById('debug-layer');
    const addObjectBtn = document.getElementById('add-object-btn');
    const areaDisplay = document.getElementById('area-display');
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValue = document.getElementById('scale-value');
    const zoomSlider = document.getElementById('zoom-slider');
    const colorPalette = document.getElementById('color-palette');
    const unionAreaToggle = document.getElementById('union-area-toggle');
    const debugToggle = document.getElementById('debug-toggle');
    const occupancyEstimateDisplay = document.getElementById('occupancy-estimate');
    const plantCountDisplay = document.getElementById('plant-count');
    const windowCountDisplay = document.getElementById('window-count');
    const ventilationCountDisplay = document.getElementById('ventilation-count');
    const tempEstimateDisplay = document.getElementById('temp-estimate');
    const co2EstimateDisplay = document.getElementById('co2-estimate');

    // --- Application State ---
    let designObjects = [];
    let scale = 50;
    let objectCounter = 0;
    // UPDATED: From single ID to a Set for multi-select
    let selectedObjectIds = new Set();
    // NEW: Clipboard for copy-paste
    let clipboard = [];
    let panX = 0;
    let panY = 0;
    let useUnionArea = true;
    let showDebugMarkers = false;
    let markerLayers = {};

    // (Constants and Color Roles remain the same)
    const SQ_M_PER_PERSON = 2.5;
    const BASE_TEMPERATURE_C = 21.0;
    const HEAT_PER_PERSON_C = 0.15;
    const COOLING_PER_WINDOW_SQ_M_C = -0.5;
    const BASE_CO2_PPM = 420;
    const CO2_PER_PERSON_PPM = 40;
    const CO2_REDUCTION_PER_WINDOW_COUNT = -25;
    const COOLING_PER_VENT_SQ_M_C = -1.5;
    const CO2_REDUCTION_PER_VENT_SQ_M = -75;
    const CO2_REDUCTION_PER_PLANT_COUNT = -5;
    const FLOOR_PLAN_COLOR = 'rgb(128, 128, 128)';
    const PLANTS_COLOR = 'rgb(34, 197, 94)';
    const VENTILATION_COLOR = 'rgb(168, 85, 247)';
    const WINDOW_COLOR = 'rgb(239, 68, 68)';

    // --- Core Functions ---

    function updateWorldTransform() {
        const zoom = zoomSlider.value;
        worldContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function updateGrid() {
        const gridSize = scale;
        const canvasSize = 4000;
        gridCanvas.width = canvasSize;
        gridCanvas.height = canvasSize;
        gridCtx.clearRect(0, 0, canvasSize, canvasSize);
        gridCtx.strokeStyle = '#e0e0e0';
        gridCtx.lineWidth = 1;
        for (let x = 0; x <= canvasSize; x += gridSize) {
            gridCtx.beginPath();
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, canvasSize);
            gridCtx.stroke();
        }
        for (let y = 0; y <= canvasSize; y += gridSize) {
            gridCtx.beginPath();
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(canvasSize, y);
            gridCtx.stroke();
        }
    }

    // REFACTORED: Creates only the DOM element for an object
    function createObjectElement(data) {
        const box = document.createElement('div');
        box.id = data.id;
        box.classList.add('resizable-box');
        box.style.backgroundColor = data.color;

        ['tl', 'tr', 'bl', 'br'].forEach(c => {
            box.appendChild(Object.assign(document.createElement('div'), { className: `resize-handle handle-${c}` }));
        });

        worldContainer.insertBefore(box, debugLayer);
        renderObject(data.id);
        initializeObjectInteraction(box);
        return box;
    }

    function createObject(centerX, centerY) {
        objectCounter++;
        const objectId = `obj-${objectCounter}`;
        const zoom = zoomSlider.value;
        const worldX = (centerX - panX) / zoom;
        const worldY = (centerY - panY) / zoom;
        const defaultColor = designObjects.length === 0 ? FLOOR_PLAN_COLOR : PLANTS_COLOR;

        const newObjectData = { id: objectId, widthMeters: 1, heightMeters: 1, x: worldX - (scale / 2), y: worldY - (scale / 2), color: defaultColor };
        designObjects.push(newObjectData);

        createObjectElement(newObjectData);
        // NEW: Select the newly created object
        handleObjectSelection(objectId, false);
        updateHudArea();
    }
    
    // UPDATED: Now deletes all selected objects
    function deleteSelectedObjects() {
        if (selectedObjectIds.size === 0) return;

        // Remove from DOM and data array
        selectedObjectIds.forEach(id => {
            const elementToRemove = document.getElementById(id);
            if (elementToRemove) elementToRemove.remove();
        });
        designObjects = designObjects.filter(obj => !selectedObjectIds.has(obj.id));

        // Clear selection and update
        handleObjectSelection(null, false);
        updateHudArea();
    }

    // ... renderObject, updateHudArea, and calculation functions remain the same ...
    function renderObject(objectId) { const data = designObjects.find(obj => obj.id === objectId); const element = document.getElementById(objectId); if (!data || !element) return; element.style.width = `${data.widthMeters * scale}px`; element.style.height = `${data.heightMeters * scale}px`; element.style.transform = `translate(${data.x}px, ${data.y}px)`; }
    function updateHudArea() { const objectsByColor = {}; designObjects.forEach(obj => { if (!objectsByColor[obj.color]) { objectsByColor[obj.color] = []; } objectsByColor[obj.color].push(obj); }); debugLayer.innerHTML = ''; markerLayers = {}; areaDisplay.innerHTML = ''; if (Object.keys(objectsByColor).length === 0) { areaDisplay.innerHTML = '<p>No objects yet.</p>'; occupancyEstimateDisplay.textContent = '0'; plantCountDisplay.textContent = '0'; windowCountDisplay.textContent = '0'; ventilationCountDisplay.textContent = '0'; tempEstimateDisplay.textContent = '--'; co2EstimateDisplay.textContent = '--'; return; } let totalFloorArea = 0; let plantCount = 0; let windowCount = 0; let totalWindowArea = 0; let ventilationCount = 0; let totalVentilationArea = 0; for (const color in objectsByColor) { let totalArea = 0; const objectsInGroup = objectsByColor[color]; let groupName = 'Object'; if (color === FLOOR_PLAN_COLOR) groupName = 'Floor Plan'; if (color === PLANTS_COLOR) groupName = 'Plants'; if (color === WINDOW_COLOR) groupName = 'Windows'; if (color === VENTILATION_COLOR) groupName = 'Ventilation'; if (useUnionArea) { const { area, points } = calculateUnionArea(objectsInGroup); totalArea = area; if (showDebugMarkers) drawDebugMarkers(points, color); } else { totalArea = calculateSumArea(objectsInGroup); } if (color === FLOOR_PLAN_COLOR) totalFloorArea = totalArea; if (color === PLANTS_COLOR) plantCount = objectsInGroup.length; if (color === WINDOW_COLOR) { windowCount = objectsInGroup.length; totalWindowArea = totalArea; } if (color === VENTILATION_COLOR) { ventilationCount = objectsInGroup.length; totalVentilationArea = totalArea; } const p = document.createElement('p'); p.innerHTML = `<span style="color:${color};">■</span> ${groupName}: ${totalArea.toFixed(2)} sq. m`; areaDisplay.appendChild(p); } const maxOccupancy = totalFloorArea > 0 ? Math.floor(totalFloorArea / SQ_M_PER_PERSON) : 0; let estimatedTemp = BASE_TEMPERATURE_C; let estimatedCO2 = BASE_CO2_PPM; if (maxOccupancy > 0) { estimatedTemp += (maxOccupancy * HEAT_PER_PERSON_C) + (totalWindowArea * COOLING_PER_WINDOW_SQ_M_C) + (totalVentilationArea * COOLING_PER_VENT_SQ_M_C); estimatedCO2 += (maxOccupancy * CO2_PER_PERSON_PPM) + (windowCount * CO2_REDUCTION_PER_WINDOW_COUNT) + (totalVentilationArea * CO2_REDUCTION_PER_VENT_SQ_M) + (plantCount * CO2_REDUCTION_PER_PLANT_COUNT); } estimatedCO2 = Math.max(BASE_CO2_PPM, estimatedCO2); occupancyEstimateDisplay.textContent = `${maxOccupancy}`; plantCountDisplay.textContent = `${plantCount}`; windowCountDisplay.textContent = `${windowCount}`; ventilationCountDisplay.textContent = `${ventilationCount}`; if (totalFloorArea > 0) { tempEstimateDisplay.textContent = `${estimatedTemp.toFixed(1)}`; co2EstimateDisplay.textContent = `${Math.round(estimatedCO2)}`; } else { tempEstimateDisplay.textContent = '--'; co2EstimateDisplay.textContent = '--'; } }
    function calculateSumArea(objectsInGroup) { return objectsInGroup.reduce((sum, obj) => sum + (obj.widthMeters * obj.heightMeters), 0); }
    function calculateUnionArea(objectsInGroup) { const resolution = 20; const coveredPoints = new Set(); objectsInGroup.forEach(obj => { const startX = Math.round(obj.x / scale * resolution); const startY = Math.round(obj.y / scale * resolution); const endX = Math.round((obj.x / scale + obj.widthMeters) * resolution); const endY = Math.round((obj.y / scale + obj.heightMeters) * resolution); for (let i = startX; i < endX; i++) { for (let j = startY; j < endY; j++) { coveredPoints.add(`${i},${j}`); } } }); const area = coveredPoints.size / (resolution * resolution); return { area, points: coveredPoints }; }
    function drawDebugMarkers(points, color) { let layer = markerLayers[color]; if (!layer) { layer = document.createElement('div'); debugLayer.appendChild(layer); markerLayers[color] = layer; } const resolution = 20; const fragment = document.createDocumentFragment(); points.forEach(pointString => { const [i, j] = pointString.split(',').map(Number); const marker = document.createElement('div'); marker.className = 'debug-marker'; marker.style.backgroundColor = color; marker.style.left = `${(i / resolution) * scale}px`; marker.style.top = `${(j / resolution) * scale}px`; fragment.appendChild(marker); }); layer.appendChild(fragment); }

    // REWRITTEN: Manages single and multi-selection logic.
    function handleObjectSelection(objectId, isShiftPressed) {
        if (isShiftPressed) {
            if (selectedObjectIds.has(objectId)) {
                selectedObjectIds.delete(objectId); // Deselect if already selected
            } else {
                selectedObjectIds.add(objectId); // Add to selection
            }
        } else {
            selectedObjectIds.clear(); // Clear previous selection
            if (objectId) {
                selectedObjectIds.add(objectId); // Select the new object
            }
        }
        updateSelectionVisuals();
    }

    // NEW: Central function to update the .selected class on objects
    function updateSelectionVisuals() {
        document.querySelectorAll('.resizable-box').forEach(box => {
            box.classList.toggle('selected', selectedObjectIds.has(box.id));
        });
        colorPalette.classList.toggle('hidden', selectedObjectIds.size === 0);
    }
    
    function initializeObjectInteraction(element) {
        // ... listeners inside interactjs remain the same ...
        const startListener = () => { const data = designObjects.find(obj => obj.id === element.id); if (!data) return; const color = data.color; if (markerLayers[color]) { markerLayers[color].innerHTML = ''; } }; const endListener = () => { updateHudArea(); };
        interact(element) .resizable({ edges: { top: '.handle-tl, .handle-tr', left: '.handle-tl, .handle-bl', bottom: '.handle-bl, .handle-br', right: '.handle-tr, .handle-br' }, listeners: { start: startListener, move(event) { const data = designObjects.find(obj => obj.id === element.id); if (!data) return; data.widthMeters = event.rect.width / scale; data.heightMeters = event.rect.height / scale; data.x += event.deltaRect.left; data.y += event.deltaRect.top; renderObject(element.id); }, end: endListener }, modifiers: [interact.modifiers.restrictEdges({ outer: worldContainer })], inertia: false }) .draggable({ listeners: { start: startListener, move(event) { const data = designObjects.find(obj => obj.id === element.id); if (!data) return; const zoom = zoomSlider.value; data.x += event.dx / zoom; data.y += event.dy / zoom; renderObject(element.id); }, end: endListener }, inertia: true })
            // UPDATED: 'tap' event now checks for the shift key
            .on('tap', (event) => {
                handleObjectSelection(element.id, event.shiftKey);
                event.stopPropagation();
            });
    }

    // --- Event Listeners ---
    const panEvents = { start: () => { debugLayer.innerHTML = ''; }, move(event) { panX += event.dx; panY += event.dy; updateWorldTransform(); }, end: updateHudArea };
    startButton.addEventListener('click', () => { landingPage.classList.add('hidden'); designerPage.classList.remove('hidden'); updateGrid(); updateWorldTransform(); if (designObjects.length === 0) { createObject(designerPage.clientWidth / 2, designerPage.clientHeight / 2); } });
    addObjectBtn.addEventListener('click', () => { createObject(designerPage.clientWidth / 2, designerPage.clientHeight / 2); });
    scaleSlider.addEventListener('input', (event) => { scale = parseInt(event.target.value, 10); scaleValue.textContent = scale; updateGrid(); designObjects.forEach(obj => renderObject(obj.id)); updateHudArea(); });
    zoomSlider.addEventListener('input', updateWorldTransform);
    
    // UPDATED: Color change applies to all selected objects
    colorPalette.addEventListener('click', (event) => {
        if (event.target.classList.contains('color-swatch') && selectedObjectIds.size > 0) {
            const newColor = event.target.style.backgroundColor;
            selectedObjectIds.forEach(id => {
                const data = designObjects.find(obj => obj.id === id);
                const element = document.getElementById(id);
                if (data && element) {
                    data.color = element.style.backgroundColor = newColor;
                }
            });
            updateHudArea();
        }
    });

    interactiveArea.addEventListener('click', (event) => {
        if (event.target.id === 'world-container' || event.target.id === 'interactive-area') {
            handleObjectSelection(null, false); // Deselect all
        }
    });
    interact(interactiveArea).draggable({ ignoreFrom: '.resizable-box, #hud', listeners: panEvents });
    unionAreaToggle.addEventListener('change', (event) => { useUnionArea = event.target.checked; updateHudArea(); });
    debugToggle.addEventListener('change', (event) => { showDebugMarkers = event.target.checked; debugLayer.style.display = showDebugMarkers ? 'block' : 'none'; updateHudArea(); });

    // NEW: Keyboard listener for Copy, Paste, and Delete
    document.addEventListener('keydown', (event) => {
        // Ignore if typing in an input field in the future
        if (event.target.tagName === 'INPUT') return;

        const isCtrlOrCmd = event.ctrlKey || event.metaKey;

        if (isCtrlOrCmd && event.key === 'c') { // --- COPY ---
            event.preventDefault();
            clipboard = [];
            selectedObjectIds.forEach(id => {
                const data = designObjects.find(obj => obj.id === id);
                if (data) clipboard.push({ ...data }); // Store a copy
            });
        }

        if (isCtrlOrCmd && event.key === 'v') { // --- PASTE ---
            event.preventDefault();
            if (clipboard.length === 0) return;

            const newIds = new Set();
            clipboard.forEach(copiedData => {
                objectCounter++;
                const newId = `obj-${objectCounter}`;
                newIds.add(newId);

                const newData = {
                    ...copiedData,
                    id: newId,
                    x: copiedData.x + 20, // Add a small offset
                    y: copiedData.y + 20,
                };
                designObjects.push(newData);
                createObjectElement(newData);
            });

            // Select the newly pasted objects
            selectedObjectIds = newIds;
            updateSelectionVisuals();
            updateHudArea();
        }
        
        if (event.key === 'Delete' || event.key === 'Backspace') { // --- DELETE ---
            event.preventDefault();
            deleteSelectedObjects();
        }
    });

    // Initial call
    updateHudArea();
});