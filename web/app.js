// ===== Config =====
const ROOM_MIN_SIZE = 60;
const ROOM_DEFAULT_SIZE = 100;
const OBJECT_MIN_SIZE = 40;
const OBJECT_DEFAULT_WIDTH = 76;
const OBJECT_DEFAULT_HEIGHT = 56;
const PERSON_SIZE = 32;
const HANDLE_SIZE = 10;
const CONFIG_SCHEMA = 'yijing-fengshui-builder';
const CONFIG_SCHEMA_VERSION = 1;
const FLOOR_LABELS = ['一樓', '二樓', '三樓', '四樓', '五樓', '六樓', '七樓', '八樓', '九樓', '十樓'];

const COLORS = {
    room: { fill: 'rgba(159, 74, 223, 0.3)', stroke: '#9f4adf' },
    facility: { fill: 'rgba(223, 159, 74, 0.3)', stroke: '#df9f4a' },
    bedroom: { fill: 'rgba(74, 159, 223, 0.2)', stroke: '#4a9fdf' },
    object: { fill: 'rgba(74, 222, 128, 0.22)', stroke: '#4ade80' }
};

// ===== State =====
let floors = [createFloor('一樓')];
let activeFloorIndex = 0;
let rooms = floors[0].rooms;
let persons = floors[0].persons;
let selectedRoom = null;
let selectedRooms = new Set();
let selectedPerson = null;
let dragMode = null; // 'move-room', 'resize', 'rotate', 'move-person'
let dragStart = { x: 0, y: 0 };
let originalState = null;
let compassRotation = floors[0].compassRotation; // in degrees, 0 = north up

// ===== Canvas Setup =====
const canvas = document.getElementById('floorCanvas');
const ctx = canvas.getContext('2d');
const floorTabs = document.getElementById('floorTabs');
const canvasTitle = document.getElementById('canvasTitle');
const compass = document.getElementById('compass');
const compassInner = document.getElementById('compassInner');

function createFloor(name) {
    return {
        id: `floor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        rooms: [],
        persons: [],
        compassRotation: 0
    };
}

function getActiveFloor() {
    return floors[activeFloorIndex];
}

function refreshActiveCollections() {
    const floor = getActiveFloor();
    rooms = floor.rooms;
    persons = floor.persons;
    compassRotation = floor.compassRotation || 0;
    updateCompassVisual();
}

function saveActiveCompass() {
    getActiveFloor().compassRotation = compassRotation;
}

function getNextFloorName() {
    return FLOOR_LABELS[floors.length] || `${floors.length + 1}樓`;
}

function hidePromptOutput() {
    document.getElementById('promptOutput').classList.remove('show');
    document.getElementById('copyBtn').classList.remove('show');
}

function updateCompassVisual() {
    if (compassInner) {
        compassInner.style.transform = `rotate(${compassRotation}deg)`;
    }
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
}

window.addEventListener('resize', resizeCanvas);

// ===== Floor Controls =====
function renderFloorTabs() {
    floorTabs.innerHTML = floors.map((floor, index) => `
        <button class="floor-tab ${index === activeFloorIndex ? 'active' : ''}" type="button" data-index="${index}">
            ${floor.name}
        </button>
    `).join('');

    floorTabs.querySelectorAll('.floor-tab').forEach(tab => {
        tab.addEventListener('click', () => switchFloor(Number(tab.dataset.index)));
    });

    canvasTitle.textContent = `📐 ${getActiveFloor().name} 平面圖（上方為北）`;
}

function switchFloor(index) {
    if (index === activeFloorIndex || !floors[index]) return;

    saveActiveCompass();
    activeFloorIndex = index;
    clearEntitySelection();
    selectedPerson = null;
    dragMode = null;
    refreshActiveCollections();
    renderFloorTabs();
    draw();
    updateConfigList();
}

document.getElementById('addFloor').addEventListener('click', () => {
    saveActiveCompass();
    floors.push(createFloor(getNextFloorName()));
    activeFloorIndex = floors.length - 1;
    clearEntitySelection();
    selectedPerson = null;
    refreshActiveCollections();
    renderFloorTabs();
    draw();
    updateConfigList();
});

document.getElementById('deleteFloor').addEventListener('click', () => {
    if (floors.length === 1) {
        showToast('至少需要保留一個樓層');
        return;
    }

    floors.splice(activeFloorIndex, 1);
    activeFloorIndex = Math.max(0, activeFloorIndex - 1);
    clearEntitySelection();
    selectedPerson = null;
    refreshActiveCollections();
    renderFloorTabs();
    draw();
    updateConfigList();
});

// ===== Utility =====
function isBedroom(value) {
    return value.includes('臥室') || value === '主臥室';
}

function getDirection(x, y, w, h, rotation = compassRotation) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const objCenterX = x + w / 2;
    const objCenterY = y + h / 2;

    const dx = objCenterX - centerX;
    const dy = objCenterY - centerY;

    const threshold = 50;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return '中央';

    // Calculate angle and adjust for compass rotation
    let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
    angle = angle - rotation;

    // Normalize angle to -180 to 180
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;

    if (angle >= -22.5 && angle < 22.5) return '東';
    if (angle >= 22.5 && angle < 67.5) return '東北';
    if (angle >= 67.5 && angle < 112.5) return '北';
    if (angle >= 112.5 && angle < 157.5) return '西北';
    if (angle >= 157.5 || angle < -157.5) return '西';
    if (angle >= -157.5 && angle < -112.5) return '西南';
    if (angle >= -112.5 && angle < -67.5) return '南';
    if (angle >= -67.5 && angle < -22.5) return '東南';

    return '中央';
}

function getEntityCenter(entity) {
    return {
        x: entity.x + entity.w / 2,
        y: entity.y + entity.h / 2
    };
}

function isInsideRoom(px, py, room) {
    // Simple rectangle check (ignoring rotation for now)
    return px >= room.x && px <= room.x + room.w &&
        py >= room.y && py <= room.y + room.h;
}

function findBedroomAt(x, y, floor = getActiveFloor()) {
    for (let i = floor.rooms.length - 1; i >= 0; i--) {
        if (isBedroom(floor.rooms[i].value) && isInsideRoom(x, y, floor.rooms[i])) {
            return floor.rooms[i];
        }
    }
    return null;
}

function findContainingSpace(entity, floor = getActiveFloor()) {
    const center = getEntityCenter(entity);

    for (let i = floor.rooms.length - 1; i >= 0; i--) {
        const candidate = floor.rooms[i];
        if (candidate === entity || candidate.type === 'object') continue;
        if (isInsideRoom(center.x, center.y, candidate)) {
            return candidate;
        }
    }

    return null;
}

function getEntityColors(entity) {
    if (isBedroom(entity.value)) return COLORS.bedroom;
    return COLORS[entity.type] || COLORS.room;
}

function removePersonFromAllFloors(value) {
    floors.forEach(floor => {
        floor.persons = floor.persons.filter(p => p.value !== value);
    });
    refreshActiveCollections();
}

function removeEntityAt(index) {
    rooms.splice(index, 1);
    persons = persons
        .filter(p => p.bedroomId !== index)
        .map(p => p.bedroomId > index ? { ...p, bedroomId: p.bedroomId - 1 } : p);
    getActiveFloor().persons = persons;
    clearEntitySelection();
    selectedPerson = null;
}

function clearEntitySelection() {
    selectedRoom = null;
    selectedRooms.clear();
}

function selectSingleEntity(index) {
    selectedRooms.clear();
    selectedRooms.add(index);
    selectedRoom = index;
}

function toggleEntitySelection(index) {
    if (selectedRooms.has(index)) {
        selectedRooms.delete(index);
        selectedRoom = selectedRooms.size > 0 ? [...selectedRooms][selectedRooms.size - 1] : null;
        return;
    }

    selectedRooms.add(index);
    selectedRoom = index;
}

function isEntitySelected(index) {
    return selectedRooms.has(index);
}

function getSelectedEntityIndexes() {
    return [...selectedRooms].filter(index => rooms[index]);
}

function startEntityMove(index, x, y) {
    selectedRoom = index;
    dragMode = 'move-room';
    dragStart = { x, y };
    originalState = {
        entities: getSelectedEntityIndexes().map(entityIndex => ({
            index: entityIndex,
            x: rooms[entityIndex].x,
            y: rooms[entityIndex].y
        }))
    };
}

// ===== Save / Load Config =====
function cloneEntity(entity) {
    return {
        type: entity.type || 'room',
        value: entity.value || '',
        icon: entity.icon || '',
        x: Number(entity.x) || 0,
        y: Number(entity.y) || 0,
        w: Number(entity.w) || ROOM_DEFAULT_SIZE,
        h: Number(entity.h) || ROOM_DEFAULT_SIZE,
        rotation: Number(entity.rotation) || 0
    };
}

function clonePerson(person) {
    return {
        value: person.value || '',
        icon: person.icon || '',
        bedroomId: Number(person.bedroomId) || 0,
        offsetX: Number(person.offsetX) || 0,
        offsetY: Number(person.offsetY) || 0
    };
}

function createConfigPayload() {
    saveActiveCompass();
    return {
        schema: CONFIG_SCHEMA,
        version: CONFIG_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        activeFloorIndex,
        floors: floors.map((floor, index) => ({
            name: floor.name || FLOOR_LABELS[index] || `${index + 1}樓`,
            compassRotation: Number(floor.compassRotation) || 0,
            rooms: floor.rooms.map(cloneEntity),
            persons: floor.persons.map(clonePerson)
        }))
    };
}

function getConfigFileName() {
    const stamp = new Date().toISOString().slice(0, 10);
    return `yijing-fengshui-layout-${stamp}.json`;
}

function downloadConfig(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getConfigFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function normalizeEntity(entity) {
    const type = ['room', 'facility', 'object'].includes(entity.type) ? entity.type : 'room';
    const isObject = type === 'object';
    return {
        type,
        value: String(entity.value || ''),
        icon: String(entity.icon || ''),
        x: Number.isFinite(Number(entity.x)) ? Number(entity.x) : 100,
        y: Number.isFinite(Number(entity.y)) ? Number(entity.y) : 100,
        w: Math.max(isObject ? OBJECT_MIN_SIZE : ROOM_MIN_SIZE, Number(entity.w) || (isObject ? OBJECT_DEFAULT_WIDTH : ROOM_DEFAULT_SIZE)),
        h: Math.max(isObject ? OBJECT_MIN_SIZE : ROOM_MIN_SIZE, Number(entity.h) || (isObject ? OBJECT_DEFAULT_HEIGHT : ROOM_DEFAULT_SIZE)),
        rotation: Number.isFinite(Number(entity.rotation)) ? Number(entity.rotation) : 0
    };
}

function normalizePerson(person, roomCount) {
    const bedroomId = Number(person.bedroomId);
    return {
        value: String(person.value || ''),
        icon: String(person.icon || ''),
        bedroomId: Math.min(Math.max(Number.isFinite(bedroomId) ? bedroomId : 0, 0), Math.max(0, roomCount - 1)),
        offsetX: Number.isFinite(Number(person.offsetX)) ? Number(person.offsetX) : 0,
        offsetY: Number.isFinite(Number(person.offsetY)) ? Number(person.offsetY) : 0
    };
}

function normalizeImportedFloors(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.floors)) return data.floors;

    // Backward compatibility for a future/handmade single-floor file.
    if (Array.isArray(data.rooms) || Array.isArray(data.persons)) {
        return [{
            name: data.name || '一樓',
            rooms: data.rooms || [],
            persons: data.persons || [],
            compassRotation: data.compassRotation || 0
        }];
    }

    throw new Error('找不到 floors / rooms 配置資料');
}

function loadConfigData(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('配置檔格式不正確');
    }

    if (data.schema && data.schema !== CONFIG_SCHEMA) {
        throw new Error('這不是易經陽宅風水平面圖配置檔');
    }

    const importedFloors = normalizeImportedFloors(data)
        .map((floor, index) => {
            const normalizedRooms = Array.isArray(floor.rooms) ? floor.rooms.map(normalizeEntity) : [];
            return {
                id: `floor-${Date.now()}-${index}`,
                name: String(floor.name || FLOOR_LABELS[index] || `${index + 1}樓`),
                rooms: normalizedRooms,
                persons: Array.isArray(floor.persons)
                    ? floor.persons
                        .map(person => normalizePerson(person, normalizedRooms.length))
                        .filter(person => normalizedRooms[person.bedroomId] && isBedroom(normalizedRooms[person.bedroomId].value))
                    : [],
                compassRotation: Number.isFinite(Number(floor.compassRotation)) ? Number(floor.compassRotation) : 0
            };
        })
        .filter(floor => floor.rooms.length > 0 || floor.persons.length > 0 || floor.name);

    if (importedFloors.length === 0) {
        throw new Error('配置檔沒有可用樓層');
    }

    floors = importedFloors;
    activeFloorIndex = Math.min(Math.max(Number(data.activeFloorIndex) || 0, 0), floors.length - 1);
    clearEntitySelection();
    selectedPerson = null;
    dragMode = null;
    refreshActiveCollections();
    renderFloorTabs();
    draw();
    updateConfigList();
    hidePromptOutput();
}

document.getElementById('saveConfig').addEventListener('click', () => {
    downloadConfig(createConfigPayload());
    showToast('✅ 配置已保存為 JSON 檔');
});

document.getElementById('loadConfig').addEventListener('click', () => {
    document.getElementById('loadConfigInput').click();
});

document.getElementById('loadConfigInput').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            loadConfigData(data);
            showToast('✅ 配置已導入，可繼續修改');
        } catch (error) {
            showToast(`⚠️ 導入失敗：${error.message}`);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = () => {
        showToast('⚠️ 無法讀取配置檔');
        event.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
});

// ===== Drawing =====
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Center crosshair
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.3)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw rooms, facilities and objects
    rooms.forEach((room, idx) => {
        ctx.save();

        const cx = room.x + room.w / 2;
        const cy = room.y + room.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(room.rotation || 0);
        ctx.translate(-cx, -cy);

        const colors = getEntityColors(room);

        // Fill
        ctx.fillStyle = colors.fill;
        ctx.fillRect(room.x, room.y, room.w, room.h);

        // Border
        const isSelected = isEntitySelected(idx);
        ctx.strokeStyle = isSelected ? '#fff' : colors.stroke;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(room.x, room.y, room.w, room.h);

        // Icon & Label
        ctx.fillStyle = '#fff';
        ctx.font = room.type === 'object' ? '18px Arial' : '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(room.icon, cx, cy - 5);

        ctx.font = room.type === 'object' ? 'bold 10px Arial' : 'bold 11px Arial';
        ctx.fillText(room.value, cx, cy + 15);

        // Direction
        const dir = getDirection(room.x, room.y, room.w, room.h);
        ctx.fillStyle = 'rgba(201, 162, 39, 0.9)';
        ctx.font = '9px Arial';
        ctx.fillText(dir, cx, room.y + room.h - 5);

        ctx.restore();

        // Resize handle (when selected)
        if (selectedRoom === idx && selectedRooms.size <= 1) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(room.x + room.w - HANDLE_SIZE, room.y + room.h - HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE);

            // Rotate handle
            ctx.beginPath();
            ctx.arc(room.x + room.w / 2, room.y - 15, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#c9a227';
            ctx.fill();
        }
    });

    // Draw persons (positioned relative to their bedroom)
    persons.forEach((person, idx) => {
        const bedroom = rooms[person.bedroomId];
        if (!bedroom) return;

        // Calculate position from bedroom center + offset
        const px = bedroom.x + bedroom.w / 2 + (person.offsetX || 0);
        const py = bedroom.y + bedroom.h / 2 + (person.offsetY || 0);

        ctx.font = '22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(person.icon, px, py);

        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = selectedPerson === idx ? '#fff' : '#4a9fdf';
        ctx.fillText(person.value, px, py + 16);
    });
}

// ===== Toolbox: Drag & Click =====
function addItemToCanvas(type, value, icon, targetX, targetY) {
    if (type === 'person') {
        // Check if dropped on a bedroom
        const bedroom = findBedroomAt(targetX, targetY);
        if (bedroom) {
            const bedroomIdx = rooms.indexOf(bedroom);
            removePersonFromAllFloors(value);

            // Store as offset from bedroom center (fixed position)
            const personsInRoom = persons.filter(p => p.bedroomId === bedroomIdx).length;
            const offsetX = (personsInRoom % 2) * 30 - 15;
            const offsetY = Math.floor(personsInRoom / 2) * 25;
            persons.push({
                value,
                icon,
                bedroomId: bedroomIdx,
                offsetX: offsetX,
                offsetY: offsetY
            });
        } else {
            showToast('⚠️ 家人只能放入臥室！');
            return false;
        }
    } else {
        const isObject = type === 'object';
        const defaultW = isObject ? OBJECT_DEFAULT_WIDTH : ROOM_DEFAULT_SIZE;
        const defaultH = isObject ? OBJECT_DEFAULT_HEIGHT : ROOM_DEFAULT_SIZE;
        const minX = 80 + defaultW / 2;
        const minY = 80 + defaultH / 2;
        const maxX = Math.max(minX, canvas.width - defaultW);
        const maxY = Math.max(minY, canvas.height - defaultH);
        const spawnX = typeof targetX === 'number' ? targetX : (minX + Math.random() * (maxX - minX));
        const spawnY = typeof targetY === 'number' ? targetY : (minY + Math.random() * (maxY - minY));

        rooms.push({
            type,
            value,
            icon,
            x: spawnX - defaultW / 2,
            y: spawnY - defaultH / 2,
            w: defaultW,
            h: defaultH,
            rotation: 0
        });
    }
    return true;
}

let isDraggingFromToolbox = false;

document.querySelectorAll('.tool-item').forEach(item => {
    // Drag start
    item.addEventListener('dragstart', (e) => {
        isDraggingFromToolbox = true;
        e.dataTransfer.setData('type', item.dataset.type);
        e.dataTransfer.setData('value', item.dataset.value);
        e.dataTransfer.setData('icon', item.dataset.icon);
    });

    item.addEventListener('dragend', () => {
        // Reset after a short delay to allow drop to complete
        setTimeout(() => { isDraggingFromToolbox = false; }, 100);
    });

    // Click to spawn (only if not dragging)
    item.addEventListener('click', () => {
        // Skip if this was a drag action
        if (isDraggingFromToolbox) {
            isDraggingFromToolbox = false;
            return;
        }

        const type = item.dataset.type;
        const value = item.dataset.value;
        const icon = item.dataset.icon;

        if (type === 'person') {
            // Person needs a bedroom first
            const bedrooms = rooms.filter(r => isBedroom(r.value));
            if (bedrooms.length === 0) {
                showToast('請先放置臥室！');
                return;
            }
            // Find a bedroom without this person
            let targetBedroom = bedrooms.find(b => {
                const idx = rooms.indexOf(b);
                return !persons.some(p => p.bedroomId === idx && p.value === value);
            });
            if (!targetBedroom) targetBedroom = bedrooms[0];
            const cx = targetBedroom.x + targetBedroom.w / 2;
            const cy = targetBedroom.y + targetBedroom.h / 2;
            addItemToCanvas(type, value, icon, cx, cy);
        } else {
            // Random position for rooms/facilities/objects
            addItemToCanvas(type, value, icon, null, null);
        }
        draw();
        updateConfigList();
    });
});

canvas.addEventListener('dragover', (e) => e.preventDefault());

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const type = e.dataTransfer.getData('type');
    const value = e.dataTransfer.getData('value');
    const icon = e.dataTransfer.getData('icon');

    addItemToCanvas(type, value, icon, x, y);
    draw();
    updateConfigList();
});

// ===== Canvas Mouse Events =====
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check persons first (calculate their actual position)
    for (let i = persons.length - 1; i >= 0; i--) {
        const p = persons[i];
        const bedroom = rooms[p.bedroomId];
        if (!bedroom) continue;
        const px = bedroom.x + bedroom.w / 2 + (p.offsetX || 0);
        const py = bedroom.y + bedroom.h / 2 + (p.offsetY || 0);
        if (Math.abs(mx - px) < PERSON_SIZE / 2 && Math.abs(my - py) < PERSON_SIZE / 2) {
            selectedPerson = i;
            clearEntitySelection();
            dragMode = 'move-person';
            dragStart = { x: mx, y: my };
            originalState = { bedroomId: p.bedroomId, offsetX: p.offsetX, offsetY: p.offsetY };
            draw();
            return;
        }
    }

    // Check entities
    for (let i = rooms.length - 1; i >= 0; i--) {
        const r = rooms[i];

        // Resize handle
        if (selectedRoom === i && selectedRooms.size <= 1) {
            if (mx >= r.x + r.w - HANDLE_SIZE && mx <= r.x + r.w &&
                my >= r.y + r.h - HANDLE_SIZE && my <= r.y + r.h) {
                dragMode = 'resize';
                dragStart = { x: mx, y: my };
                originalState = { w: r.w, h: r.h, minSize: r.type === 'object' ? OBJECT_MIN_SIZE : ROOM_MIN_SIZE };
                return;
            }

            // Rotate handle
            const rotateX = r.x + r.w / 2;
            const rotateY = r.y - 15;
            if (Math.sqrt((mx - rotateX) ** 2 + (my - rotateY) ** 2) < 10) {
                dragMode = 'rotate';
                dragStart = { x: mx, y: my };
                originalState = { rotation: r.rotation || 0 };
                return;
            }
        }

        // Entity body
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
            const multiSelect = e.shiftKey || e.ctrlKey || e.metaKey;

            if (multiSelect) {
                toggleEntitySelection(i);
                selectedPerson = null;

                if (!isEntitySelected(i)) {
                    draw();
                    return;
                }
            } else if (!isEntitySelected(i) || selectedRooms.size <= 1) {
                selectSingleEntity(i);
            } else {
                selectedRoom = i;
            }

            selectedPerson = null;
            startEntityMove(i, mx, my);
            draw();
            return;
        }
    }

    clearEntitySelection();
    selectedPerson = null;
    draw();
});

canvas.addEventListener('mousemove', (e) => {
    if (!dragMode) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragMode === 'move-room' && selectedRoom !== null) {
        const dx = mx - dragStart.x;
        const dy = my - dragStart.y;
        originalState.entities.forEach(entity => {
            if (!rooms[entity.index]) return;
            rooms[entity.index].x = entity.x + dx;
            rooms[entity.index].y = entity.y + dy;
        });
    } else if (dragMode === 'resize' && selectedRoom !== null) {
        const dx = mx - dragStart.x;
        const dy = my - dragStart.y;
        const minSize = originalState.minSize || ROOM_MIN_SIZE;
        rooms[selectedRoom].w = Math.max(minSize, originalState.w + dx);
        rooms[selectedRoom].h = Math.max(minSize, originalState.h + dy);
    } else if (dragMode === 'rotate' && selectedRoom !== null) {
        const r = rooms[selectedRoom];
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const angle = Math.atan2(my - cy, mx - cx);
        rooms[selectedRoom].rotation = angle + Math.PI / 2;
    } else if (dragMode === 'move-person' && selectedPerson !== null) {
        // Update offset relative to current bedroom
        const p = persons[selectedPerson];
        const bedroom = rooms[p.bedroomId];
        if (bedroom) {
            p.offsetX = mx - (bedroom.x + bedroom.w / 2);
            p.offsetY = my - (bedroom.y + bedroom.h / 2);
        }
    }

    draw();
    updateConfigList();
});

canvas.addEventListener('mouseup', () => {
    if (dragMode === 'move-person' && selectedPerson !== null) {
        const p = persons[selectedPerson];
        const bedroom = rooms[p.bedroomId];
        if (bedroom) {
            const px = bedroom.x + bedroom.w / 2 + (p.offsetX || 0);
            const py = bedroom.y + bedroom.h / 2 + (p.offsetY || 0);
            const newBedroom = findBedroomAt(px, py);

            if (!newBedroom) {
                // Bounce back to original position
                p.bedroomId = originalState.bedroomId;
                p.offsetX = originalState.offsetX;
                p.offsetY = originalState.offsetY;
                showToast('⚠️ 家人必須在臥室內！');
            } else if (newBedroom !== bedroom) {
                // Moved to a different bedroom
                p.bedroomId = rooms.indexOf(newBedroom);
                p.offsetX = px - (newBedroom.x + newBedroom.w / 2);
                p.offsetY = py - (newBedroom.y + newBedroom.h / 2);
            }
        }
        draw();
        updateConfigList();
    }

    dragMode = null;
    originalState = null;
});

canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check persons (calculate actual position)
    for (let i = persons.length - 1; i >= 0; i--) {
        const p = persons[i];
        const bedroom = rooms[p.bedroomId];
        if (!bedroom) continue;
        const px = bedroom.x + bedroom.w / 2 + (p.offsetX || 0);
        const py = bedroom.y + bedroom.h / 2 + (p.offsetY || 0);
        if (Math.abs(mx - px) < PERSON_SIZE / 2 && Math.abs(my - py) < PERSON_SIZE / 2) {
            persons.splice(i, 1);
            selectedPerson = null;
            draw();
            updateConfigList();
            return;
        }
    }

    // Check entities
    for (let i = rooms.length - 1; i >= 0; i--) {
        const r = rooms[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
            removeEntityAt(i);
            draw();
            updateConfigList();
            return;
        }
    }
});

// ===== Toast =====
function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.className = 'toast-msg';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1b2838;
        color: #fbbf24;
        padding: 10px 20px;
        border-radius: 8px;
        border: 1px solid #fbbf24;
        z-index: 9999;
        animation: fadeOut 2s forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// ===== Config List =====
function updateConfigList() {
    const list = document.getElementById('configList');
    const activeFloor = getActiveFloor();

    if (rooms.length === 0 && persons.length === 0) {
        list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.75rem;">
            目前在 ${activeFloor.name}<br>
            1. 先拖拉房間到平面圖<br>
            2. 再放入家人與重要物品
        </p>`;
        return;
    }

    const spaces = rooms.filter(r => r.type !== 'object');
    const objects = rooms.filter(r => r.type === 'object');
    let html = `<div class="config-section-title">${activeFloor.name}</div>`;

    if (spaces.length > 0) {
        html += `<div class="config-section-title">房間/設施</div>`;
        spaces.forEach(r => {
            const dir = getDirection(r.x, r.y, r.w, r.h);
            html += `<div class="config-item">
                <span>${r.icon} ${r.value}</span>
                <span class="dir">${dir}</span>
            </div>`;
        });
    }

    if (persons.length > 0) {
        html += `<div class="config-section-title">家庭成員</div>`;
        persons.forEach(p => {
            const bedroom = rooms[p.bedroomId];
            const dir = bedroom ? getDirection(bedroom.x, bedroom.y, bedroom.w, bedroom.h) : '?';
            html += `<div class="config-item person-row">
                <span>${p.icon} ${p.value}</span>
                <span class="dir">${dir}</span>
            </div>`;
        });
    }

    if (objects.length > 0) {
        html += `<div class="config-section-title">重要物品</div>`;
        objects.forEach(obj => {
            const dir = getDirection(obj.x, obj.y, obj.w, obj.h);
            const container = findContainingSpace(obj);
            html += `<div class="config-item object-row">
                <span>${obj.icon} ${obj.value}${container ? ` / ${container.value}` : ''}</span>
                <span class="dir">${dir}</span>
            </div>`;
        });
    }

    list.innerHTML = html;
}

// ===== Clear =====
document.getElementById('clearCanvas').addEventListener('click', () => {
    const activeFloor = getActiveFloor();
    activeFloor.rooms = [];
    activeFloor.persons = [];
    clearEntitySelection();
    selectedPerson = null;
    refreshActiveCollections();
    draw();
    updateConfigList();
    hidePromptOutput();
});

// ===== Generate Prompt =====
document.getElementById('generateBtn').addEventListener('click', () => {
    saveActiveCompass();

    const hasAnyLayout = floors.some(floor => floor.rooms.length > 0 || floor.persons.length > 0);
    if (!hasAnyLayout) {
        showToast('請先放置至少一個房間');
        return;
    }

    let prompt = `請幫我分析多樓層住宅風水：\n\n`;

    floors.forEach(floor => {
        if (floor.rooms.length === 0 && floor.persons.length === 0) return;

        prompt += `【${floor.name}】\n`;
        prompt += `方位說明：以下方位已依此樓層羅盤設定換算。\n\n`;

        if (floor.persons.length > 0) {
            prompt += `【家庭成員臥室位置】\n`;
            floor.persons.forEach(p => {
                const bedroom = floor.rooms[p.bedroomId];
                if (!bedroom) return;
                const dir = getDirection(bedroom.x, bedroom.y, bedroom.w, bedroom.h, floor.compassRotation || 0);
                prompt += `- ${p.value}：${dir}（${bedroom.value}）\n`;
            });
            prompt += '\n';
        }

        const spaces = floor.rooms.filter(r => r.type !== 'object');
        if (spaces.length > 0) {
            prompt += `【房間/設施位置】\n`;
            spaces.forEach(item => {
                const dir = getDirection(item.x, item.y, item.w, item.h, floor.compassRotation || 0);
                prompt += `- ${item.value}：${dir}\n`;
            });
            prompt += '\n';
        }

        const objects = floor.rooms.filter(r => r.type === 'object');
        if (objects.length > 0) {
            prompt += `【重要物品位置】\n`;
            objects.forEach(item => {
                const dir = getDirection(item.x, item.y, item.w, item.h, floor.compassRotation || 0);
                const container = findContainingSpace(item, floor);
                prompt += `- ${item.value}：${dir}${container ? `（${container.value}內）` : ''}\n`;
            });
            prompt += '\n';
        }
    });

    prompt += `請根據易經陽宅風水理論分析：
1. 各樓層的整體格局與重點問題
2. 各成員的卦象與吉凶
3. 房間、設施與重要物品位置的風水影響
4. 多樓層之間是否有需要留意的承接關係
5. 改善建議

（使用 yijing-fengshui Skill）`;

    const output = document.getElementById('promptOutput');
    const copyBtn = document.getElementById('copyBtn');
    output.textContent = prompt;
    output.classList.add('show');
    copyBtn.classList.add('show');
});

// ===== Copy =====
document.getElementById('copyBtn').addEventListener('click', () => {
    const text = document.getElementById('promptOutput').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '✅ 已複製！';
        btn.style.background = 'var(--success)';
        btn.style.color = 'var(--bg-dark)';
        setTimeout(() => {
            btn.textContent = '📋 複製 Prompt';
            btn.style.background = 'transparent';
            btn.style.color = 'var(--success)';
        }, 2000);
    });
});

// ===== Compass Rotation =====
let isRotatingCompass = false;
let compassStartAngle = 0;

compass.addEventListener('mousedown', (e) => {
    isRotatingCompass = true;
    const rect = compass.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    compassStartAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI - compassRotation;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isRotatingCompass) return;
    const rect = compass.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    compassRotation = currentAngle - compassStartAngle;
    saveActiveCompass();

    // Update visual rotation
    updateCompassVisual();

    // Redraw to update directions
    draw();
    updateConfigList();
});

document.addEventListener('mouseup', () => {
    isRotatingCompass = false;
});

renderFloorTabs();
resizeCanvas();
updateConfigList();
